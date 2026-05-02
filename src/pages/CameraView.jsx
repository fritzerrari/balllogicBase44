/**
 * CameraView — Mobile Vollbild-Kamera
 * Robuste Version: stabile Refs, kein stale-closure Problem, schnelle Kamera-Init
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import useDeviceOrientation from '@/hooks/useDeviceOrientation';
import useCameraHeartbeat from '@/hooks/useCameraHeartbeat';
import {
  Camera, Zap, CheckCircle2, Loader2, RotateCcw,
  Clock, Wifi, WifiOff, Battery, BatteryLow,
  ChevronUp, ChevronDown, X, Mic, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import CameraFunkPanel from '@/components/live/CameraFunkPanel';

const DIGITS = 6;
const POLL_INTERVAL_MS = 5000; // Reduziert von 3s auf 5s
const HEARTBEAT_INTERVAL_MS = 15000; // Reduziert von 10s auf 15s

const QUICK_EVENTS = [
  { key: 'goal',        label: 'TOR',     icon: '⚽', color: 'bg-primary/90 text-primary-foreground' },
  { key: 'chance',      label: 'Chance',  icon: '🎯', color: 'bg-yellow-500/80 text-black' },
  { key: 'yellow_card', label: 'Gelb',    icon: '🟨', color: 'bg-yellow-400/70 text-black' },
  { key: 'red_card',    label: 'Rot',     icon: '🟥', color: 'bg-red-500/80 text-white' },
  { key: 'corner',      label: 'Ecke',    icon: '📐', color: 'bg-blue-500/70 text-white' },
  { key: 'foul',        label: 'Foul',    icon: '⛔', color: 'bg-orange-500/70 text-white' },
  { key: 'substitution',label: 'Wechsel', icon: '🔄', color: 'bg-purple-500/70 text-white' },
  { key: 'offside',     label: 'Abseits', icon: '🚩', color: 'bg-gray-500/70 text-white' },
];

function formatUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function matchCode(session, code) {
  if (!session?.camera_streams?.length) return false;
  return session.camera_streams.some(cam => String(cam.code).trim() === String(code).trim());
}

export default function CameraView() {
  const urlParams = new URLSearchParams(window.location.search);
  const prefillCode = urlParams.get('code') || sessionStorage.getItem('cam_code') || '';
  const prefillPos  = urlParams.get('pos')  || sessionStorage.getItem('cam_pos')  || '';

  const [code, setCode]           = useState(prefillCode);
  const [step, setStep]           = useState('enter'); // always start at enter, auto-connect via effect
  const [waitMsg, setWaitMsg]     = useState('Warte auf Session-Start...');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [camLabel, setCamLabel]   = useState(prefillPos);
  const [facingMode, setFacingMode] = useState('environment');
  const [uptime, setUptime]       = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [connQuality, setConnQuality] = useState('good');
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [halfTime, setHalfTime]   = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [teamPicker, setTeamPicker] = useState(null);
  const [flashEvent, setFlashEvent] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [recentEvents, setRecentEvents] = useState([]);

  // Refs — use refs for values used inside intervals/callbacks to avoid stale closures
  const videoRef         = useRef(null);
  const canvasRef        = useRef(null);
  const streamRef        = useRef(null);
  const heartbeatRef     = useRef(null);
  const uptimeRef        = useRef(null);
  const pollRef          = useRef(null);
  const sessionCodeRef   = useRef(prefillCode);
  const uptimeValueRef   = useRef(0); // always current uptime without dep
  const halfTimeRef      = useRef(1);
  const sessionInfoRef   = useRef(null);
  const audioCtxRef      = useRef(null);
  const audioIntervalRef = useRef(null);
  const lastEventTimeRef = useRef({});
  const thumbIntervalRef = useRef(null);
  const stepRef          = useRef('enter');

  // Orientation detection (nach videoRef init)
  const { orientation, isPortrait } = useDeviceOrientation(videoRef);

  // Camera Heartbeat — sendet Status an LiveSession
  useCameraHeartbeat(sessionInfo?.id, sessionCodeRef.current, camLabel, step === 'live');

  // Keep refs in sync
  useEffect(() => { uptimeValueRef.current = uptime; }, [uptime]);
  useEffect(() => { halfTimeRef.current = halfTime; }, [halfTime]);
  useEffect(() => { sessionInfoRef.current = sessionInfo; }, [sessionInfo]);
  useEffect(() => { stepRef.current = step; }, [step]);

  // ── Battery ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(bat => {
      setBatteryLevel(Math.round(bat.level * 100));
      bat.addEventListener('levelchange', () => setBatteryLevel(Math.round(bat.level * 100)));
    }).catch(() => {});
  }, []);

  // ── Wake Lock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'live') return;
    let wakeLock = null;
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(wl => { wakeLock = wl; }).catch(() => {});
    }
    return () => { if (wakeLock) wakeLock.release().catch(() => {}); };
  }, [step]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { clearAllTimers(); stopStream(); stopAudio(); };
  }, []);

  const clearAllTimers = () => {
    clearInterval(heartbeatRef.current);
    clearInterval(uptimeRef.current);
    clearInterval(pollRef.current);
    clearInterval(audioIntervalRef.current);
    clearInterval(thumbIntervalRef.current);
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const stopAudio = () => {
    clearInterval(audioIntervalRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    setAudioEnabled(false);
  };

  // ── Camera — fast: only 3 tries, skip 4K ─────────────────────────────────
  const startCamera = useCallback(async (facing = 'environment') => {
    stopStream();
    setCameraError(null);
    const tries = [
      { video: { facingMode: { exact: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
      { video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: facing } },
    ];
    for (const c of tries) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c);
        streamRef.current = stream;
        // Try wide-angle via applyConstraints (non-blocking)
        try {
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities?.();
          if (caps?.zoom) track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] }).catch(() => {});
        } catch (_) {}
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
        return true;
      } catch (_) {}
    }
    setCameraError('Kamera-Berechtigung fehlt oder nicht verfügbar');
    return false;
  }, []);

  // ── Thumbnail push: first after 1s, then every 3s ───────────────────────
  const startThumbnailPush = useCallback((sessionId, codeStr) => {
    clearInterval(thumbIntervalRef.current);
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;

    const pushThumb = async () => {
      try {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return; // Warte bis Video vorhanden (auch ohne vollständig geladen)
        
        // Canvas render — mit Fehlerbehandlung
        let thumbnail = null;
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, 320, 180);
          thumbnail = canvas.toDataURL('image/jpeg', 0.6); // 0.6 für bessere Qualität
        } catch (canvasErr) {
          // Canvas-Fehler? Ignorieren, nächster Versuch
          return;
        }

        if (!thumbnail) return;

        // Suche Session direkt nach ID — keine Status-Filter!
        const allSessions = await base44.entities.LiveSession.list('-created_date', 100);
        const fresh = allSessions.find(s => s.id === sessionId);
        if (!fresh) return;

        // Update Kamera in dieser Session
        const updatedStreams = (fresh.camera_streams || []).map(cam =>
          String(cam.code).trim() === codeStr 
            ? { ...cam, thumbnail, status: 'connected', last_seen: new Date().toISOString() } 
            : cam
        );

        await base44.entities.LiveSession.update(sessionId, { camera_streams: updatedStreams });
      } catch (err) {
        // Stiller Fehler — wird beim nächsten Interval versucht
      }
    };

    // First push nach 1s (schnell für Trainer-Feedback)
    setTimeout(pushThumb, 1000);
    // Dann alle 3s pushen
    thumbIntervalRef.current = setInterval(pushThumb, 3000);
  }, []);

  // ── Simple audio detection (no uptime dep) ────────────────────────────────
  const startAudioDetection = useCallback(async (sessionId, matchTitle, source) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.frequencyBinCount);
      let consecutiveHigh = 0;

      audioIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > 60) {
          consecutiveHigh++;
          if (consecutiveHigh === 3) {
            const now = Date.now();
            if (now - (lastEventTimeRef.current['goal'] || 0) > 30000) {
              lastEventTimeRef.current['goal'] = now;
              const curUptime = uptimeValueRef.current;
              base44.entities.MatchEvent.create({
                session_id: sessionId, match_title: matchTitle,
                type: 'goal', team: 'unknown',
                minute: Math.floor(curUptime / 60), elapsed_seconds: curUptime,
                description: '⚽ TOR (KI-Erkennung)',
                source: `${source}_auto`, timestamp_ms: now, is_duplicate: false,
              }).catch(() => {});
              setFlashEvent({ key: 'goal', auto: true });
              setTimeout(() => setFlashEvent(null), 2000);
            }
          }
        } else {
          consecutiveHigh = 0;
        }
      }, 500);
      setAudioEnabled(true);
    } catch (_) {}
  }, []); // no deps — uses ref for uptime

  // ── Heartbeat — uses refs to avoid stale closures ─────────────────────────
  const startHeartbeat = useCallback((initialSession, codeStr) => {
    clearInterval(heartbeatRef.current);
    let degraded = 0;
    heartbeatRef.current = setInterval(async () => {
      try {
        const sessions = await base44.entities.LiveSession.filter({ status: 'active' });
        const fresh = sessions.find(s => s.id === initialSession.id);
        if (!fresh) {
          degraded++;
          setConnQuality('degraded');
          if (degraded >= 3) { clearInterval(heartbeatRef.current); setStep('ended'); }
          return;
        }
        degraded = 0;
        setConnQuality('good');
        // Update halfTime via ref comparison
        if (fresh.half_time && fresh.half_time !== halfTimeRef.current) {
          setHalfTime(fresh.half_time);
        }
        // Update camera last_seen
        const updatedStreams = (fresh.camera_streams || []).map(cam =>
          String(cam.code).trim() === codeStr
            ? { ...cam, status: 'connected', last_seen: new Date().toISOString() }
            : cam
        );
        base44.entities.LiveSession.update(fresh.id, { camera_streams: updatedStreams }).catch(() => {});
      } catch (_) {
        degraded++;
        setConnQuality('degraded');
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, []); // no deps — uses refs

  // ── Polling ───────────────────────────────────────────────────────────────
  const startPolling = useCallback((codeInput) => {
    const codeStr = String(codeInput || '').trim();
    if (codeStr.length !== DIGITS) return;
    sessionCodeRef.current = codeStr;
    // Persist so a page refresh auto-reconnects
    sessionStorage.setItem('cam_code', codeStr);
    if (prefillPos) sessionStorage.setItem('cam_pos', prefillPos);
    setStep('waiting');
    setWaitMsg('Warte auf Session-Start...');
    clearInterval(pollRef.current);

    // Start camera in parallel (don't await)
    startCamera('environment');

    let count = 0;
    const poll = async () => {
      count++;
      try {
        // Batch-Anfrage: beide Status in einer Liste
        const allSessions = await base44.entities.LiveSession.list('-created_date', 100);
        const matched = allSessions.find(s => matchCode(s, codeStr));
        if (matched) {
          clearInterval(pollRef.current);
          const cam = matched.camera_streams?.find(c => String(c.code).trim() === codeStr);
          if (cam?.label) setCamLabel(cam.label);
          setSessionInfo(matched);
          setHalfTime(matched.half_time || 1);
          halfTimeRef.current = matched.half_time || 1;
          setStep('live');
          // Start uptime timer
          uptimeValueRef.current = 0;
          setUptime(0);
          uptimeRef.current = setInterval(() => {
            uptimeValueRef.current += 1;
            setUptime(t => t + 1);
          }, 1000);
          startHeartbeat(matched, codeStr);
          // Audio-Detection deaktiviert (verursacht Rate-Limiting)
          // const src = cam?.label ? `camera_${cam.label}` : 'camera_1';
          // startAudioDetection(matched.id, matched.match_title, src);
          startThumbnailPush(matched.id, codeStr);
          return;
        }
        setWaitMsg(count < 10
          ? `Warte auf Session... (${count * 5}s)`
          : `Warte auf Trainer. (${Math.round(count * 5 / 60)}min gewartet)`
        );
      } catch (_) {
        setWaitMsg('Verbindungsproblem — wird wiederholt...');
      }
    };
    poll(); // immediate first check
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [startCamera, startHeartbeat, startAudioDetection, startThumbnailPush]);

  // ── Auto-connect when code in URL ─────────────────────────────────────────
  useEffect(() => {
    if (prefillCode.length === DIGITS) {
      startPolling(prefillCode);
    }
  }, []); // eslint-disable-line

  // Canvas render loop für stabiles Video-Rendering — BEFORE all early returns
  useEffect(() => {
    if (step !== 'live' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    let frameId = null;

    const renderFrame = () => {
      if (video && video.readyState >= 2) {
        try {
          canvas.width = video.videoWidth || 720;
          canvas.height = video.videoHeight || 1280;
          ctx.drawImage(video, 0, 0);
        } catch (_) {}
      }
      frameId = requestAnimationFrame(renderFrame);
    };

    renderFrame();
    return () => cancelAnimationFrame(frameId);
  }, [step]);

  // ── Event tap ─────────────────────────────────────────────────────────────
  const tapEvent = (evtKey, team = 'unknown') => {
    const evt = QUICK_EVENTS.find(e => e.key === evtKey);
    if (!evt) return;
    const now = Date.now();
    const curUptime = uptimeValueRef.current;
    const si = sessionInfoRef.current;
    const eventData = {
      session_id: si?.id || 'local',
      match_title: si?.match_title || '',
      type: evt.key, team,
      minute: Math.floor(curUptime / 60), elapsed_seconds: curUptime,
      description: `${evt.icon} ${evt.label}${team !== 'unknown' ? ` (${team === 'home' ? 'Heim' : 'Gäste'})` : ''}`,
      source: `camera_${camLabel || '1'}`,
      timestamp_ms: now, is_duplicate: false,
    };
    if (si?.id) base44.entities.MatchEvent.create(eventData).catch(() => {});
    setRecentEvents(prev => [{ ...eventData, id: `local-${now}`, time: formatUptime(curUptime) }, ...prev].slice(0, 5));
    setFlashEvent({ key: evt.key, auto: false });
    setTimeout(() => setFlashEvent(null), 800);
    setSheetOpen(false);
    setTeamPicker(null);
  };

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next); // non-blocking
  };

  const handleStop = () => {
    clearAllTimers(); stopStream(); stopAudio();
    sessionStorage.removeItem('cam_code');
    sessionStorage.removeItem('cam_pos');
    setStep('enter'); setCode(''); setUptime(0);
    uptimeValueRef.current = 0;
    setSessionInfo(null); sessionInfoRef.current = null;
    setCamLabel(prefillPos); setRecentEvents([]);
  };

  // ── CODE EINGABE ──────────────────────────────────────────────────────────
  if (step === 'enter') return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-5">
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
        <Camera className="w-14 h-14 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-grotesk font-bold text-foreground text-center mb-1">Kamera starten</h1>
        <p className="text-sm text-muted-foreground text-center mb-5">6-stelligen Code vom Trainer eingeben</p>
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
          className="w-full bg-primary text-primary-foreground h-14 text-lg font-bold rounded-xl neon-glow">
          Verbinden →
        </Button>
      </div>
    </div>
  );

  // ── WARTEN ────────────────────────────────────────────────────────────────
  if (step === 'waiting') return (
    <div className="min-h-screen bg-black relative flex flex-col">
      <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-black/80 backdrop-blur rounded-2xl p-6 w-full max-w-sm border border-white/10">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-3" />
          <div className="font-grotesk font-bold text-white text-lg mb-1">Warte auf Trainer</div>
          <div className="text-sm text-white/60 mb-4">{waitMsg}</div>
          <div className="bg-primary/15 border border-primary/30 rounded-xl p-3 text-xs text-primary text-left mb-4">
            <div className="font-bold mb-1">✓ Kamera läuft bereits</div>
            <div>Code: <span className="font-mono font-bold tracking-widest">{sessionCodeRef.current}</span></div>
          </div>
          <Button variant="outline" onClick={handleStop} className="w-full border-white/20 text-white/60 text-xs">
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );

  // ── SESSION BEENDET ───────────────────────────────────────────────────────
  if (step === 'ended') return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-7 w-full max-w-sm text-center">
        <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
        <h2 className="font-grotesk font-bold text-foreground text-xl mb-2">Session beendet</h2>
        <p className="text-sm text-muted-foreground mb-5">Die Live-Session wurde beendet.</p>
        <Button onClick={handleStop} className="w-full bg-primary text-primary-foreground">Neue Session</Button>
      </div>
    </div>
  );

  // ── LIVE ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black overflow-hidden" data-orientation={orientation}>
      {/* Fallback video für Metadaten */}
      <video ref={videoRef} autoPlay muted playsInline
        className="hidden"
        style={{ display: 'none' }} />
      {/* Canvas für stabiles Rendering */}
      <canvas ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: step === 'live' ? 'block' : 'none' }} />

      {/* Grid lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-0 right-0 border-t border-white/10" />
        <div className="absolute top-2/3 left-0 right-0 border-t border-white/10" />
        <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/10" />
        <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/10" />
      </div>

      {/* Camera error overlay */}
      {cameraError && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 z-20">
          <Camera className="w-12 h-12 text-muted-foreground mb-3" />
          <div className="text-white text-sm text-center mb-4">{cameraError}</div>
          <Button onClick={() => startCamera(facingMode)} className="bg-primary text-primary-foreground">
            Kamera erlauben
          </Button>
        </div>
      )}

      {/* HUD Toggle Button */}
      <button
        onClick={() => setHudVisible(o => !o)}
        className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/50 border border-white/20 flex items-center justify-center hover:bg-black/70 transition-all text-white/60 hover:text-white"
        title={hudVisible ? 'HUD ausblenden' : 'HUD einblenden'}>
        {hudVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>

      {/* HUD Top */}
      {hudVisible && (
      <div className="absolute top-0 left-0 right-0 z-10 p-3 flex items-start justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="bg-black/70 backdrop-blur rounded-lg px-2.5 py-1 text-[11px] text-white font-bold flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC
          </div>
          <div className={`bg-black/70 backdrop-blur rounded-lg px-2 py-1 text-[11px] font-bold flex items-center gap-1 ${connQuality === 'good' ? 'text-primary' : 'text-yellow-400'}`}>
            {connQuality === 'good' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </div>
          {batteryLevel !== null && (
            <div className={`bg-black/70 backdrop-blur rounded-lg px-2 py-1 text-[11px] font-bold flex items-center gap-1 ${batteryLevel <= 20 ? 'text-red-400' : 'text-white'}`}>
              {batteryLevel <= 20 ? <BatteryLow className="w-3 h-3" /> : <Battery className="w-3 h-3" />}
              {batteryLevel}%
            </div>
          )}
          {audioEnabled && (
            <div className="bg-primary/70 backdrop-blur rounded-lg px-2 py-1 text-[11px] font-bold text-primary-foreground flex items-center gap-1">
              <Mic className="w-3 h-3" /> KI
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="bg-black/70 backdrop-blur rounded-lg px-2.5 py-1 text-[11px] text-white font-mono text-right">
            <div className="font-bold tabular-nums">{formatUptime(uptime)}</div>
            <div className="text-white/50 text-[9px]">{halfTime}. HZ{camLabel ? ` · ${camLabel}` : ''}</div>
          </div>
          <button onClick={flipCamera}
            className="w-9 h-9 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white active:scale-90">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
      )}

      {/* Halfime banner */}
      {halfTime === 2 && (
        <div className="absolute top-16 left-0 right-0 z-10 mx-4">
          <div className="bg-yellow-500/90 backdrop-blur rounded-xl px-4 py-2 flex items-center gap-2 justify-center">
            <Clock className="w-4 h-4 text-black" />
            <span className="text-xs font-bold text-black">2. HALBZEIT — Seitenwechsel!</span>
          </div>
        </div>
      )}

      {/* Event Flash */}
      <AnimatePresence>
        {flashEvent && (
          <motion.div key="flash"
            initial={{ opacity: 0, scale: 1.3 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="bg-primary/90 backdrop-blur rounded-2xl px-8 py-5 text-center shadow-2xl">
              {flashEvent.key === 'goal' && <div className="text-5xl mb-1">⚽</div>}
              <div className="text-primary-foreground font-grotesk font-bold text-lg">
                {flashEvent.auto ? 'TOR erkannt! ✓' : '✓ Gespeichert'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed reminder */}
      {hudVisible && (
      <div className="absolute bottom-32 left-0 right-0 z-10 flex justify-center pointer-events-none">
        <div className="bg-red-500/80 backdrop-blur rounded-full px-3 py-1 text-[10px] font-bold text-white">
          KAMERA FIXIERT LASSEN
        </div>
      </div>
      )}

      {/* Team Picker */}
      <AnimatePresence>
        {teamPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 z-30 flex items-center justify-center p-6"
            onClick={() => setTeamPicker(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-xs"
              onClick={e => e.stopPropagation()}>
              <div className="text-center mb-4">
                <div className="text-3xl mb-1">{QUICK_EVENTS.find(e => e.key === teamPicker)?.icon}</div>
                <div className="font-grotesk font-bold text-foreground">{QUICK_EVENTS.find(e => e.key === teamPicker)?.label}</div>
                <div className="text-xs text-muted-foreground mt-1">Für welches Team?</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => tapEvent(teamPicker, 'home')}
                  className="py-5 rounded-xl bg-primary/15 border border-primary/30 text-primary font-bold text-base active:scale-95 transition-all">
                  🏠 Heim
                </button>
                <button onClick={() => tapEvent(teamPicker, 'away')}
                  className="py-5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-base active:scale-95 transition-all">
                  ✈️ Gäste
                </button>
              </div>
              <button onClick={() => tapEvent(teamPicker, 'unknown')}
                className="w-full mt-3 py-2 text-xs text-muted-foreground">
                Ohne Team
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Sheet */}
      {hudVisible && (
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <CameraFunkPanel sessionId={sessionInfo?.id} camLabel={camLabel} />

        {/* Toggle */}
        <button
          onClick={() => setSheetOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 bg-black/80 backdrop-blur border-t border-white/10"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">📋 Events</span>
            {recentEvents.length > 0 && (
              <span className="text-xs text-primary truncate max-w-[140px]">{recentEvents[0].description?.split(' ').slice(0,3).join(' ')}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); handleStop(); }}
              className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded-lg px-2.5 py-1 text-red-400 text-xs font-bold">
              <X className="w-3 h-3" /> Beenden
            </button>
            {sheetOpen ? <ChevronDown className="w-4 h-4 text-white/60" /> : <ChevronUp className="w-4 h-4 text-white/60" />}
          </div>
        </button>

        {/* Expanded Grid */}
        <AnimatePresence>
          {sheetOpen && (
            <motion.div
              initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="overflow-hidden bg-black/90 backdrop-blur border-t border-white/10">
              <div className="p-3 grid grid-cols-4 gap-2">
                {QUICK_EVENTS.map(evt => (
                  <button key={evt.key}
                    onClick={() => setTeamPicker(evt.key)}
                    className={`${evt.color} rounded-xl py-4 flex flex-col items-center gap-1 active:scale-95 transition-all touch-manipulation`}>
                    <span className="text-2xl">{evt.icon}</span>
                    <span className="text-xs font-bold">{evt.label}</span>
                  </button>
                ))}
              </div>
              {recentEvents.length > 0 && (
                <div className="px-3 pb-3 space-y-1">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Zuletzt</div>
                  {recentEvents.slice(0, 3).map(ev => (
                    <div key={ev.id} className="flex items-center gap-2 text-xs text-white/60">
                      <span className="font-mono text-primary/80">{ev.time}</span>
                      <span>{ev.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed: 4 quick buttons */}
        {!sheetOpen && (
          <div className="grid grid-cols-4 gap-1.5 px-3 py-2 bg-black/80 backdrop-blur">
            {QUICK_EVENTS.slice(0, 4).map(evt => (
              <button key={evt.key}
                onClick={() => setTeamPicker(evt.key)}
                className={`${evt.color} rounded-xl py-3 flex flex-col items-center gap-0.5 active:scale-95 transition-all touch-manipulation`}>
                <span className="text-xl">{evt.icon}</span>
                <span className="text-[10px] font-bold">{evt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}