/**
 * CameraView — SUPER SIMPLE für Kameramann
 * Nur: Live Video + Event Buttons + Funk
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Mic, MicOff, Send, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EventButtons from '@/components/live/EventButtons';
import FunkPanel from '@/components/live/FunkPanel';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function CameraView() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  const cameraId = urlParams.get('cam') || '1';

  const [session, setSession] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showEvents, setShowEvents] = useState(false);
  const [showFunk, setShowFunk] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const frameIntervalRef = useRef(null);

  // Load session + mark as connected
  useEffect(() => {
    if (!sessionId) return;
    base44.entities.LiveSession.filter({ id: sessionId })
      .then(sessions => {
        const s = sessions[0] || null;
        setSession(s);
        if (s && s.camera_streams) {
          const camIdStr = String(cameraId);
          const updated = s.camera_streams.map(c =>
            String(c.camera_id) === camIdStr
              ? { ...c, status: 'connected', last_seen: new Date().toISOString() }
              : c
          );
          base44.entities.LiveSession.update(s.id, { camera_streams: updated }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [sessionId, cameraId]);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Start camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (e) {
        console.warn('Camera error:', e);
      }
    };
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      clearInterval(frameIntervalRef.current);
    };
  }, []);

  // Frame capture (3s interval)
  useEffect(() => {
    if (!sessionId) return;
    clearInterval(frameIntervalRef.current);

    let frameNumber = 0;

    const capture = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      if (!base64 || base64.length < 100) return;

      try {
        const res = await base44.functions.invoke('processFrame', {
          session_id: sessionId,
          frame_base64: base64,
          frame_number: frameNumber,
          elapsed_seconds: elapsedSeconds,
          camera_id: cameraId,
        });
        frameNumber++;
        
        if (res?.data?.success) {
          setTrackingStatus({
            status: res.data.ball_detected ? 'active' : 'partial',
            playerCount: res.data.players_detected || 0,
            ballDetected: res.data.ball_detected || false,
          });
        }
      } catch (e) {
        console.warn('Frame error:', e);
      }
    };

    frameIntervalRef.current = setInterval(capture, 3000);
    return () => clearInterval(frameIntervalRef.current);
  }, [sessionId, elapsedSeconds, cameraId]);

  const handlePTT = async (active) => {
    setMicActive(active);
    if (!sessionId) return;
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from: `camera_${cameraId}`,
      from_label: session?.camera_streams?.find(c => c.camera_id === cameraId)?.label || `Kamera ${cameraId}`,
      text: active ? '🎙 Kamera spricht...' : '📻 Kamera fertig',
      is_ppt: true,
      ppt_active: active,
      timestamp_ms: Date.now(),
    });
  };

  if (!sessionId) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-center p-6">
        <div>
          <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-bold mb-2">Kein Session-Link</p>
          <p className="text-sm text-gray-400">Öffne den Link vom Trainer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Full-screen video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-xs font-bold">LIVE</span>
          {session && <span className="text-white/60 text-xs">{session.match_title}</span>}
        </div>
        <div className="flex items-center gap-2">
          {trackingStatus && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              trackingStatus.status === 'active'
                ? 'bg-green-500/30 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {trackingStatus.playerCount} 👥
            </div>
          )}
          <span className="text-white/60 text-xs font-mono">
            {formatTime(elapsedSeconds)}
          </span>
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Events panel */}
        <AnimatePresence>
          {showEvents && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-black/80 backdrop-blur p-3 mx-2 mb-2 rounded-xl border border-white/10"
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

        {/* Funk panel */}
        <AnimatePresence>
          {showFunk && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-black/90 backdrop-blur p-3 mx-2 mb-2 rounded-xl border border-white/10 max-h-48 overflow-hidden"
            >
              <FunkPanel sessionId={sessionId} onClose={() => setShowFunk(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex items-center gap-2 px-3 pb-4 pt-2 bg-gradient-to-t from-black/70 to-transparent">
          {/* PTT Button */}
          <button
            onMouseDown={() => handlePTT(true)}
            onMouseUp={() => handlePTT(false)}
            onTouchStart={e => { e.preventDefault(); handlePTT(true); }}
            onTouchEnd={e => { e.preventDefault(); handlePTT(false); }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
              micActive ? 'bg-primary scale-110 neon-glow' : 'bg-white/20 border border-white/30'
            }`}
          >
            {micActive ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
          </button>

          {/* Events toggle */}
          <button
            onClick={() => { setShowEvents(s => !s); setShowFunk(false); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              showEvents ? 'bg-primary text-primary-foreground' : 'bg-white/20 border border-white/30 text-white'
            }`}
          >
            ⚽ Events
          </button>

          {/* Funk toggle */}
          <button
            onClick={() => { setShowFunk(s => !s); setShowEvents(false); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              showFunk ? 'bg-primary text-primary-foreground' : 'bg-white/20 border border-white/30 text-white'
            }`}
          >
            <Radio className="w-4 h-4 inline mr-1" /> Funk
          </button>
        </div>
      </div>
    </div>
  );
}