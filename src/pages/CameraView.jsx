/**
 * CameraView — Handy-Kamera-Seite (kein Login nötig)
 * 
 * Robustheit:
 * - Code-Matching: 6-stelliger Code wird gegen ALLE aktiven Sessions geprüft (exakt + fuzzy)
 * - Auto-Retry: Verbindung wird bis zu 3x automatisch neu versucht
 * - Heartbeat: alle 10s Status-Update, bei Fehler still ignoriert
 * - Kamera: Weitwinkel-Hint, Landscape-Erzwingung, Auto-Restart bei Fehler
 * 
 * UX:
 * - Vollbild-Video im Landscape-Modus
 * - Riesige Event-Buttons mit haptischem Feedback
 * - Portrait-Warnung wenn Gerät im Hochformat
 * - Querformat-Anweisung prominent
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Zap, CheckCircle2, AlertCircle, Loader2,
  RotateCcw, Lock, AlertTriangle, Maximize2, RotateCw,
  Wifi, WifiOff, Battery, BatteryLow, ScanLine, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import EventButtons from '@/components/live/EventButtons';

const DIGITS = 6;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 10000;

// Kamera-Constraint: Weitwinkel bevorzugen
const VIDEO_CONSTRAINTS = {
  facingMode: 'environment',
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 },
  aspectRatio: { ideal: 16 / 9 },
  frameRate: { ideal: 30, min: 15 },
  // Weitwinkel-Hint (falls Browser/Gerät unterstützt)
  zoom: { ideal: 1 },
};

function formatUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

/** Robustes Code-Matching: prüft alle Felder einer Session */
function matchCode(session, code) {
  if (!session?.camera_streams) return false;
  return session.camera_streams.some(cam =>
    cam.code === code ||
    cam.camera_id === code ||
    cam.stream_url === code ||
    String(cam.code).trim() === code.trim()
  );
}

