/**
 * SimpleCameraAssistant — Ultra-minimal für Kameramänner
 * Nur: Video + Button-Grid + Funk (maximale Einfachheit)
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send } from 'lucide-react';
import EventButtons from './EventButtons';
import FunkPanel from './FunkPanel';

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

  const videoRef = useRef(null);
  const timerRef = useRef(null);

  // Load session
  useEffect(() => {
    if (!sessionId) return;
    base44.entities.LiveSession.filter({ id: sessionId })
      .then(sessions => setSession(sessions[0]))
      .catch(() => {});
  }, [sessionId]);

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
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.warn('Camera error:', e);
      }
    };
    startCamera();
  }, []);

  const handlePTT = async (active) => {
    setMicActive(active);
    if (!sessionId) return;
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from: `camera_${cameraId}`,
      from_label: `Kamera ${cameraId}`,
      text: active ? '🎙️ Spricht...' : '📻 Fertig',
      is_ppt: true,
      ppt_active: active,
      timestamp_ms: Date.now(),
    }).catch(() => {});
  };

  if (!sessionId) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-center p-4">
        <div className="space-y-2">
          <div className="text-2xl">📹</div>
          <p className="font-bold">Kein Session-Link</p>
          <p className="text-xs text-gray-400">Öffne den Link vom Trainer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* LIVE VIDEO — Vollbild */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* TOP BADGE */}
      <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-full bg-red-500/80 text-white text-xs font-bold flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        LIVE {formatTime(elapsedSeconds)}
      </div>

      {/* BUTTON GRID — Oben rechts (Events-Toggle) */}
      <motion.button
        animate={{ scale: showEvents ? 1.05 : 1 }}
        onClick={() => { setShowEvents(!showEvents); setShowFunk(false); }}
        className="absolute top-2 right-2 z-10 px-3 py-1.5 rounded-lg text-sm font-bold bg-primary text-primary-foreground"
      >
        {showEvents ? '✕' : '⚽ Events'}
      </motion.button>

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

      {/* FUNK PANEL — Slide-up Overlay, immer schließbar */}
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
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted text-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <FunkPanel sessionId={sessionId} onClose={() => setShowFunk(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM CONTROLS — Einfach & Groß */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black via-black/70 to-transparent p-4 space-y-3">
        {/* PTT Button — GROSS */}
        <button
          onMouseDown={() => handlePTT(true)}
          onMouseUp={() => handlePTT(false)}
          onTouchStart={(e) => { e.preventDefault(); handlePTT(true); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePTT(false); }}
          className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all active:scale-95 ${
            micActive
              ? 'bg-primary neon-glow'
              : 'bg-white/20 border border-white/30'
          }`}
        >
          {micActive ? (
            <>
              <Mic className="w-6 h-6 inline mr-2" />
              SPRECHEN
            </>
          ) : (
            <>
              <MicOff className="w-6 h-6 inline mr-2" />
              Halten zum Sprechen
            </>
          )}
        </button>

        {/* Funk Button */}
        <button
          onClick={() => { setShowFunk(!showFunk); setShowEvents(false); }}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
            showFunk
              ? 'bg-primary text-primary-foreground'
              : 'bg-white/20 border border-white/30 text-white'
          }`}
        >
          📻 {showFunk ? 'Schließen' : 'Funk-Kanal'}
        </button>
      </div>
    </div>
  );
}