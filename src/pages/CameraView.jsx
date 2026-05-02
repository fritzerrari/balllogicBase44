/**
 * CameraView — Vereinfachte Kamera ohne Code-Eingabe
 * Öffnet automatisch via Session-Link: /cam?session=xxx
 * 
 * Features:
 * - Auto-connect zu Session
 * - Video-Stream + Overlay
 * - Event-Tippen
 * - Funk-Panel (Push-to-Talk)
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, AlertTriangle, Wifi, WifiOff, Mic, MicOff,
  Radio, MessageSquare, Home, LogOut, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EventButtons from '@/components/live/EventButtons';
import FunkPanel from '@/components/live/FunkPanel';

export default function CameraView() {
  const navigate = useNavigate();
  const [sessionId] = useState(() => new URLSearchParams(window.location.search).get('session'));
  const [cameraLabel, setCameraLabel] = useState('');
  const [connected, setConnected] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [funkOpen, setFunkOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const heartbeatRef = useRef(null);

  // Lade Session
  const { data: session, isLoading, error } = useQuery({
    queryKey: ['live-session', sessionId],
    queryFn: () => sessionId ? base44.entities.LiveSession.filter({ id: sessionId }) : Promise.resolve([]),
    enabled: !!sessionId,
    refetchInterval: 3000,
    staleTime: 2000,
  });

  const activeSession = session?.[0];

  // Auto-connect: Kamera-Label bestimmen
  useEffect(() => {
    if (activeSession?.camera_streams?.length > 0) {
      setCameraLabel(activeSession.camera_streams[0].label || 'Kamera 1');
      setConnected(true);
    }
  }, [activeSession]);

  // Heartbeat — update session connection status
  useEffect(() => {
    if (!activeSession?.id) return;
    const sendHeartbeat = async () => {
      try {
        const streams = activeSession.camera_streams || [];
        const updated = streams.map(s => ({
          ...s,
          status: 'connected',
          last_seen: new Date().toISOString(),
          thumbnail: canvasRef.current?.toDataURL() || undefined,
        }));
        await base44.entities.LiveSession.update(activeSession.id, { camera_streams: updated });
      } catch (e) {
        console.warn('Heartbeat failed:', e);
      }
    };

    heartbeatRef.current = setInterval(sendHeartbeat, 2000);
    return () => clearInterval(heartbeatRef.current);
  }, [activeSession?.id, activeSession?.camera_streams]);

  // Video-Stream starten
  const [cameraError, setCameraError] = useState(null);
  useEffect(() => {
    const startStream = async () => {
      try {
        setCameraError(null);
        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment',
          },
          audio: false, // Audio nur wenn User es erlaubt
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(e => console.warn('Play failed:', e));
        }
      } catch (err) {
        console.error('❌ Kamera-Fehler:', err);
        setCameraError(err.message || 'Kamera-Zugriff verweigert. Prüfe Browser-Rechte.');
      }
    };
    startStream();
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Canvas-Frame für Heartbeat-Thumbnail
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video?.readyState === 4 && canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Keine Session-ID</h1>
          <p className="text-muted-foreground">Bitte öffne den Link vom Trainer.</p>
          <Button onClick={() => navigate('/')} variant="outline">Zurück</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Verbinde mit Session...</p>
        </div>
      </div>
    );
  }

  if (error || !activeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Session nicht gefunden</h1>
          <p className="text-muted-foreground text-sm">Die Session existiert nicht oder wurde beendet.</p>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            <Home className="w-4 h-4 mr-2" /> Zurück zur Startseite
          </Button>
        </div>
      </div>
    );
  }

  const elapsedSeconds = activeSession.started_at
    ? Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 1000)
    : 0;

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
          <span className={`text-xs sm:text-sm font-bold ${connected ? 'text-primary' : 'text-muted-foreground'}`}>
            {connected ? 'LIVE' : 'DISCONNECTED'} — {cameraLabel}
          </span>
          <Badge className="bg-muted text-muted-foreground text-[10px] sm:text-xs">
            {activeSession.match_title}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <button
            onMouseDown={() => setMicActive(true)}
            onMouseUp={() => setMicActive(false)}
            onTouchStart={() => setMicActive(true)}
            onTouchEnd={() => setMicActive(false)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${micActive ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border text-muted-foreground'}`}
          >
            {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">PTT</span>
          </button>

          <button
            onClick={() => setFunkOpen(o => !o)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${funkOpen ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border text-muted-foreground'}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat</span>
          </button>

          <Button onClick={() => navigate('/')} size="sm" variant="outline" className="px-2">
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid lg:grid-cols-3 gap-3 min-h-0">
        {/* Video */}
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
          <div className="glass rounded-xl p-2 flex-1 overflow-hidden relative">
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 rounded-lg z-10">
                <div className="text-center space-y-3">
                  <div className="text-4xl">📹</div>
                  <p className="text-sm font-bold text-foreground">Kamera nicht verfügbar</p>
                  <p className="text-xs text-muted-foreground max-w-xs">{cameraError}</p>
                  <p className="text-[10px] text-yellow-400 mt-3">✓ Prüfe: Browser-Berechtigung, HTTPS, nicht im Inkognito</p>
                </div>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover rounded-lg"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Event Buttons */}
          <div className="glass rounded-xl p-3">
            <div className="text-xs text-muted-foreground uppercase font-bold mb-2">Events tippen</div>
            <EventButtons
              sessionId={activeSession.id}
              matchId={activeSession.match_id}
              matchTitle={activeSession.match_title}
              source={cameraLabel}
              elapsedSeconds={elapsedSeconds}
              compact={true}
            />
          </div>
        </div>

        {/* Funk Panel */}
        <AnimatePresence>
          {funkOpen ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="glass rounded-xl overflow-hidden" style={{ height: '400px' }}>
              <FunkPanel sessionId={activeSession.id} onClose={() => setFunkOpen(false)} />
            </motion.div>
          ) : (
            <div className="glass rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <Radio className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                Chat & Funk-Kanal<br/>werden hier angezeigt
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="mt-3 text-center text-[10px] text-muted-foreground">
        {connected && <span>✓ Verbunden — Trainer empfängt Video</span>}
        {!connected && <span>⚠️ Verbindung wird hergestellt...</span>}
      </div>
    </div>
  );
}