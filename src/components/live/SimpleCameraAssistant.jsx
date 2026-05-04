/**
 * SimpleCameraAssistant — Kameramann-Ansicht
 * Optimiert für Hochformat UND Querformat (landscape)
 * Funk läuft immer im Hintergrund (kein separates Overlay)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, CameraOff, Radio, Zap, X, Send, MessageSquare } from 'lucide-react';
import EventButtons from './EventButtons';
import useWebRTCCamera from '@/hooks/useWebRTCCamera';
import useFunkSubscription from '@/hooks/useFunkSubscription';
import { SimpleFrameUpload } from '@/lib/simpleFrameUpload';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Internes Mini-FunkPanel direkt in der Kamera-Ansicht
function InlineFunkPanel({ sessionId, session, cameraId, onClose }) {
  const { messages, activeSpeaker } = useFunkSubscription(sessionId);
  const [text, setText] = useState('');
  const [pttActive, setPttActive] = useState(false);
  const listRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const sendText = async () => {
    if (!text.trim()) return;
    const label = session?.camera_streams?.find(c => String(c.camera_id) === String(cameraId))?.label || `Kamera ${cameraId}`;
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from: `camera_${cameraId}`,
      from_label: label,
      text: text.trim(),
      is_ppt: false,
      timestamp_ms: Date.now(),
    }).catch(() => {});
    setText('');
  };

  const handlePTT = async (active) => {
    setPttActive(active);
    const label = session?.camera_streams?.find(c => String(c.camera_id) === String(cameraId))?.label || `Kamera ${cameraId}`;
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from: `camera_${cameraId}`,
      from_label: label,
      text: active ? '🎙️ Spricht...' : '📻 Fertig',
      is_ppt: true,
      ppt_active: active,
      timestamp_ms: Date.now(),
    }).catch(() => {});
  };

  return (
    <div className="flex flex-col h-full bg-black/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-white">Funk-Kanal</span>
          {activeSpeaker && (
            <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full animate-pulse">
              {activeSpeaker} spricht
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-white/30 py-6">Noch keine Nachrichten</div>
        ) : messages.map((msg, i) => {
          const isMe = msg.from !== 'coach';
          return (
            <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-2.5 py-1.5 rounded-xl text-xs ${
                msg.is_ppt
                  ? 'bg-primary/15 border border-primary/20 text-primary italic'
                  : isMe
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white/15 text-white'
              }`}>
                {!isMe && <div className="text-[9px] font-bold text-white/50 mb-0.5 uppercase">{msg.from_label || 'Trainer'}</div>}
                <div>{msg.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Text Input only */}
      <div className="px-3 py-2 border-t border-white/10 flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendText()}
            placeholder="Nachricht an Trainer..."
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-primary/60"
          />
          <button onClick={sendText} disabled={!text.trim()}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-white/30 mt-1.5 text-center">Text-Kommunikation mit dem Trainer-Dashboard</p>
      </div>
    </div>
  );
}

