/**
 * SimpleCameraAssistant — Kameramann-Ansicht
 * Startet Kamera, sendet Heartbeat + Thumbnails an LiveSession → Trainer sieht "Online"
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Camera, CameraOff } from 'lucide-react';
import EventButtons from './EventButtons';
import FunkPanel from './FunkPanel';
import useWebRTCCamera from '@/hooks/useWebRTCCamera';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function SimpleCameraAssistant() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  const cameraId = urlParams.get('cam') || '1';

  const [session, setSession] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showFunk, setShowFunk] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [camStatus, setCamStatus] = useState('starting'); // starting | active | error
  const [isConnected, setIsConnected] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const heartbeatRef = useRef(null);
  const thumbnailRef = useRef(null);

  // WebRTC: sendet echten Livestream an Trainer
  useWebRTCCamera({
    sessionId,
    cameraId,
    stream: mediaStream,
    enabled: camStatus === 'active' && !!sessionId && !!mediaStream,
  });

  // Load session
  useEffect(() => {
    if (!sessionId) return;
    base44.entities.LiveSession.filter({ id: sessionId })
      .then(sessions => setSession(sessions[0]))
      .catch(() => {});
  }, [sessionId]);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── START CAMERA ──────────────────────────────────────────────────────────
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
        setMediaStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCamStatus('active');
      } catch (e) {
        console.warn('Camera error:', e);
        setCamStatus('error');
      }
    };
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── CAPTURE THUMBNAIL ─────────────────────────────────────────────────────
  const captureThumbnail = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 180;
    ctx.drawImage(video, 0, 0, 320, 180);
    return canvas.toDataURL('image/jpeg', 0.6);
  }, []);

  // ── HEARTBEAT + THUMBNAIL → LiveSession ──────────────────────────────────
  const sendHeartbeat = useCallback(async (withThumbnail = false) => {
    if (!sessionId) return;
    try {
      const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
      const current = sessions[0];
      if (!current) return;

      const thumbnail = withThumbnail ? captureThumbnail() : undefined;

      const updatedStreams = (current.camera_streams || []).map(cam => {
        if (String(cam.camera_id) === String(cameraId)) {
          return {
            ...cam,
            status: 'connected',
            last_seen: new Date().toISOString(),
            ...(thumbnail ? { thumbnail } : {}),
          };
        }
        return cam;
      });

      await base44.entities.LiveSession.update(current.id, {
        camera_streams: updatedStreams,
      });
      setIsConnected(true);
    } catch (e) {
      console.warn('Heartbeat error:', e);
    }
  }, [sessionId, cameraId, captureThumbnail]);

  // Start heartbeat loop once session is loaded
  useEffect(() => {
    if (!sessionId || !session) return;

    // Immediate first heartbeat
    sendHeartbeat(false);

    // Heartbeat every 8s (status only)
    heartbeatRef.current = setInterval(() => sendHeartbeat(false), 8000);

    // Thumbnail every 20s
    thumbnailRef.current = setInterval(() => sendHeartbeat(true), 20000);

    // Send first thumbnail after 3s (video needs time to start)
    const firstThumb = setTimeout(() => sendHeartbeat(true), 3000);

    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(thumbnailRef.current);
      clearTimeout(firstThumb);
      // Mark as disconnected on unmount
      if (sessionId) {
        base44.entities.LiveSession.filter({ id: sessionId })
          .then(sessions => {
            const s = sessions[0];
            if (!s) return;
            const streams = (s.camera_streams || []).map(cam =>
              String(cam.camera_id) === String(cameraId)
                ? { ...cam, status: 'disconnected' }
                : cam
            );
            base44.entities.LiveSession.update(s.id, { camera_streams: streams }).catch(() => {});
          }).catch(() => {});
      }
    };
  }, [sessionId, session]);

  const handlePTT = async (active) => {
    setMicActive(active);
    if (!sessionId) return;
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from: `camera_${cameraId}`,
      from_label: session?.camera_streams?.find(c => String(c.camera_id) === String(cameraId))?.label || `Kamera ${cameraId}`,
      text: active ? '🎙️ Spricht...' : '📻 Fertig',
      is_ppt: true,
      ppt_active: active,
      timestamp_ms: Date.now(),
    }).catch(() => {});
  };

  if (!sessionId) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-center p-4">
        <div className="space-y-3">
          <div className="text-4xl">📹</div>
          <p className="font-bold text-lg">Kein Session-Link</p>
          <p className="text-sm text-gray-400">Öffne den Link vom Trainer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">

      {/* Hidden canvas for thumbnail capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* LIVE VIDEO — Vollbild */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Camera error overlay */}
      {camStatus === 'error' && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center text-white text-center p-6">
          <div className="space-y-3">
            <CameraOff className="w-12 h-12 mx-auto text-red-400" />
            <p className="font-bold">Kamerazugriff verweigert</p>
            <p className="text-sm text-gray-400">Bitte Kamera-Berechtigung erteilen und Seite neu laden</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary rounded-lg text-sm font-bold"
            >
              Neu laden
            </button>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 pt-3 pb-1">
        {/* LIVE Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/85 text-white text-xs font-bold backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE {formatTime(elapsedSeconds)}
          </div>
          {/* Connection Status */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm ${
            isConnected ? 'bg-green-600/80 text-white' : 'bg-black/60 text-gray-300'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
            {isConnected ? 'Verbunden' : 'Verbinde...'}
          </div>
        </div>

        {/* Events Toggle */}
        <motion.button
          animate={{ scale: showEvents ? 1.05 : 1 }}
          onClick={() => { setShowEvents(!showEvents); setShowFunk(false); }}
          className="px-3 py-1.5 rounded-lg text-sm font-bold bg-primary/90 text-primary-foreground backdrop-blur-sm"
        >
          {showEvents ? '✕' : '⚽ Events'}
        </motion.button>
      </div>

      {/* EVENTS PANEL */}
      <AnimatePresence>
        {showEvents && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 right-2 left-2 z-20 bg-black/90 backdrop-blur p-3 rounded-xl border border-white/10 max-h-64 overflow-y-auto"
          >
            <EventButtons
              sessionId={sessionId}
              matchId={session?.match_id}
              matchTitle={session?.match_title}
              source={`camera_${cameraId}`}
              elapsedSeconds={elapsedSeconds}
              compact={true}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FUNK PANEL */}
      <AnimatePresence>
        {showFunk && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute inset-0 z-30 bg-background flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0">
              <span className="text-sm font-bold">📻 Funk-Kanal</span>
              <button
                onClick={() => setShowFunk(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted text-foreground font-bold text-lg"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <FunkPanel sessionId={sessionId} onClose={() => setShowFunk(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM CONTROLS */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black via-black/70 to-transparent p-4 space-y-3">
        {/* Camera label */}
        {session && (
          <div className="text-center text-xs text-white/60 font-medium">
            {session.match_title} · {session.camera_streams?.find(c => String(c.camera_id) === String(cameraId))?.label || `Kamera ${cameraId}`}
          </div>
        )}

        {/* PTT Button */}
        <button
          onMouseDown={() => handlePTT(true)}
          onMouseUp={() => handlePTT(false)}
          onTouchStart={(e) => { e.preventDefault(); handlePTT(true); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePTT(false); }}
          className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all active:scale-95 select-none ${
            micActive ? 'bg-primary neon-glow' : 'bg-white/20 border border-white/30'
          }`}
        >
          {micActive
            ? <><Mic className="w-6 h-6 inline mr-2" />SPRECHEN</>
            : <><MicOff className="w-6 h-6 inline mr-2" />Halten zum Sprechen</>
          }
        </button>

        {/* Funk Button */}
        <button
          onClick={() => { setShowFunk(!showFunk); setShowEvents(false); }}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
            showFunk ? 'bg-primary text-primary-foreground' : 'bg-white/20 border border-white/30 text-white'
          }`}
        >
          📻 {showFunk ? 'Schließen' : 'Funk-Kanal'}
        </button>
      </div>
    </div>
  );
}