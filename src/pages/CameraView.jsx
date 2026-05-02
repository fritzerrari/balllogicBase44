/**
 * CameraView — Handy-Kamera-Seite (kein Login nötig, public route)
 *
 * Fixes:
 * - Pollt KONTINUIERLICH bis Session aktiv wird (nicht nur 3x)
 * - Zeigt "Warte auf Trainer" wenn noch keine Session da ist
 * - Code-Matching: prüft auch wenn Session noch nicht gestartet (pending)
 * - Seitenwechsel: zeigt HZ-Indikator wenn session.half_time === 2
 * - Kamera: startet sofort beim Verbinden, unabhängig von Session-Status
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Zap, CheckCircle2, AlertCircle, Loader2,
  RotateCcw, Lock, AlertTriangle, Maximize2, RotateCw,
  Wifi, WifiOff, Battery, BatteryLow, ScanLine, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import EventButtons from '@/components/live/EventButtons';

const DIGITS = 6;
const POLL_INTERVAL_MS = 3000;   // alle 3s auf Session warten
const HEARTBEAT_INTERVAL_MS = 8000;

function formatUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function matchCode(session, code) {
  if (!session?.camera_streams?.length) return false;
  return session.camera_streams.some(cam =>
    String(cam.code).trim() === String(code).trim()
  );
}

export default function CameraView() {
  const urlParams = new URLSearchParams(window.location.search);
  const prefillCode = urlParams.get('code') || '';
  const prefillPos  = urlParams.get('pos')  || '';

  const [code, setCode]           = useState(prefillCode);
  const [step, setStep]           = useState(prefillCode.length === DIGITS ? 'waiting' : 'enter');
  const [waitMsg, setWaitMsg]     = useState('Warte auf Session-Start...');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [camLabel, setCamLabel]   = useState(prefillPos);
  const [errorMsg, setErrorMsg]   = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const [uptime, setUptime]       = useState(0);
  const [isPortrait, setIsPortrait] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [batteryLevel, setBatteryLevel]   = useState(null);
  const [batteryCharging, setBatteryCharging] = useState(false);
  const [halfTime, setHalfTime]   = useState(1);
  const [pollCount, setPollCount] = useState(0);

  const videoRef      = useRef(null);
  const streamRef     = useRef(null);
  const heartbeatRef  = useRef(null);
  const uptimeRef     = useRef(null);
  const pollRef       = useRef(null);
  const sessionCodeRef = useRef(prefillCode);
  const connectedSessionRef = useRef(null);

  // ── Batterie ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(bat => {
      setBatteryLevel(Math.round(bat.level * 100));
      setBatteryCharging(bat.charging);
      bat.addEventListener('levelchange', () => setBatteryLevel(Math.round(bat.level * 100)));
      bat.addEventListener('chargingchange', () => setBatteryCharging(bat.charging));
    }).catch(() => {});
  }, []);

  // ── Portrait-Detektion ────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, []);

  // ── Auto-connect wenn Code in URL ─────────────────────────────────────────
  useEffect(() => {
    if (prefillCode.length === DIGITS) {
      startPolling(prefillCode);
    }
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    clearAllTimers();
    stopStream();
  }, []);

  const clearAllTimers = () => {
    clearInterval(heartbeatRef.current);
    clearInterval(uptimeRef.current);
    clearInterval(pollRef.current);
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // ── Kamera starten ────────────────────────────────────────────────────────
  const startCamera = useCallback(async (facing = 'environment') => {
    stopStream();
    setCameraError(null);

    // Verschiedene Constraint-Stufen versuchen
    const tries = [
      { video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } } },
      { video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: facing } },
      { video: true },
    ];

    for (const c of tries) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          // iOS braucht play() explizit nach srcObject Zuweisung
          try { await videoRef.current.play(); } catch (_) {}
        }
        return true;
      } catch (_) {}
    }
    setCameraError('Kamera-Berechtigung fehlt. Bitte in Browser-Einstellungen erlauben.');
    return false;
  }, []);

  // ── Polling: warte bis Session aktiv ─────────────────────────────────────
  const startPolling = useCallback((c) => {
    const codeStr = String(c || code).trim();
    if (codeStr.length !== DIGITS) return;
    sessionCodeRef.current = codeStr;

    setStep('waiting');
    setWaitMsg('Warte auf Session-Start...');
    clearInterval(pollRef.current);

    // Kamera direkt starten — nicht auf Session warten
    startCamera('environment');

    let count = 0;
    const poll = async () => {
      count++;
      setPollCount(count);
      try {
        const sessions = await base44.entities.LiveSession.filter({ status: 'active' });
        const matched = sessions.find(s => matchCode(s, codeStr));

        if (matched) {
          clearInterval(pollRef.current);
          const cam = matched.camera_streams?.find(cam => String(cam.code).trim() === codeStr);
          if (cam?.label) setCamLabel(cam.label);
          setSessionInfo(matched);
          setHalfTime(matched.half_time || 1);
          connectedSessionRef.current = matched;
          setStep('live');

          // Uptime
          uptimeRef.current = setInterval(() => setUptime(t => t + 1), 1000);

          // Heartbeat
          startHeartbeat(matched, codeStr);
          return;
        }

        // Noch keine Session — weiter warten
        setWaitMsg(count < 10
          ? `Warte auf Session-Start... (${count * 3}s)`
          : `Trainer muss Live-Session starten. Warte... (${Math.round(count * 3 / 60)}min)`
        );
      } catch (_) {
        setWaitMsg('Verbindungsproblem — versuche erneut...');
      }
    };

    // Sofort + dann alle 3s
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [code, startCamera]);

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  const startHeartbeat = useCallback((initialSession, codeStr) => {
    clearInterval(heartbeatRef.current);
    let degraded = 0;

    heartbeatRef.current = setInterval(async () => {
      try {
        const sessions = await base44.entities.LiveSession.filter({ status: 'active' });
        const fresh = sessions.find(s => s.id === initialSession.id);

        if (!fresh) {
          degraded++;
          setConnectionQuality('degraded');
          if (degraded >= 3) {
            // Session beendet — zurück zum Warten
            clearInterval(heartbeatRef.current);
            setStep('ended');
          }
          return;
        }

        degraded = 0;
        setConnectionQuality('good');

        // Halbzeit-Seitenwechsel erkennen
        if (fresh.half_time && fresh.half_time !== halfTime) {
          setHalfTime(fresh.half_time);
        }

        // Eigenen Status aktualisieren
        const updatedStreams = (fresh.camera_streams || []).map(cam =>
          String(cam.code).trim() === codeStr
            ? { ...cam, status: 'connected', last_seen: new Date().toISOString() }
            : cam
        );
        await base44.entities.LiveSession.update(fresh.id, { camera_streams: updatedStreams }).catch(() => {});
      } catch (_) {
        degraded++;
        setConnectionQuality('degraded');
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [halfTime]);

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    await startCamera(next);
  };

  const handleStop = () => {
    clearAllTimers();
    stopStream();
    setStep('enter');
    setCode('');
    setUptime(0);
    setSessionInfo(null);
    setCamLabel('');
    setPollCount(0);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* Portrait-Warnung */}
      <AnimatePresence>
        {step === 'live' && isPortrait && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/95 z-50 flex flex-col items-center justify-center p-6 text-center">
            <motion.div animate={{ rotate: [0, 90, 0] }} transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}>
              <RotateCw className="w-20 h-20 text-primary mb-6" />
            </motion.div>
            <h2 className="text-2xl font-grotesk font-bold text-foreground mb-2">Handy drehen!</h2>
            <p className="text-muted-foreground">Bitte ins <strong className="text-primary">Querformat</strong> drehen</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ── CODE EINGABE ── */}
        {step === 'enter' && (
          <motion.div key="enter" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-5">
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

              <input
                type="tel" inputMode="numeric" pattern="[0-9]*"
                placeholder="_ _ _ _ _ _"
                value={code}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, DIGITS);
                  setCode(digits);
                  if (digits.length === DIGITS) startPolling(digits);
                }}
                className="w-full text-center text-5xl font-grotesk font-bold tracking-[0.5em] bg-muted border-2 border-border rounded-2xl px-4 py-6 text-foreground focus:outline-none focus:border-primary mb-4 transition-colors"
                autoFocus
              />

              <Button onClick={() => startPolling(code)} disabled={code.length !== DIGITS}
                className="w-full bg-primary text-primary-foreground neon-glow h-14 text-lg font-bold mb-6 rounded-xl">
                Verbinden →
              </Button>

              <div className="bg-muted/60 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">Vor dem Start</div>
                {[['①', 'Gehe auf deinen Kamera-Platz'], ['②', 'Querformat & Bildschirm aktiv lassen'], ['③', 'WLAN einschalten']].map(([n, t]) => (
                  <div key={n} className="flex items-start gap-2 text-xs text-foreground/80">
                    <span className="text-primary flex-shrink-0 font-bold">{n}</span><span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── WARTEN AUF SESSION ── */}
        {step === 'waiting' && (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col">

            {/* Kamera läuft schon im Hintergrund */}
            <div className="relative bg-black" style={{ aspectRatio: '16/9', maxHeight: '35vh' }}>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center">
                  <Camera className="w-10 h-10 text-muted-foreground mb-2" />
                  <div className="text-xs text-muted-foreground">{cameraError}</div>
                  <button onClick={() => startCamera(facingMode)} className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs">
                    Kamera erlauben
                  </button>
                </div>
              ) : (
                <div className="absolute top-2 left-2 bg-black/70 rounded-lg px-2 py-1 text-[11px] text-yellow-400 font-bold flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" /> Kamera bereit
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
              <div className="glass rounded-2xl p-6 w-full max-w-sm">
                <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                <div className="font-grotesk font-bold text-foreground text-lg mb-1">Warte auf Trainer</div>
                <div className="text-sm text-muted-foreground mb-4">{waitMsg}</div>

                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-xs text-primary text-left mb-4">
                  <div className="font-bold mb-1">✓ Kamera läuft bereits</div>
                  <div>Code: <span className="font-mono font-bold tracking-widest">{sessionCodeRef.current}</span></div>
                  <div className="mt-1 text-muted-foreground">Sobald der Trainer die Live-Session startet, verbindest du dich automatisch.</div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleStop} className="flex-1 border-border text-muted-foreground text-xs">
                    Abbrechen
                  </Button>
                  <Button onClick={() => startPolling(sessionCodeRef.current)} className="flex-1 bg-primary text-primary-foreground text-xs gap-1">
                    <Loader2 className="w-3 h-3" /> Neu verbinden
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SESSION BEENDET ── */}
        {step === 'ended' && (
          <motion.div key="ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center p-4">
            <div className="glass rounded-2xl p-7 w-full max-w-sm text-center">
              <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
              <h2 className="font-grotesk font-bold text-foreground text-xl mb-2">Session beendet</h2>
              <p className="text-sm text-muted-foreground mb-5">Die Live-Session wurde vom Trainer beendet.</p>
              <Button onClick={handleStop} className="w-full bg-primary text-primary-foreground">
                Neue Session starten
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── LIVE ── */}
        {step === 'live' && (
          <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="min-h-screen flex flex-col">

            {/* Halbzeit-Seitenwechsel Banner */}
            {halfTime === 2 && (
              <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-4 py-2 flex items-center gap-2 justify-center">
                <Clock className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">2. HALBZEIT — Seitenwechsel beachten!</span>
              </div>
            )}

            {/* Video */}
            <div className="relative bg-black" style={{ aspectRatio: '16/9', maxHeight: '42vh' }}>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

              {/* REC Overlay */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                <div className="bg-black/75 rounded-lg px-2 py-1 text-[11px] text-white font-bold flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC
                </div>
                <div className={`bg-black/75 rounded-lg px-2 py-1 text-[11px] font-bold flex items-center gap-1 ${connectionQuality === 'good' ? 'text-primary' : 'text-yellow-400'}`}>
                  {connectionQuality === 'good' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {connectionQuality === 'good' ? 'Online' : 'Schwach'}
                </div>
                {batteryLevel !== null && (
                  <div className={`bg-black/75 rounded-lg px-2 py-1 text-[11px] font-bold flex items-center gap-1 ${batteryLevel <= 20 ? 'text-red-400' : 'text-white'}`}>
                    {batteryLevel <= 20 ? <BatteryLow className="w-3 h-3" /> : <Battery className="w-3 h-3" />}
                    {batteryLevel}%{batteryCharging ? '⚡' : ''}
                  </div>
                )}
              </div>

              {/* Uptime */}
              <div className="absolute top-2 right-2 bg-black/75 rounded-lg px-2 py-1 text-[11px] text-white font-mono">
                <span className="font-bold tabular-nums">{formatUptime(uptime)}</span>
                {camLabel && <span className="text-white/60"> · {camLabel}</span>}
                <span className="text-yellow-400 ml-1">{halfTime}. HZ</span>
              </div>

              {/* Kamera-Fehler */}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center p-4">
                    <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <div className="text-xs text-muted-foreground mb-3">{cameraError}</div>
                    <button onClick={() => startCamera(facingMode)}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
                      Erneut versuchen
                    </button>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="absolute bottom-2 right-2 flex items-center gap-2">
                <button onClick={flipCamera}
                  className="w-9 h-9 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white active:scale-90">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Grid lines */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-0 right-0 border-t border-white/10" />
                <div className="absolute top-2/3 left-0 right-0 border-t border-white/10" />
                <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/10" />
                <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/10" />
              </div>
            </div>

            {/* Kamera fixiert Warnung */}
            <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-xs font-bold text-destructive">KAMERA FIXIERT LASSEN — Kein Schwenken · Kein Wackeln</span>
            </div>

            {/* Scrollbarer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
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

              {isPortrait && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center gap-3">
                  <Maximize2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="text-xs text-primary font-medium">
                    Drehe ins <strong>Querformat</strong> für Vollbild!
                  </div>
                </div>
              )}

              <div className="glass rounded-2xl p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">📋 Ereignis tippen</div>
                <EventButtons
                  sessionId={sessionInfo?.id}
                  matchTitle={sessionInfo?.match_title}
                  source={`camera_${camLabel || '1'}`}
                  elapsedSeconds={uptime}
                  compact={false}
                />
              </div>

              <button onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
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