export default function SimpleCameraAssistant() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  const cameraId = urlParams.get('cam') || '1';
  
  // Immediate debug log
  console.log('[SimpleCameraAssistant] MOUNTED — URL params:', { 
    fullUrl: window.location.href, 
    sessionId, 
    cameraId,
    searchString: window.location.search 
  });

  const [session, setSession] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activePanel, setActivePanel] = useState(null); // null | 'funk' | 'events'
  const [camStatus, setCamStatus] = useState('starting');
  const [isConnected, setIsConnected] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [unreadFunk, setUnreadFunk] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const heartbeatRef = useRef(null);
  const thumbnailRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const frameUploadRef = useRef(null);
  const [frameStats, setFrameStats] = useState(null);

  // Detect orientation
  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, []);

  // WebRTC
  useWebRTCCamera({
    sessionId, cameraId, stream: mediaStream,
    enabled: camStatus === 'active' && !!sessionId && !!mediaStream,
  });

  // Funk subscription for unread badge
  const { messages: funkMessages } = useFunkSubscription(sessionId);
  useEffect(() => {
    if (activePanel !== 'funk' && funkMessages.length > lastMessageCountRef.current) {
      const newCoachMessages = funkMessages.slice(lastMessageCountRef.current).filter(m => m.from === 'coach');
      if (newCoachMessages.length > 0) setUnreadFunk(c => c + newCoachMessages.length);
    }
    lastMessageCountRef.current = funkMessages.length;
  }, [funkMessages, activePanel]);

  // Load session — MUST complete before heartbeat starts
  useEffect(() => {
    if (!sessionId) return;
    base44.entities.LiveSession.list('-created_date', 100)
      .then(sessions => {
        const found = sessions.find(s => s.id === sessionId);
        if (found) {
          console.log('[SimpleCameraAssistant] Session loaded:', found.id);
          setSession(found);
          sessionRef.current = found;
        } else {
          console.warn('[SimpleCameraAssistant] Session not found:', sessionId);
        }
      })
      .catch(e => console.error('[SimpleCameraAssistant] Load session failed:', e));
  }, [sessionId]);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Start Camera + Direct Frame Upload (no polling delays)
  useEffect(() => {
    const startCamera = async () => {
      try {
        console.log('[SimpleCameraAssistant] Starting camera...', { sessionId, cameraId });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        setMediaStream(stream);
        console.log('[SimpleCameraAssistant] Camera stream ready');
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          
          // Direct frame capture loop — starts IMMEDIATELY (not waiting for session)
          let frameCount = 0;
          const captureLoop = setInterval(async () => {
            const video = videoRef.current;
            if (!video || video.readyState < 2) return;
            
            const canvas = canvasRef.current;
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, 320, 180);
            
            const base64 = canvas.toDataURL('image/jpeg', 0.6);
            frameCount++;
            
            // Send frame directly to backend — sessionId/cameraId come from closure, so always available
            base44.functions.invoke('uploadFrameBatch', {
              session_id: sessionId,
              camera_id: cameraId,
              frames: [{ data_base64: base64, timestamp_ms: Date.now(), elapsed_seconds: 0 }],
            }).then(res => {
              if (frameCount === 1) console.log('[Frame Loop] ✅ First upload success:', res);
              // Also send thumbnail via heartbeat after successful upload
              if (sendHeartbeatRef.current) sendHeartbeatRef.current(true);
            }).catch(e => {
              if (frameCount === 1) console.error('[Frame Loop] ❌ First upload FAILED:', e.message);
            });
            
            setFrameStats({ capturedCount: frameCount, uploadedCount: frameCount, pendingFrames: 0, lastUploadSuccess: true });
          }, 5000); // Every 5 seconds
          
          frameUploadRef.current = { stop: () => clearInterval(captureLoop) };
          console.log('[SimpleCameraAssistant] Frame capture loop started');
        }
        setCamStatus('active');
      } catch (e) {
        console.error('[SimpleCameraAssistant] Camera error:', e.message);
        setCamStatus('error');
      }
    };
    
    if (sessionId && cameraId) {
      startCamera();
    }
    
    return () => {
      console.log('[SimpleCameraAssistant] Cleanup: stopping camera and frame loop');
      streamRef.current?.getTracks().forEach(t => t.stop());
      frameUploadRef.current?.stop?.();
    };
  }, [sessionId, cameraId]);

  const captureThumbnail = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    const ctx = canvas.getContext('2d');
    canvas.width = 320; canvas.height = 180;
    ctx.drawImage(video, 0, 0, 320, 180);
    return canvas.toDataURL('image/jpeg', 0.6);
  }, []);

  // Cached session ref to avoid re-fetching on every heartbeat
  const sessionRef = useRef(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const sendHeartbeatRef = useRef(null);

  const sendHeartbeat = useCallback(async (withThumbnail = false) => {
    if (!sessionId) return;
    
    try {
      const thumbnail = withThumbnail ? captureThumbnail() : undefined;
      const label = `Kamera ${cameraId}`;
      
      // Upsert: find or create CameraConnection
      const existing = await base44.entities.CameraConnection.filter({
        session_id: sessionId,
        camera_id: cameraId,
      });
      
      const data = {
        status: 'connected',
        last_heartbeat: new Date().toISOString(),
        label,
      };
      if (thumbnail) data.thumbnail = thumbnail;
      
      if (existing.length > 0) {
        await base44.entities.CameraConnection.update(existing[0].id, data);
        console.log('[Heartbeat] ✅ Updated cam', cameraId);
      } else {
        await base44.entities.CameraConnection.create({
          session_id: sessionId,
          camera_id: cameraId,
          ...data,
        });
        console.log('[Heartbeat] ✅ Created cam', cameraId);
      }
      setIsConnected(true);
    } catch (e) {
      console.error('[SimpleCameraAssistant] ❌ Heartbeat FAILED:', e.message);
      setIsConnected(false);
    }
  }, [sessionId, cameraId, captureThumbnail]);

  // Cache sendHeartbeat for use in frame upload closure
  useEffect(() => {
    sendHeartbeatRef.current = sendHeartbeat;
  }, [sendHeartbeat]);

  useEffect(() => {
    if (!sessionId || !session) return;
    
    console.log('[SimpleCameraAssistant] ✅ Ready: sessionId=' + sessionId + ', cameraId=' + cameraId);
    
    // Send initial heartbeat IMMEDIATELY when session is loaded
    sendHeartbeat(false);
    
    // Heartbeat every 3 seconds
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat(false);
    }, 3000);
    
    // Thumbnail every 30s
    thumbnailRef.current = setInterval(() => {
      sendHeartbeat(true);
    }, 30000);
    
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (thumbnailRef.current) clearInterval(thumbnailRef.current);
    };
  }, [sessionId, session, cameraId]);

  const handlePTT = async (active) => {
    setMicActive(active);
    if (!sessionId) return;
    const label = session?.camera_streams?.find(c => String(c.camera_id) === String(cameraId))?.label || `Kamera ${cameraId}`;
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from: `camera_${cameraId}`,
      from_label: label,
      text: active ? '🎙️ Spricht...' : '📻 Fertig',
      is_ppt: true,
      ppt_active: active,
      timestamp_ms: Date.now(),
    }).catch(() => {});
  };

  const openPanel = (panel) => {
    if (panel === 'funk') setUnreadFunk(0);
    setActivePanel(prev => prev === panel ? null : panel);
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

  const camLabel = session?.camera_streams?.find(c => String(c.camera_id) === String(cameraId))?.label || `Kamera ${cameraId}`;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />

      {/* LIVE VIDEO — Vollbild */}
      <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />

      {/* Camera error */}
      {camStatus === 'error' && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center text-white text-center p-6 z-50">
          <div className="space-y-3">
            <CameraOff className="w-12 h-12 mx-auto text-red-400" />
            <p className="font-bold">Kamerazugriff verweigert</p>
            <p className="text-sm text-gray-400">Bitte Kamera-Berechtigung erteilen und Seite neu laden</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary rounded-lg text-sm font-bold">Neu laden</button>
          </div>
        </div>
      )}

      {/* ── PORTRAIT LAYOUT ────────────────────────────────────────── */}
      {!isLandscape && (
        <>
          {/* TOP BAR */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 pt-safe pt-3 pb-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/85 text-white text-xs font-bold backdrop-blur-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE {formatTime(elapsedSeconds)}
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm ${isConnected ? 'bg-green-600/80 text-white' : 'bg-black/60 text-gray-300'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
                {isConnected ? 'Verbunden' : 'Verbinde...'}
              </div>
              {frameStats && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm ${
                  !frameStats.lastUploadSuccess ? 'bg-red-600/80 text-white' :
                  frameStats.uploadedCount > 0 ? 'bg-green-600/80 text-white' :
                  'bg-yellow-600/80 text-white'
                }`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {!frameStats.lastUploadSuccess ? '⚠️' :
                   frameStats.uploadedCount > 0 ? `✓ ${frameStats.uploadedCount}` :
                   `📹 ${frameStats.capturedCount}`}
                </div>
              )}
            </div>
            <div className="text-xs text-white/60">{camLabel}</div>
          </div>

          {/* BOTTOM CONTROLS */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pb-safe p-3 space-y-2">
            {/* Action Buttons Row */}
            <div className="flex gap-2">
              {/* Events */}
              <button
                onClick={() => openPanel('events')}
                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                  activePanel === 'events' ? 'bg-primary text-primary-foreground' : 'bg-black/50 border border-white/20 text-white backdrop-blur-sm'
                }`}
              >
                <Zap className="w-4 h-4" /> Events
              </button>
              {/* Funk / Chat */}
              <button
                onClick={() => openPanel('funk')}
                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 relative transition-all active:scale-95 ${
                  activePanel === 'funk' ? 'bg-primary text-primary-foreground' : 'bg-black/50 border border-white/20 text-white backdrop-blur-sm'
                }`}
              >
                <MessageSquare className="w-4 h-4" /> Funk-Chat
                {unreadFunk > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadFunk}</span>
                )}
              </button>
            </div>

            {/* "Spreche gerade" Signal-Button */}
            <button
              onMouseDown={() => handlePTT(true)}
              onMouseUp={() => handlePTT(false)}
              onTouchStart={e => { e.preventDefault(); handlePTT(true); }}
              onTouchEnd={e => { e.preventDefault(); handlePTT(false); }}
              className={`w-full py-4 rounded-xl font-bold text-white text-base transition-all active:scale-95 select-none touch-manipulation flex items-center justify-center gap-2 ${
                micActive ? 'bg-orange-500 neon-glow' : 'bg-black/50 border border-white/30 backdrop-blur-sm'
              }`}
            >
              {micActive
                ? <><Mic className="w-5 h-5" /> Signal: Spreche gerade...</>
                : <><Radio className="w-5 h-5" /> Halten → "Spreche gerade" Signal</>
              }
            </button>
          </div>

          {/* EVENTS PANEL — slides from bottom */}
          <AnimatePresence>
            {activePanel === 'events' && (
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute inset-x-0 bottom-0 z-20 bg-black/95 backdrop-blur rounded-t-2xl border-t border-white/10"
                style={{ maxHeight: '65vh' }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <span className="font-bold text-white text-sm">⚽ Events tippen</span>
                  <button onClick={() => setActivePanel(null)} className="text-white/60 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-3 overflow-y-auto" style={{ maxHeight: 'calc(65vh - 48px)' }}>
                  <EventButtons sessionId={sessionId} matchId={session?.match_id} matchTitle={session?.match_title}
                    source={`camera_${cameraId}`} elapsedSeconds={elapsedSeconds} compact={true} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* FUNK PANEL — slides from bottom */}
          <AnimatePresence>
            {activePanel === 'funk' && (
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-white/10 overflow-hidden"
                style={{ height: '65vh' }}
              >
                <InlineFunkPanel sessionId={sessionId} session={session} cameraId={cameraId} onClose={() => setActivePanel(null)} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── LANDSCAPE LAYOUT ────────────────────────────────────────── */}
      {isLandscape && (
        <>
          {/* TOP STATUS BAR — slim */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-2 pb-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/85 text-white text-[11px] font-bold backdrop-blur-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE {formatTime(elapsedSeconds)}
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm ${isConnected ? 'bg-green-600/80 text-white' : 'bg-black/60 text-gray-300'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
                {isConnected ? 'OK' : '...'}
              </div>
              <span className="text-[10px] text-white/50">{camLabel}</span>
            </div>
          </div>

          {/* RIGHT SIDEBAR — Landscape Controls */}
          <div className="absolute right-0 top-0 bottom-0 z-10 flex flex-col justify-center gap-2 pr-3 pl-2">
            {/* Signal-Button */}
            <button
              onMouseDown={() => handlePTT(true)}
              onMouseUp={() => handlePTT(false)}
              onTouchStart={e => { e.preventDefault(); handlePTT(true); }}
              onTouchEnd={e => { e.preventDefault(); handlePTT(false); }}
              className={`w-14 py-4 rounded-xl font-bold text-[11px] flex flex-col items-center gap-1 transition-all active:scale-95 select-none touch-manipulation ${
                micActive ? 'bg-orange-500 neon-glow text-white' : 'bg-black/60 border border-white/25 text-white backdrop-blur-sm'
              }`}
            >
              {micActive ? <Mic className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
              <span>{micActive ? 'Signal!' : 'Signal'}</span>
            </button>

            {/* Events */}
            <button
              onClick={() => openPanel('events')}
              className={`w-14 py-3 rounded-xl font-bold text-[11px] flex flex-col items-center gap-1 transition-all active:scale-95 ${
                activePanel === 'events' ? 'bg-primary text-primary-foreground' : 'bg-black/60 border border-white/25 text-white backdrop-blur-sm'
              }`}
            >
              <Zap className="w-5 h-5" />
              <span>Events</span>
            </button>

            {/* Funk Chat */}
            <button
              onClick={() => openPanel('funk')}
              className={`w-14 py-3 rounded-xl font-bold text-[11px] flex flex-col items-center gap-1 relative transition-all active:scale-95 ${
                activePanel === 'funk' ? 'bg-primary text-primary-foreground' : 'bg-black/60 border border-white/25 text-white backdrop-blur-sm'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span>Chat</span>
              {unreadFunk > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{unreadFunk}</span>
              )}
            </button>
          </div>

          {/* LANDSCAPE PANEL — links, halbe Breite */}
          <AnimatePresence>
            {activePanel === 'events' && (
              <motion.div
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute left-0 top-0 bottom-0 z-20 w-72 bg-black/95 backdrop-blur border-r border-white/10 flex flex-col"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0">
                  <span className="font-bold text-white text-sm">⚽ Events</span>
                  <button onClick={() => setActivePanel(null)} className="text-white/60"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <EventButtons sessionId={sessionId} matchId={session?.match_id} matchTitle={session?.match_title}
                    source={`camera_${cameraId}`} elapsedSeconds={elapsedSeconds} compact={true} />
                </div>
              </motion.div>
            )}
            {activePanel === 'funk' && (
              <motion.div
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute left-0 top-0 bottom-0 z-20 w-72 overflow-hidden"
              >
                <InlineFunkPanel sessionId={sessionId} session={session} cameraId={cameraId} onClose={() => setActivePanel(null)} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}