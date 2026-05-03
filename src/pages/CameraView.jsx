/**
 * CameraView — Mobile Camera Page (Landscape-first)
 * Accessed via /cam?session=SESSION_ID
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Mic, MicOff, Send, Radio, ZoomIn, ZoomOut } from 'lucide-react';
import EventButtons from '@/components/live/EventButtons';

export default function CameraView() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  const cameraId = urlParams.get('cam') || '1';

  const [session, setSession] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showEvents, setShowEvents] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState(null); // {status, playerCount, ballDetected, teams}

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const frameIntervalRef = useRef(null);

  // Load session + mark this camera as connected
  useEffect(() => {
    if (!sessionId) return;
    base44.entities.LiveSession.filter({ id: sessionId })
      .then(sessions => {
        const s = sessions[0] || null;
        setSession(s);
        // Mark this specific camera as connected in the session
        if (s && s.camera_streams) {
          const updatedStreams = s.camera_streams.map(c =>
            c.camera_id === cameraId
              ? { ...c, status: 'connected', last_seen: new Date().toISOString() }
              : c
          );
          base44.entities.LiveSession.update(s.id, { camera_streams: updatedStreams }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [sessionId, cameraId]);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Heartbeat — update camera last_seen every 10s so Cockpit shows connection status
  useEffect(() => {
    if (!sessionId || !session) return;
    const hb = setInterval(() => {
      const updatedStreams = session.camera_streams?.map(c =>
        c.camera_id === cameraId
          ? { ...c, status: 'connected', last_seen: new Date().toISOString() }
          : c
      );
      if (updatedStreams) {
        base44.entities.LiveSession.update(session.id, { camera_streams: updatedStreams }).catch(() => {});
      }
    }, 10000);
    return () => clearInterval(hb);
  }, [sessionId, session, cameraId]);

  // Poll funk messages
  useEffect(() => {
    if (!sessionId) return;
    const fetch = async () => {
      const msgs = await base44.entities.FunkMessage.filter({ session_id: sessionId });
      setMessages(msgs.sort((a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0)).slice(-20));
    };
    fetch();
    pollRef.current = setInterval(fetch, 3000);
    return () => clearInterval(pollRef.current);
  }, [sessionId]);

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

  // Frame capture + tracking — only when session active
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
          frame_number: frameNumber++,
          elapsed_seconds: elapsedSeconds,
          team: 'home',
        });
        if (res?.data?.success) {
          setTrackingStatus(res.data.tracking_status || {
            status: res.data.ball_detected ? 'active' : 'partial',
            playerCount: res.data.players_detected || 0,
            ballDetected: res.data.ball_detected || false,
            teams: { teamA: 0, teamB: 0, referee: 0 },
          });
        }
      } catch (e) {
        // silent fail
      }
    };

    frameIntervalRef.current = setInterval(capture, 3000); // every 3s
    return () => clearInterval(frameIntervalRef.current);
  }, [sessionId, elapsedSeconds]);

  const sendMessage = async () => {
    if (!message.trim() || !sessionId) return;
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from: `camera_${cameraId}`,
      from_label: session?.camera_streams?.find(c => c.camera_id === cameraId)?.label || `Kamera ${cameraId}`,
      text: message.trim(),
      is_ptt: false,
      timestamp_ms: Date.now(),
    });
    setMessage('');
  };

  const handlePTT = async (active) => {
    setMicActive(active);
    if (!sessionId) return;
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from: `camera_${cameraId}`,
      from_label: session?.camera_streams?.find(c => c.camera_id === cameraId)?.label || `Kamera ${cameraId}`,
      text: active ? '🎙 Kamera spricht...' : '📻 Kamera fertig',
      is_ptt: true,
      ptt_active: active,
      timestamp_ms: Date.now(),
    });
  };

  const adjustZoom = (delta) => {
    const newZoom = Math.min(3.0, Math.max(0.5, zoom + delta));
    setZoom(newZoom);
    if (videoRef.current) {
      videoRef.current.style.transform = `scale(${newZoom})`;
      videoRef.current.style.transformOrigin = 'center center';
    }
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
        style={{ transition: 'transform 0.2s' }}
      />

      {/* Top bar — minimal */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-xs font-bold">LIVE</span>
          {session && <span className="text-white/60 text-xs">{session.match_title}</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Tracking indicator */}
          {trackingStatus !== null && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              trackingStatus.status === 'active'
                ? 'bg-green-500/30 text-green-400 border border-green-500/40'
                : trackingStatus.status === 'partial'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                trackingStatus.status === 'active' ? 'bg-green-400 animate-pulse' :
                trackingStatus.status === 'partial' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
              }`} />
              {trackingStatus.status === 'active'
                ? `👥${trackingStatus.playerCount} ⚽`
                : trackingStatus.status === 'partial'
                  ? `👥${trackingStatus.playerCount} ❌`
                  : 'Kein Tracking'}
            </div>
          )}
          <span className="text-white/60 text-xs font-mono">
            {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Zoom controls — right side */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
        <button onClick={() => adjustZoom(0.5)} className="w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white">
          <ZoomIn className="w-5 h-5" />
        </button>
        <div className="w-10 h-8 flex items-center justify-center text-white text-xs font-bold">
          {zoom.toFixed(1)}x
        </div>
        <button onClick={() => adjustZoom(-0.5)} className="w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white">
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Events panel */}
        {showEvents && (
          <div className="bg-black/80 backdrop-blur p-3 mx-2 mb-2 rounded-xl border border-white/10">
            <EventButtons
              sessionId={sessionId}
              matchId={session?.match_id}
              matchTitle={session?.match_title}
              source={`camera_${cameraId}`}
              elapsedSeconds={elapsedSeconds}
              compact={true}
            />
          </div>
        )}

        {/* Chat panel */}
        {showChat && (
          <div className="bg-black/80 backdrop-blur p-3 mx-2 mb-2 rounded-xl border border-white/10 max-h-48 overflow-y-auto">
            <div className="space-y-1 mb-2">
              {messages.slice(-8).map((msg, i) => (
                <div key={i} className={`text-xs ${msg.from === 'coach' ? 'text-green-400' : 'text-white/70'}`}>
                  <span className="font-bold">{msg.from_label}: </span>{msg.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Nachricht..."
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none"
              />
              <button onClick={sendMessage} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 px-3 pb-4 pt-2 bg-gradient-to-t from-black/70 to-transparent">
          {/* PTT */}
          <button
            onMouseDown={() => handlePTT(true)}
            onMouseUp={() => handlePTT(false)}
            onTouchStart={e => { e.preventDefault(); handlePTT(true); }}
            onTouchEnd={e => { e.preventDefault(); handlePTT(false); }}
            className={`w-12 h-12 rounded-full flex items-center justify-center select-none touch-manipulation transition-all ${
              micActive ? 'bg-primary scale-110 neon-glow' : 'bg-white/20 border border-white/30'
            }`}
          >
            {micActive ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
          </button>

          {/* Events toggle */}
          <button
            onClick={() => { setShowEvents(s => !s); setShowChat(false); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              showEvents ? 'bg-primary text-primary-foreground' : 'bg-white/20 border border-white/30 text-white'
            }`}
          >
            ⚽ Events
          </button>

          {/* Chat toggle */}
          <button
            onClick={() => { setShowChat(s => !s); setShowEvents(false); }}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              showChat ? 'bg-primary text-primary-foreground' : 'bg-white/20 border border-white/30 text-white'
            }`}
          >
            <Radio className="w-4 h-4 inline mr-1" /> Funk
          </button>
        </div>
      </div>
    </div>
  );
}