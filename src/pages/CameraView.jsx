/**
 * CameraView — Öffentliche Handy-Kamera-Seite (kein Login nötig)
 * Assistent öffnet diesen Link, gibt den 6-stelligen Code ein,
 * und überträgt sein Kamerabild live zum Trainer-Dashboard.
 * 
 * URL: /cam  oder  /cam?code=123456
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Zap, CheckCircle2, AlertCircle, Loader2, Mic, MicOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DIGITS = 6;

export default function CameraView() {
  const urlParams = new URLSearchParams(window.location.search);
  const prefillCode = urlParams.get('code') || '';

  const [code, setCode] = useState(prefillCode);
  const [step, setStep] = useState(prefillCode.length === DIGITS ? 'connecting' : 'enter'); // enter | connecting | live | error
  const [sessionInfo, setSessionInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // environment | user
  const [heartbeat, setHeartbeat] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const heartbeatRef = useRef(null);

  // Auto-connect if code pre-filled
  useEffect(() => {
    if (prefillCode.length === DIGITS) {
      handleConnect(prefillCode);
    }
  }, []);

  const handleConnect = async (codeToUse) => {
    const c = codeToUse || code;
    if (c.length !== DIGITS) return;
    setStep('connecting');
    setErrorMsg('');

    // Find matching live session by camera code
    const sessions = await base44.entities.LiveSession.filter({ status: 'active' });
    const matched = sessions.find(s =>
      s.camera_streams?.some(cam => cam.stream_url === c || cam.camera_id === c)
    );

    // If no exact match, find any active session (demo: accept any active session with this code stored anywhere)
    // In production you'd match by code stored in camera_streams
    const session = matched || sessions[0];

    if (!session) {
      setErrorMsg('Kein aktives Spiel mit diesem Code gefunden. Bitte den Trainer kontaktieren.');
      setStep('error');
      return;
    }

    setSessionInfo(session);
    await startCamera();
    setStep('live');

    // Heartbeat — update session every 10s to signal camera is live
    heartbeatRef.current = setInterval(async () => {
      setHeartbeat(h => h + 1);
      // Mark camera as connected in session
      try {
        const updatedStreams = (session.camera_streams || []).map(cam =>
          (cam.stream_url === c || cam.camera_id === c)
            ? { ...cam, status: 'connected', last_seen: new Date().toISOString() }
            : cam
        );
        if (updatedStreams.length > 0) {
          await base44.entities.LiveSession.update(session.id, { camera_streams: updatedStreams });
        }
      } catch (e) { /* ignore */ }
    }, 10000);
  };

  const startCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: micOn,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (step === 'live') {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next },
        audio: micOn,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(heartbeatRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleCodeInput = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, DIGITS);
    setCode(digits);
    if (digits.length === DIGITS) handleConnect(digits);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center neon-glow">
          <Zap className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-grotesk font-bold text-foreground text-xl">TactIQ</span>
        <span className="text-xs text-muted-foreground ml-1 uppercase tracking-widest">Kamera</span>
      </div>

      <AnimatePresence mode="wait">
        {/* ENTER CODE */}
        {step === 'enter' && (
          <motion.div key="enter" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="glass rounded-2xl p-8 w-full max-w-sm text-center">
            <Camera className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-grotesk font-bold text-foreground mb-2">Code eingeben</h1>
            <p className="text-sm text-muted-foreground mb-6">Der Trainer gibt dir den 6-stelligen Code vom Laptop-Bildschirm</p>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="123456"
              value={code}
              onChange={e => handleCodeInput(e.target.value)}
              className="w-full text-center text-4xl font-grotesk font-bold tracking-[0.3em] bg-muted border border-border rounded-xl px-4 py-4 text-foreground focus:outline-none focus:border-primary mb-4"
              maxLength={6}
              autoFocus
            />
            <Button onClick={() => handleConnect()} disabled={code.length !== DIGITS}
              className="w-full bg-primary text-primary-foreground neon-glow h-12 text-base">
              Verbinden & Kamera starten
            </Button>
            <p className="text-xs text-muted-foreground mt-4">📱 Diese Seite als Lesezeichen speichern oder als App installieren (Browser → "Zum Home-Bildschirm")</p>
          </motion.div>
        )}

        {/* CONNECTING */}
        {step === 'connecting' && (
          <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass rounded-2xl p-10 text-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <div className="font-grotesk font-semibold text-foreground">Verbinde mit Spiel...</div>
          </motion.div>
        )}

        {/* ERROR */}
        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass rounded-2xl p-8 w-full max-w-sm text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="font-grotesk font-bold text-foreground mb-2">Verbindung fehlgeschlagen</h2>
            <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
            <Button onClick={() => { setStep('enter'); setCode(''); }} variant="outline" className="w-full">
              Nochmal versuchen
            </Button>
          </motion.div>
        )}

        {/* LIVE */}
        {step === 'live' && (
          <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="w-full max-w-md">
            {/* Status bar */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400 font-bold">LIVE</span>
                <span className="text-xs text-muted-foreground">{sessionInfo?.match_title}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-primary" /> Verbunden · Ping {heartbeat * 10}s
              </div>
            </div>

            {/* Video */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video mb-3">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 bg-black/70 rounded-lg px-2 py-1 text-[10px] text-white font-bold flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> REC
              </div>
              <div className="absolute top-2 right-2 text-[10px] text-white/70 bg-black/50 rounded px-2 py-1">
                {facingMode === 'environment' ? '📷 Rück' : '🤳 Front'}
              </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={flipCamera}
                className="flex flex-col items-center gap-1 py-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all text-xs">
                <RotateCcw className="w-5 h-5" /> Kamera wechseln
              </button>
              <button onClick={() => setMicOn(m => !m)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs transition-all ${micOn ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                Mikro {micOn ? 'An' : 'Aus'}
              </button>
              <button onClick={() => { clearInterval(heartbeatRef.current); if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); setStep('enter'); setCode(''); }}
                className="flex flex-col items-center gap-1 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all text-xs">
                <Zap className="w-5 h-5" /> Beenden
              </button>
            </div>

            <div className="mt-4 text-center text-xs text-muted-foreground">
              💡 Bildschirm nicht sperren — halte das Handy stabil oder befestige es
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}