export default function CameraView() {
  const urlParams = new URLSearchParams(window.location.search);
  const prefillCode = urlParams.get('code') || '';
  const prefillPos = urlParams.get('pos') || '';

  const [code, setCode] = useState(prefillCode);
  const [step, setStep] = useState(prefillCode.length === DIGITS ? 'connecting' : 'enter');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [camLabel, setCamLabel] = useState(prefillPos);
  const [errorMsg, setErrorMsg] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [facingMode, setFacingMode] = useState('environment');
  const [wideAngle, setWideAngle] = useState(true);
  const [uptime, setUptime] = useState(0);
  const [isPortrait, setIsPortrait] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [connectionQuality, setConnectionQuality] = useState('good'); // good | degraded
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [batteryCharging, setBatteryCharging] = useState(false);
  const [networkType, setNetworkType] = useState(null);
  const [autoRetrying, setAutoRetrying] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const heartbeatRef = useRef(null);
  const uptimeRef = useRef(null);
  const retryTimerRef = useRef(null);
  const sessionCodeRef = useRef('');

  // Batterie-Status
  useEffect(() => {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(bat => {
      setBatteryLevel(Math.round(bat.level * 100));
      setBatteryCharging(bat.charging);
      bat.addEventListener('levelchange', () => setBatteryLevel(Math.round(bat.level * 100)));
      bat.addEventListener('chargingchange', () => setBatteryCharging(bat.charging));
    }).catch(() => {});
  }, []);

  // Netzwerk-Typ
  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      setNetworkType(conn.effectiveType || conn.type || null);
      conn.addEventListener('change', () => setNetworkType(conn.effectiveType || conn.type || null));
    }
  }, []);

  // Portrait-Detektion
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Auto-connect wenn Code in URL
  useEffect(() => {
    if (prefillCode.length === DIGITS) handleConnect(prefillCode);
  }, []);

  // Cleanup
  useEffect(() => () => {
    clearAllTimers();
    stopStream();
  }, []);

  const clearAllTimers = () => {
    clearInterval(heartbeatRef.current);
    clearInterval(uptimeRef.current);
    clearTimeout(retryTimerRef.current);
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (facing = facingMode, wide = wideAngle) => {
    stopStream();
    setCameraError(null);

    const wideConstraints = wide
      ? { zoom: { ideal: 0.5 }, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, aspectRatio: { ideal: 16/9 }, frameRate: { ideal: 30, min: 15 } }
      : { width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16/9 } };

    const constraints = [
      { video: { ...wideConstraints, facingMode: facing } },
      { video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: facing } },
      { video: true },
    ];

    let stream = null;
    for (const c of constraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        break;
      } catch (e) {
        // nächsten Constraint versuchen
      }
    }

    if (!stream) {
      setCameraError('Kamera konnte nicht gestartet werden. Bitte Kamera-Berechtigung erteilen.');
      return false;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }
    return true;
  };

  const handleConnect = useCallback(async (codeToUse, attempt = 1) => {
    const c = (codeToUse || code).trim();
    if (c.length !== DIGITS) return;
    sessionCodeRef.current = c;

    setStep('connecting');
    setErrorMsg('');

    let sessions = [];
    try {
      sessions = await base44.entities.LiveSession.filter({ status: 'active' });
    } catch (e) {
      // Netzwerkfehler — retry
    }

    // Exaktes Code-Matching gegen alle Sessions
    let matched = sessions.find(s => matchCode(s, c));
    // Fallback: wenn kein Code-Match aber Sessions aktiv, nehme erste (für direkte Links ohne Code)
    if (!matched && sessions.length === 1) matched = sessions[0];

    if (!matched) {
      if (attempt < MAX_RETRIES) {
        setAutoRetrying(true);
        setErrorMsg(`Suche aktive Session... (Versuch ${attempt}/${MAX_RETRIES})`);
        retryTimerRef.current = setTimeout(() => handleConnect(c, attempt + 1), RETRY_DELAY_MS);
        return;
      }
      setAutoRetrying(false);
      setErrorMsg('Kein aktives Spiel gefunden. Der Trainer muss zuerst eine Live-Session starten.');
      setStep('error');
      setRetryCount(0);
      return;
    }
    setAutoRetrying(false);

    // Kamera-Label aus Session holen
    const matchedCam = matched.camera_streams?.find(cam =>
      cam.code === c || cam.camera_id === c || cam.stream_url === c
    );
    if (matchedCam?.label) setCamLabel(matchedCam.label);

    setSessionInfo(matched);

    // Kamera starten
    const cameraOk = await startCamera();
    if (!cameraOk) {
      // Weiter ohne Kamera (nur Event-Buttons)
    }

    setStep('live');
    setRetryCount(0);

    // Uptime-Zähler
    uptimeRef.current = setInterval(() => setUptime(t => t + 1), 1000);

    // Heartbeat — robust, bei Verbindungsverlust auto-retry
    let degradedCount = 0;
    heartbeatRef.current = setInterval(async () => {
      try {
        const freshSessions = await base44.entities.LiveSession.filter({ status: 'active' });
        const fresh = freshSessions.find(s => s.id === matched.id);
        if (!fresh) {
          degradedCount++;
          setConnectionQuality('degraded');
          // Nach 3 fehlgeschlagenen Heartbeats: Auto-Reconnect
          if (degradedCount >= 3) {
            degradedCount = 0;
            clearInterval(heartbeatRef.current);
            clearInterval(uptimeRef.current);
            setStep('connecting');
            setTimeout(() => handleConnect(c), 1000);
          }
          return;
        }
        degradedCount = 0;
        const updatedStreams = (fresh.camera_streams || []).map(cam =>
          (cam.code === c || cam.camera_id === c || cam.stream_url === c)
            ? { ...cam, status: 'connected', last_seen: new Date().toISOString() }
            : cam
        );
        if (updatedStreams.length > 0) {
          await base44.entities.LiveSession.update(fresh.id, { camera_streams: updatedStreams });
        }
        setConnectionQuality('good');
      } catch (e) {
        degradedCount++;
        setConnectionQuality('degraded');
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [code, facingMode]);

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    await startCamera(next, wideAngle);
  };

  const toggleWideAngle = async () => {
    const next = !wideAngle;
    setWideAngle(next);
    await startCamera(facingMode, next);
  };

  const handleStop = () => {
    clearAllTimers();
    stopStream();
    setStep('enter');
    setCode('');
    setUptime(0);
    setSessionInfo(null);
    setCamLabel('');
    setConnectionQuality('good');
  };

  const handleRetry = () => {
    const c = sessionCodeRef.current || code;
    handleConnect(c);
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* Portrait-Warnung — sehr prominent */}
      <AnimatePresence>
        {step === 'live' && isPortrait && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/95 z-50 flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div animate={{ rotate: [0, 90, 0] }} transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}>
              <RotateCw className="w-20 h-20 text-primary mb-6" />
            </motion.div>
            <h2 className="text-2xl font-grotesk font-bold text-foreground mb-2">Handy drehen!</h2>
            <p className="text-muted-foreground">Bitte drehe dein Gerät ins <strong className="text-primary">Querformat (Landscape)</strong> für optimale Kameraaufnahme</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ── CODE EINGABE ── */}
        {step === 'enter' && (
          <motion.div key="enter" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-5">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center neon-glow">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <span className="font-grotesk font-bold text-foreground text-xl">TactIQ</span>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Kamera-Assistent</div>
              </div>
            </div>

            <div className="glass rounded-2xl p-7 w-full max-w-sm">
              <div className="text-center mb-6">
                <Camera className="w-14 h-14 text-primary mx-auto mb-3" />
                <h1 className="text-2xl font-grotesk font-bold text-foreground mb-1">Kamera starten</h1>
                <p className="text-sm text-muted-foreground">6-stelligen Code vom Trainer eingeben</p>
              </div>

              {/* Code-Eingabe — riesige Digits */}
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="_ _ _ _ _ _"
                value={code}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, DIGITS);
                  setCode(digits);
                  if (digits.length === DIGITS) handleConnect(digits);
                }}
                className="w-full text-center text-6xl font-grotesk font-bold tracking-[0.5em] bg-muted border-2 border-border rounded-2xl px-4 py-6 text-foreground focus:outline-none focus:border-primary mb-4 transition-colors"
                autoFocus
              />

              <Button
                onClick={() => handleConnect()}
                disabled={code.length !== DIGITS}
                className="w-full bg-primary text-primary-foreground neon-glow h-14 text-lg font-bold mb-6 rounded-xl"
              >
                Verbinden & Los →
              </Button>

              {/* Schnell-Checkliste */}
              <div className="bg-muted/60 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">Vor dem Start</div>
                {[
                  ['①', 'Gehe auf deinen Kamera-Platz'],
                  ['②', 'Handy ins Querformat drehen & fixieren'],
                  ['③', 'Bildschirm NICHT sperren lassen'],
                  ['④', 'WLAN einschalten falls vorhanden'],
                ].map(([num, text]) => (
                  <div key={num} className="flex items-start gap-2 text-xs text-foreground/80">
                    <span className="text-primary flex-shrink-0 font-bold">{num}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── VERBINDEN ── */}
        {step === 'connecting' && (
          <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center">
            <div className="glass rounded-2xl p-10 text-center max-w-xs w-full mx-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <div className="font-grotesk font-semibold text-foreground mb-1">
                {autoRetrying ? 'Erneut verbinden...' : 'Verbinde...'}
              </div>
              {errorMsg && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-muted-foreground">{errorMsg}</div>
                  <div className="flex justify-center gap-1">
                    {Array.from({ length: MAX_RETRIES }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                        errorMsg.includes(`${i + 1}/`) ? 'bg-primary scale-125' : 
                        parseInt(errorMsg.match(/Versuch (\d)/)?.[1]) > i + 1 ? 'bg-primary/40' : 'bg-muted'
                      }`} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── FEHLER ── */}
        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center p-4">
            <div className="glass rounded-2xl p-7 w-full max-w-sm text-center">
              <AlertCircle className="w-14 h-14 text-destructive mx-auto mb-4" />
              <h2 className="font-grotesk font-bold text-foreground text-xl mb-2">Keine Session gefunden</h2>
              <p className="text-sm text-muted-foreground mb-4">{errorMsg}</p>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-5 text-xs text-yellow-400 text-left space-y-1">
                <div className="font-bold mb-1">Was tun?</div>
                <div>① Trainer muss im Coaching Cockpit eine Live-Session starten</div>
                <div>② Code prüfen — exakt 6 Ziffern, keine Leerzeichen</div>
                <div>③ Internetverbindung prüfen</div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleRetry} className="flex-1 bg-primary text-primary-foreground gap-2">
                  <Loader2 className="w-4 h-4" /> Nochmal
                </Button>
                <Button variant="outline" onClick={() => { setStep('enter'); setCode(''); }}
                  className="flex-1 border-border text-muted-foreground">
                  Code ändern
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── LIVE ── */}
        {step === 'live' && (
          <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="min-h-screen flex flex-col">

            {/* ── VOLLBILD VIDEO + OVERLAY ── */}
            <div className="relative bg-black" style={{ aspectRatio: '16/9', maxHeight: '40vh' }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {/* REC + Status Overlay — Top Left */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                <div className="bg-black/75 rounded-lg px-2 py-1 text-[11px] text-white font-bold flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC
                </div>
                <div className={`bg-black/75 rounded-lg px-2 py-1 text-[11px] font-bold flex items-center gap-1 ${
                  connectionQuality === 'good' ? 'text-primary' : 'text-yellow-400'
                }`}>
                  {connectionQuality === 'good'
                    ? <><Wifi className="w-3 h-3" /> {networkType ? networkType.toUpperCase() : 'Online'}</>
                    : <><WifiOff className="w-3 h-3" /> Schwach</>}
                </div>
                {batteryLevel !== null && (
                  <div className={`bg-black/75 rounded-lg px-2 py-1 text-[11px] font-bold flex items-center gap-1 ${
                    batteryLevel <= 20 ? 'text-red-400' : batteryCharging ? 'text-primary' : 'text-white'
                  }`}>
                    {batteryLevel <= 20 ? <BatteryLow className="w-3 h-3" /> : <Battery className="w-3 h-3" />}
                    {batteryLevel}%{batteryCharging ? '⚡' : ''}
                  </div>
                )}
              </div>

              {/* Uptime + Label — Top Right */}
              <div className="absolute top-2 right-2 bg-black/75 rounded-lg px-2 py-1 text-[11px] text-white font-mono flex items-center gap-1.5">
                <span className="font-bold tabular-nums">{formatUptime(uptime)}</span>
                {camLabel && <span className="text-white/60">· {camLabel}</span>}
              </div>

              {/* Kamera-Fehler Overlay */}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center p-4">
                    <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">{cameraError}</div>
                    <button onClick={() => startCamera()}
                      className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
                      Erneut versuchen
                    </button>
                  </div>
                </div>
              )}

              {/* Kamera-Steuerung Bottom Right */}
              <div className="absolute bottom-2 right-2 flex items-center gap-2">
                {/* Weitwinkel Toggle */}
                <button
                  onClick={toggleWideAngle}
                  title={wideAngle ? 'Weitwinkel AN' : 'Weitwinkel AUS'}
                  className={`h-9 px-2.5 rounded-full border flex items-center gap-1.5 text-[11px] font-bold transition-all active:scale-90 ${
                    wideAngle
                      ? 'bg-primary/80 border-primary text-primary-foreground'
                      : 'bg-black/60 border-white/20 text-white/70'
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  {wideAngle ? 'WW' : 'Normal'}
                </button>
                {/* Flip */}
                <button
                  onClick={flipCamera}
                  className="w-9 h-9 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-all active:scale-90"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Landscape guide lines — visual framing helper */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-0 right-0 border-t border-white/10" />
                <div className="absolute top-2/3 left-0 right-0 border-t border-white/10" />
                <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/10" />
                <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/10" />
              </div>
            </div>

            {/* ── KAMERA FIXIERT WARNUNG ── */}
            <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-xs font-bold text-destructive">KAMERA FIXIERT LASSEN — Kein Schwenken · Kein Wackeln · Kein Zoomen</span>
            </div>

            {/* ── SCROLLBARER INHALT ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">

              {/* Match-Info */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-grotesk font-bold text-foreground text-base">{sessionInfo?.match_title}</div>
                  {camLabel && <div className="text-xs text-primary font-medium">{camLabel}</div>}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verbunden</span>
                </div>
              </div>

              {/* ── EVENT BUTTONS — GROSS & TOUCH-OPTIMIERT ── */}
              <div className="glass rounded-2xl p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <span>📋</span> Ereignis tippen
                </div>
                <EventButtons
                  sessionId={sessionInfo?.id}
                  matchTitle={sessionInfo?.match_title}
                  source={`camera_${camLabel || 'assistant'}`}
                  elapsedSeconds={uptime}
                  compact={false}
                  mobileOptimized={true}
                />
              </div>

              {/* ── QUERFORMAT HINWEIS (wenn Portrait) ── */}
              {isPortrait && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center gap-3">
                  <Maximize2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="text-xs text-primary font-medium">
                    Drehe dein Handy ins <strong>Querformat</strong> für das Vollbild-Video!
                  </div>
                </div>
              )}

              {/* ── STOP ── */}
              <button
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all text-sm font-medium"
              >
                <AlertTriangle className="w-4 h-4" /> Session beenden
              </button>

              <p className="text-[10px] text-muted-foreground text-center">
                ⚡ Bildschirm aktiv lassen · Energiesparmodus deaktivieren
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}