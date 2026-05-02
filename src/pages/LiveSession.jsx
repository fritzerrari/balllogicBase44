import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radio, Camera, Play, Square, Plus, Minus,
  Clock, Zap, Video, Mic, MicOff,
  AlertTriangle, Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FootballPitch from '@/components/pitch/FootballPitch';
import EventButtons from '@/components/live/EventButtons';
import CameraInviteButton from '@/components/live/CameraInviteButton';

const CAMERA_POSITIONS = [
  '— Position wählen —',
  'Tribüne Mitte (Übersicht)',
  'Tribüne Links',
  'Tribüne Rechts',
  'Torlinie Heim',
  'Torlinie Gäste',
  'Seitenlinie Hälfte Heim',
  'Seitenlinie Hälfte Gäste',
  'Seitenlinie Mitte',
  'Erhöht Mitte',
  'Ecke vorne links',
  'Ecke vorne rechts',
  'Ecke hinten links',
  'Ecke hinten rechts',
];

export default function LiveSession() {
  const navigate = useNavigate();
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cameraCount, setCameraCount] = useState(1);
  const [cameras, setCameras] = useState([{ id: 1, position: CAMERA_POSITIONS[0], code: Math.floor(100000 + Math.random() * 900000).toString(), status: 'ready' }]);
  // CAMERA_POSITIONS[0] = "— Position wählen —" (kein Vorausfüllen)
  const [events, setEvents] = useState([]);
  const [session, setSession] = useState(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [showCameraSetup, setShowCameraSetup] = useState(true);
  const timerRef = useRef(null);
  const queryClient = useQueryClient();

  const createSession = useMutation({ mutationFn: (data) => base44.entities.LiveSession.create(data) });
  const updateSession = useMutation({ mutationFn: ({ id, data }) => base44.entities.LiveSession.update(id, data) });

  useEffect(() => {
    if (sessionActive) {
      timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionActive]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const updateCameraCount = (n) => {
    const count = Math.max(1, Math.min(6, n));
    setCameraCount(count);
    setCameras(Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      position: CAMERA_POSITIONS[0], // leer / "Position wählen"
      code: Math.floor(100000 + Math.random() * 900000).toString(),
      status: 'ready'
    })));
  };

  const handleStart = async () => {
    if (!sessionTitle) return;
    const s = await createSession.mutateAsync({
      match_title: sessionTitle,
      status: 'active',
      started_at: new Date().toISOString(),
      camera_streams: cameras.map(c => ({ camera_id: c.id.toString(), label: c.position, stream_url: '' }))
    });
    setSession(s);
    setSessionActive(true);
    setElapsedTime(0);
    setShowCameraSetup(false);
  };

  const handleStop = async () => {
    if (session) {
      await updateSession.mutateAsync({ id: session.id, data: { status: 'ended', ended_at: new Date().toISOString(), notes: events.map(e => `${e.time} ${e.label}`).join(', ') } });
    }
    setSessionActive(false);
    queryClient.invalidateQueries({ queryKey: ['liveSessions'] });
  };

  const liveDangerZones = sessionActive ? [
    { x: 75, y: 50, intensity: 0.7, team: 'home' },
    { x: 25, y: 45, intensity: 0.5, team: 'away' },
    { x: 85, y: 30, intensity: 0.4, team: 'home' },
  ] : [];

  return (
    <div className="p-4 lg:p-8 min-h-screen">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-4">
        <Radio className="w-4 h-4 text-red-400" />
        <h1 className="text-xl sm:text-2xl font-grotesk font-bold text-foreground">Live-Session</h1>
        {sessionActive && (
          <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs animate-pulse">● LIVE</Badge>
        )}
      </motion.div>

      {/* SETUP PHASE */}
      {!sessionActive && (
        <div className="max-w-lg mx-auto space-y-3">
          <div className="glass rounded-xl p-5 space-y-4">
            <h2 className="font-grotesk font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              Spiel benennen
            </h2>
            <Input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} placeholder="z.B. FC Bayern vs BVB" className="bg-muted border-border text-base" />
          </div>

          <div className="glass rounded-xl p-5 space-y-4">
            <h2 className="font-grotesk font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
              Kameras aufstellen
            </h2>
            <p className="text-xs text-muted-foreground">1 Kamera reicht — 2–3 für volle Abdeckung. Kameramann gibt 6-stelligen Code ein.</p>

            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => updateCameraCount(cameraCount - 1)} className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center hover:border-primary/30">
                <Minus className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="font-grotesk font-bold text-foreground text-xl w-10 text-center">{cameraCount}</span>
              <button onClick={() => updateCameraCount(cameraCount + 1)} className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center hover:border-primary/30">
                <Plus className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-xs text-muted-foreground">Kameras</span>
            </div>

            <div className="space-y-2">
              {cameras.map((cam, i) => (
                <div key={cam.id} className="bg-muted rounded-lg p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Camera className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <select
                      value={cam.position}
                      onChange={e => setCameras(prev => prev.map((c, idx) => idx === i ? { ...c, position: e.target.value } : c))}
                      className="text-xs text-foreground bg-transparent border-none outline-none w-full cursor-pointer"
                    >
                      {CAMERA_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-grotesk font-bold text-primary tracking-widest">{cam.code}</div>
                    <div className="text-[10px] text-muted-foreground">6-stelliger Code</div>
                  </div>
                  <CameraInviteButton code={cam.code} position={cam.position} />
                </div>
              ))}
            </div>
            <p className="text-xs text-primary">💡 KI fügt alle Kameraperspektiven automatisch zusammen</p>
          </div>

          <Button onClick={handleStart} disabled={!sessionTitle || createSession.isPending} className="w-full bg-red-500 hover:bg-red-600 text-white gap-2 h-14 text-lg font-bold">
            <Play className="w-5 h-5" /> Live starten — bereit in 30 Sek
          </Button>
        </div>
      )}

      {/* LIVE PHASE */}
      {sessionActive && (
        <div className="grid lg:grid-cols-3 gap-3 lg:gap-4">
          {/* Left: Timer + Events */}
          <div className="space-y-3">
            {/* Timer Card — very compact on mobile */}
            <div className="glass rounded-xl p-3 sm:p-4 border border-red-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-400 font-bold">LIVE · {sessionTitle}</span>
                </div>
                <button
                  onMouseDown={() => setIsMicActive(true)}
                  onMouseUp={() => setIsMicActive(false)}
                  onTouchStart={() => setIsMicActive(true)}
                  onTouchEnd={() => setIsMicActive(false)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${isMicActive ? 'bg-primary text-primary-foreground neon-glow' : 'bg-muted border border-border text-muted-foreground'}`}
                >
                  {isMicActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isMicActive ? 'SPRECHEN' : 'Push-to-Talk'}</span>
                </button>
              </div>
              <div className="text-4xl sm:text-5xl font-grotesk font-bold text-foreground tabular-nums text-center mb-2">{formatTime(elapsedTime)}</div>
              <div className="grid grid-cols-2 gap-2 mb-2 text-center text-xs">
                <div className="bg-muted rounded-lg p-2">
                  <div className="font-bold text-primary">{cameraCount}</div>
                  <div className="text-muted-foreground">Kameras</div>
                </div>
                <div className="bg-muted rounded-lg p-2">
                  <div className="font-bold text-primary">{events.length}</div>
                  <div className="text-muted-foreground">Events</div>
                </div>
              </div>
              <Button onClick={handleStop} variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2 text-xs sm:text-sm">
                <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Beenden & Analyse starten
              </Button>
            </div>

            {/* Event Buttons */}
            <div className="glass rounded-xl p-3 sm:p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-bold mb-2.5">Event tippen</div>
              <EventButtons
                sessionId={session?.id}
                matchTitle={sessionTitle}
                source="coach"
                elapsedSeconds={elapsedTime}
                compact={true}
              />
            </div>
          </div>

          {/* Center + Right: Pitch + Camera Grid */}
          <div className="lg:col-span-2 space-y-3">

            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-grotesk font-semibold text-foreground">Live-Spielfeld</span>
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Echtzeit
                </div>
              </div>
              <div className="aspect-[3/2] max-h-[320px]">
                <FootballPitch dangerZones={liveDangerZones} showGrid />
              </div>
            </div>

            {/* Camera status grid */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-grotesk font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" /> Kamera-Merge
                </span>
                <span className="text-xs text-primary font-medium">KI kombiniert automatisch</span>
              </div>
              <div className={`grid gap-2 ${cameraCount > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {cameras.map((cam) => (
                  <div key={cam.id} className="aspect-video bg-black rounded-lg border border-primary/20 flex flex-col items-center justify-center gap-1 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{ background: 'linear-gradient(135deg, #1a3a1a 0%, #0d260d 100%)' }} />
                    <Video className="w-5 h-5 text-muted-foreground relative z-10" />
                    <div className="text-[10px] text-muted-foreground relative z-10">{cam.position}</div>
                    <div className="text-[9px] text-primary relative z-10">● Verbunden · Code {cam.code}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                💡 Sichtfeld nicht komplett? Die KI ergänzt fehlende Bereiche automatisch durch Multi-Kamera-Fusion.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}