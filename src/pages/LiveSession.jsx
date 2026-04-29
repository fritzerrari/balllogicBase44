import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Radio, Camera, Play, Square, Plus, Minus,
  Clock, Zap, Activity, Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import FootballPitch from '@/components/pitch/FootballPitch';

export default function LiveSession() {
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cameraCount, setCameraCount] = useState(1);
  const [liveNotes, setLiveNotes] = useState([]);
  const [noteInput, setNoteInput] = useState('');
  const [session, setSession] = useState(null);
  const timerRef = useRef(null);
  const queryClient = useQueryClient();

  const createSession = useMutation({
    mutationFn: (data) => base44.entities.LiveSession.create(data),
  });

  const updateSession = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LiveSession.update(id, data),
  });

  useEffect(() => {
    if (sessionActive) {
      timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionActive]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleStart = async () => {
    if (!sessionTitle) return;
    const s = await createSession.mutateAsync({
      match_title: sessionTitle,
      status: 'active',
      started_at: new Date().toISOString(),
    });
    setSession(s);
    setSessionActive(true);
    setElapsedTime(0);
  };

  const handleStop = async () => {
    if (session) {
      await updateSession.mutateAsync({
        id: session.id,
        data: { status: 'ended', ended_at: new Date().toISOString() }
      });
    }
    setSessionActive(false);
    queryClient.invalidateQueries({ queryKey: ['liveSessions'] });
  };

  const addNote = () => {
    if (!noteInput.trim()) return;
    setLiveNotes(prev => [...prev, {
      text: noteInput,
      minute: Math.floor(elapsedTime / 60),
      time: formatTime(elapsedTime)
    }]);
    setNoteInput('');
  };

  // Simulated live danger zones that change over time
  const liveDangerZones = sessionActive ? [
    { x: 75, y: 50, intensity: 0.7, team: 'home' },
    { x: 25, y: 45, intensity: 0.5, team: 'away' },
    { x: 85, y: 30, intensity: 0.4, team: 'home' },
  ] : [];

  return (
    <div className="p-6 lg:p-8 min-h-screen">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-4 h-4 text-red-400" />
          <span className="text-xs text-muted-foreground font-medium tracking-widest uppercase">Live-Analyse</span>
        </div>
        <h1 className="text-3xl font-grotesk font-bold text-foreground">Live-Session</h1>
        <p className="text-muted-foreground">Echtzeit-Analyse während des Spiels</p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          {!sessionActive ? (
            <div className="glass rounded-xl p-5 space-y-4">
              <h2 className="font-grotesk font-semibold text-foreground">Session starten</h2>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Spielbezeichnung</Label>
                <Input
                  value={sessionTitle}
                  onChange={e => setSessionTitle(e.target.value)}
                  placeholder="z.B. FC Bayern vs BVB"
                  className="bg-muted border-border"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Anzahl Kameras</Label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCameraCount(c => Math.max(1, c - 1))} className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center hover:border-primary/30 transition-colors">
                    <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <span className="font-grotesk font-bold text-foreground text-lg w-8 text-center">{cameraCount}</span>
                  <button onClick={() => setCameraCount(c => Math.min(6, c + 1))} className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center hover:border-primary/30 transition-colors">
                    <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: cameraCount }).map((_, i) => (
                  <div key={i} className="bg-muted rounded-lg p-3 text-center border border-border">
                    <Camera className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                    <div className="text-xs text-muted-foreground">Kamera {i + 1}</div>
                    <div className="text-[10px] text-primary mt-0.5">Bereit</div>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleStart}
                disabled={!sessionTitle || createSession.isPending}
                className="w-full bg-red-500 hover:bg-red-600 text-white gap-2"
              >
                <Play className="w-4 h-4" /> Live starten
              </Button>
            </div>
          ) : (
            <div className="glass rounded-xl p-5 border border-red-500/30">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs">LIVE</Badge>
              </div>
              <div className="text-center mb-4">
                <div className="text-4xl font-grotesk font-bold text-foreground tabular-nums">{formatTime(elapsedTime)}</div>
                <div className="text-xs text-muted-foreground mt-1">Spielzeit</div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                <div className="bg-muted rounded-lg p-2">
                  <div className="text-primary font-bold text-lg">{cameraCount}</div>
                  <div className="text-[10px] text-muted-foreground">Kameras aktiv</div>
                </div>
                <div className="bg-muted rounded-lg p-2">
                  <div className="text-primary font-bold text-lg">{liveNotes.length}</div>
                  <div className="text-[10px] text-muted-foreground">Notizen</div>
                </div>
              </div>
              <Button onClick={handleStop} variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2">
                <Square className="w-4 h-4" /> Session beenden
              </Button>
            </div>
          )}

          {/* Live Notes */}
          {sessionActive && (
            <div className="glass rounded-xl p-5">
              <h3 className="font-grotesk font-semibold text-foreground mb-3">Live-Notizen</h3>
              <div className="flex gap-2 mb-3">
                <Input
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNote()}
                  placeholder="Beobachtung..."
                  className="bg-muted border-border text-sm"
                />
                <Button onClick={addNote} size="sm" className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {liveNotes.slice().reverse().map((note, i) => (
                  <div key={i} className="bg-muted rounded-lg px-3 py-2 flex gap-2">
                    <span className="text-xs text-primary font-mono flex-shrink-0">{note.time}</span>
                    <span className="text-xs text-foreground">{note.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Pitch View */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-grotesk font-semibold text-foreground">Live-Spielfeld</h2>
              {sessionActive && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Echtzeit
                </div>
              )}
            </div>
            <div className="aspect-[3/2] max-h-[380px]">
              <FootballPitch dangerZones={liveDangerZones} showGrid={sessionActive} />
            </div>
            {!sessionActive && (
              <div className="text-center mt-4 text-sm text-muted-foreground">
                Session starten um Live-Daten zu sehen
              </div>
            )}
          </div>

          {/* Camera Grid Placeholder */}
          {sessionActive && (
            <div className="glass rounded-xl p-5">
              <h3 className="font-grotesk font-semibold text-foreground mb-3 flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" /> Kamera-Feeds
              </h3>
              <div className={`grid gap-3 ${cameraCount > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {Array.from({ length: cameraCount }).map((_, i) => (
                  <div key={i} className="aspect-video bg-black rounded-lg border border-border flex flex-col items-center justify-center gap-2">
                    <Video className="w-6 h-6 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground">Kamera {i + 1}</div>
                    <div className="text-[10px] text-primary">● Verbunden</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}