/**
 * CameraView — Öffentliche Handy-Kamera-Seite (kein Login nötig)
 * Optimiert für maximale Benutzerfreundlichkeit für Kamera-Assistenten
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Zap, CheckCircle2, AlertCircle, Loader2, Mic, MicOff, RotateCcw, Lock, Move, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DIGITS = 6;

// Kamera-Positions-Tipps je nach Kamera-Label
const POSITION_TIPS = {
  default: { icon: '📐', tip: 'Erhöhte Position wählen — Tribüne, Balkon oder Leiter. Kamera auf Stativ oder abgestützt fixieren.' },
  'Tribüne': { icon: '🏟️', tip: 'Von der Tribüne aus: Kamera auf Geländer oder Stativ. Gesamtes Spielfeld muss sichtbar sein.' },
  'Torlinie': { icon: '🥅', tip: 'Hinter oder seitlich neben dem Tor. Winkel ~45° zur Torlinie. Tor komplett im Bild halten.' },
  'Erhöht': { icon: '🎥', tip: 'Möglichst hoch und zentriert. Beide Strafräume sollten sichtbar sein.' },
};

function getPositionTip(label = '') {
  for (const key of Object.keys(POSITION_TIPS)) {
    if (key !== 'default' && label.includes(key)) return POSITION_TIPS[key];
  }
  return POSITION_TIPS.default;
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
  const [micOn, setMicOn] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [uptime, setUptime] = useState(0);
  const [showTips, setShowTips] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const heartbeatRef = useRef(null);
  const uptimeRef = useRef(null);

  useEffect(() => {
    if (prefillCode.length === DIGITS) handleConnect(prefillCode);
  }, []);

  const handleConnect = async (codeToUse) => {
    const c = (codeToUse || code).trim();
    if (c.length !== DIGITS) return;
    setStep('connecting');
    setErrorMsg('');

    const sessions = await base44.entities.LiveSession.filter({ status: 'active' });
    const matched = sessions.find(s => s.camera_streams?.some(cam => cam.stream_url === c || cam.camera_id === c || cam.code === c));
    const session = matched || sessions[0];

    if (!session) {
      setErrorMsg('Kein aktives Spiel mit diesem Code gefunden. Bitte den Trainer kontaktieren — er muss zuerst eine Live-Session starten.');
      setStep('error');
      return;
    }

    // Finde Label für diese Kamera
    const matchedCam = session.camera_streams?.find(cam => cam.stream_url === c || cam.camera_id === c || cam.code === c);
    if (matchedCam?.label) setCamLabel(matchedCam.label);

    setSessionInfo(session);
    await startCamera();
    setStep('live');

    // Uptime-Zähler
    uptimeRef.current = setInterval(() => setUptime(t => t + 1), 1000);

    // Heartbeat alle 15s
    heartbeatRef.current = setInterval(async () => {
      try {
        const updatedStreams = (session.camera_streams || []).map(cam =>
          (cam.stream_url === c || cam.camera_id === c || cam.code === c)
            ? { ...cam, status: 'connected', last_seen: new Date().toISOString() }
            : cam
        );
        if (updatedStreams.length > 0) {
          await base44.entities.LiveSession.update(session.id, { camera_streams: updatedStreams });
        }
      } catch (e) { /* ignore */ }
    }, 15000);
  };

  const startCamera = async () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
  };

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false });
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
  };

  const handleStop = () => {
    clearInterval(heartbeatRef.current);
    clearInterval(uptimeRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setStep('enter');
    setCode('');
    setUptime(0);
  };

  useEffect(() => () => {
    clearInterval(heartbeatRef.current);
    clearInterval(uptimeRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }, []);

  const formatUptime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const positionTip = getPositionTip(camLabel);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center neon-glow">
          <Zap className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-grotesk font-bold text-foreground text-xl">TactIQ</span>
        <span className="text-xs text-muted-foreground ml-1 uppercase tracking-widest">Kamera</span>
      </div>

      <AnimatePresence mode="wait">

        {/* ── ENTER CODE ── */}
        {step === 'enter' && (
          <motion.div key="enter" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="glass rounded-2xl p-7 w-full max-w-sm">
            <div className="text-center mb-6">
              <Camera className="w-12 h-12 text-primary mx-auto mb-3" />
              <h1 className="text-2xl font-grotesk font-bold text-foreground mb-1">Kamera-Assistent</h1>
              <p className="text-sm text-muted-foreground">Gib den 6-stelligen Code ein, den der Trainer dir geschickt hat</p>
            </div>

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
              className="w-full text-center text-5xl font-grotesk font-bold tracking-[0.4em] bg-muted border-2 border-border rounded-xl px-4 py-5 text-foreground focus:outline-none focus:border-primary mb-4 transition-colors"
              autoFocus
            />

            <Button onClick={() => handleConnect()} disabled={code.length !== DIGITS}
              className="w-full bg-primary text-primary-foreground neon-glow h-12 text-base font-bold mb-5">
              Verbinden & Kamera starten →
            </Button>

            {/* Positionierungshinweise */}
            <div className="bg-muted/60 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">📋 Vorbereitung</div>
              <div className="flex items-start gap-2 text-xs text-foreground/80">
                <span className="text-primary flex-shrink-0 mt-0.5">①</span>
                <span>Gehe auf deinen <strong>zugewiesenen Kamera-Platz</strong> (steht in der Nachricht vom Trainer)</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-foreground/80">
                <span className="text-primary flex-shrink-0 mt-0.5">②</span>
                <span>Stelle das Handy auf ein <strong>Stativ oder lege es stabil ab</strong> — nicht in der Hand halten</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-foreground/80">
                <span className="text-primary flex-shrink-0 mt-0.5">③</span>
                <span>Code eingeben → Kamera startet automatisch</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-foreground/80">
                <span className="text-primary flex-shrink-0 mt-0.5">④</span>
                <span><strong>Bildschirm nicht sperren</strong> — Energiesparmodus deaktivieren</span>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-3">
              📱 Kein Konto nötig · Link als Lesezeichen speichern
            </p>
          </motion.div>
        )}

        {/* ── CONNECTING ── */}
        {step === 'connecting' && (
          <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass rounded-2xl p-10 text-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <div className="font-grotesk font-semibold text-foreground">Verbinde mit Spiel...</div>
            <div className="text-xs text-muted-foreground mt-2">Kamera-Berechtigungen werden angefragt</div>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass rounded-2xl p-7 w-full max-w-sm text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="font-grotesk font-bold text-foreground mb-2">Verbindung fehlgeschlagen</h2>
            <p className="text-sm text-muted-foreground mb-2">{errorMsg}</p>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-5 text-xs text-yellow-400 text-left space-y-1">
              <div className="font-bold mb-1">Was tun?</div>
              <div>① Trainer muss zuerst eine Live-Session in TactIQ starten</div>
              <div>② Code nochmals prüfen (6 Ziffern, keine Buchstaben)</div>
              <div>③ Internetverbindung prüfen</div>
            </div>
            <Button onClick={() => { setStep('enter'); setCode(''); }} className="w-full bg-primary text-primary-foreground">
              Nochmal versuchen
            </Button>
          </motion.div>
        )}

        {/* ── LIVE ── */}
        {step === 'live' && (
          <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md space-y-3">

            {/* Status Bar */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400 font-bold">LIVE</span>
                <span className="text-xs text-muted-foreground">{sessionInfo?.match_title}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-primary" />
                <span>{formatUptime(uptime)}</span>
                {camLabel && <span className="text-primary font-medium">· {camLabel}</span>}
              </div>
            </div>

            {/* Video */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 bg-black/70 rounded-lg px-2 py-1 text-[10px] text-white font-bold flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> REC
              </div>
            </div>

            {/* !! WICHTIG: Bewegungs-Warnung - Key Feature !! */}
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-3">
              <Lock className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-destructive mb-1">Kamera NICHT bewegen!</div>
                <div className="text-[11px] text-foreground/70 leading-relaxed">
                  Kein Schwenken · Kein Wackeln · Kein Zoomen während des Spiels.<br />
                  Die KI-Analyse funktioniert nur bei <strong>fixer, stabiler Kameraposition</strong>.
                </div>
              </div>
            </div>

            {/* Position Tip */}
            {camLabel && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{positionTip.icon}</span>
                <div>
                  <div className="text-xs font-bold text-primary mb-0.5">{camLabel}</div>
                  <div className="text-[11px] text-foreground/70">{positionTip.tip}</div>
                </div>
              </div>
            )}

            {/* Tips Toggle */}
            <button onClick={() => setShowTips(s => !s)}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 py-1">
              <Move className="w-3 h-3" />
              {showTips ? 'Tipps ausblenden' : 'Positionierungs-Tipps anzeigen'}
            </button>

            <AnimatePresence>
              {showTips && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="glass rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-foreground uppercase tracking-wide">📐 Optimale Kameraposition</div>
                    {[
                      { icon: '✅', text: 'Erhöhte Position: Tribüne, Balkon, Leiter, Dach' },
                      { icon: '✅', text: 'Kamera auf Stativ, Geländer oder fester Fläche' },
                      { icon: '✅', text: 'Gesamtes Spielfeld oder zugewiesene Hälfte im Bild' },
                      { icon: '✅', text: 'Kamera im Querformat (Landscape) halten' },
                      { icon: '❌', text: 'NICHT schwenken — KI verliert Tracking' },
                      { icon: '❌', text: 'NICHT zoomen — Perspektive muss konstant bleiben' },
                      { icon: '❌', text: 'NICHT in der Hand halten — zu viel Wackeln' },
                      { icon: '❌', text: 'NICHT gegen die Sonne filmen' },
                    ].map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="flex-shrink-0">{t.icon}</span>
                        <span className="text-foreground/80">{t.text}</span>
                      </div>
                    ))}
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 text-[10px] text-yellow-400">
                      <strong>Warum?</strong> Die KI berechnet Spielerpositionen relativ zu festen Feldmarkierungen. Sobald die Kamera schwenkt, verliert das System die Kalibrierung und das Tracking wird unbrauchbar.
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={flipCamera}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all text-sm font-medium">
                <RotateCcw className="w-4 h-4" /> Kamera wechseln
              </button>
              <button onClick={handleStop}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all text-sm font-medium">
                <AlertTriangle className="w-4 h-4" /> Beenden
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center pb-2">
              ⚡ Bildschirm nicht sperren · Energiesparmodus deaktivieren · WLAN bevorzugen
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}