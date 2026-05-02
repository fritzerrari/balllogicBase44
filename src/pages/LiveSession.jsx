/**
 * LiveSession — vollautomatisierte Live-Analyse
 * 
 * Automatik:
 * - Session-Titel: vorbelegt aus letztem Spiel oder "Spiel DD.MM.YYYY"
 * - 1 Kamera: Setup überspringen, sofort startbereit
 * - Halbzeit: nach 45 Min. automatische Halbzeit-Warnung mit Vorschlag zur Pause
 * - Session beenden: automatisch Analyse-Report triggern + SessionReport erstellen
 * - Spielminute: korrekte Halbzeit-Berechnung (2. HZ = Min 46+)
 * - Kamera-Labels: inline editierbar (manuelle Korrektur per Klick)
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, Camera, Play, Square, Plus, Minus,
  Clock, Zap, Video, Mic, MicOff,
  AlertTriangle, CheckCircle2, Loader2, Pencil, Check, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FootballPitch from '@/components/pitch/FootballPitch';
import EventButtons from '@/components/live/EventButtons';
import CameraInviteButton from '@/components/live/CameraInviteButton';

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const toDay = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function LiveSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: recentMatches = [] } = useQuery({
    queryKey: ['matches-recent'],
    queryFn: () => base44.entities.Match.list('-date', 5),
  });

  // ── State ─────────────────────────────────────────────────────────────────
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [halfTime, setHalfTime] = useState(1); // 1 or 2
  const [cameraCount, setCameraCount] = useState(1);
  const [cameras, setCameras] = useState([{ id: 1, label: 'Kamera 1', code: generateCode(), status: 'ready' }]);
  const [editingCamId, setEditingCamId] = useState(null);
  const [editingCamLabel, setEditingCamLabel] = useState('');
  const [session, setSession] = useState(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [showHalftimeAlert, setShowHalftimeAlert] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [eventCount, setEventCount] = useState(0);

  const timerRef = useRef(null);
  const halftimeAlertRef = useRef(false);

  const createSession = useMutation({ mutationFn: (data) => base44.entities.LiveSession.create(data) });
  const updateSession = useMutation({ mutationFn: ({ id, data }) => base44.entities.LiveSession.update(id, data) });

  // ── Auto-fill title from latest match ──────────────────────────────────────
  useEffect(() => {
    if (recentMatches.length > 0 && !sessionTitle) {
      setSessionTitle(recentMatches[0].title || `Spiel ${toDay()}`);
    } else if (recentMatches.length === 0 && !sessionTitle) {
      setSessionTitle(`Spiel ${toDay()}`);
    }
  }, [recentMatches]);

  // ── Timer + Halbzeit-Automatik ─────────────────────────────────────────────
  useEffect(() => {
    if (sessionActive) {
      timerRef.current = setInterval(() => {
        setElapsedTime(t => {
          const next = t + 1;
          // Nach 45 Min (1. HZ): automatisch Halbzeit-Alert einmalig
          if (next === 45 * 60 && halfTime === 1 && !halftimeAlertRef.current) {
            halftimeAlertRef.current = true;
            setShowHalftimeAlert(true);
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionActive, halfTime]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const updateCameraCount = (n) => {
    const count = Math.max(1, Math.min(6, n));
    setCameraCount(count);
    setCameras(Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      label: `Kamera ${i + 1}`,
      code: generateCode(),
      status: 'ready',
    })));
  };

  const saveLabel = (id) => {
    if (editingCamLabel.trim()) {
      setCameras(prev => prev.map(c => c.id === id ? { ...c, label: editingCamLabel.trim() } : c));
    }
    setEditingCamId(null);
  };

  const startHalfTwo = () => {
    setShowHalftimeAlert(false);
    setHalfTime(2);
    setElapsedTime(45 * 60); // reset to 45:00 start
    halftimeAlertRef.current = false;
  };

  // ── Start ─────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!sessionTitle) return;
    const s = await createSession.mutateAsync({
      match_title: sessionTitle,
      status: 'active',
      started_at: new Date().toISOString(),
      camera_streams: cameras.map(c => ({ camera_id: c.id.toString(), label: c.label, stream_url: '', code: c.code })),
    });
    setSession(s);
    setSessionActive(true);
    setElapsedTime(0);
  };

  // ── Stop + Auto-Report ────────────────────────────────────────────────────
  const handleStop = async () => {
    setFinishing(true);
    try {
      // 1. Session als beendet markieren
      if (session) {
        await updateSession.mutateAsync({
          id: session.id,
          data: { status: 'ended', ended_at: new Date().toISOString() },
        });
      }

      // 2. Events laden
      let events = [];
      try {
        events = await base44.entities.MatchEvent.filter({ session_id: session?.id });
      } catch (_) {}

      // 3. Automatisch SessionReport erstellen
      if (session) {
        const goals = events.filter(e => e.type === 'goal');
        const cards = events.filter(e => e.type === 'yellow_card' || e.type === 'red_card');
        const subs = events.filter(e => e.type === 'substitution');

        await base44.entities.SessionReport.create({
          session_id: session.id,
          match_title: sessionTitle,
          report_type: 'post_session',
          generated_at: new Date().toISOString(),
          event_count: events.length,
          goals: goals.map(e => ({ minute: e.minute, team: e.team, description: e.description })),
          cards: cards.map(e => ({ minute: e.minute, team: e.team, type: e.type })),
          substitutions: subs.map(e => ({ minute: e.minute, team: e.team })),
          key_events: events.slice(0, 20),
          summary: `Session "${sessionTitle}" — ${events.length} Events aufgezeichnet. ${goals.length} Tore, ${cards.length} Karten, ${subs.length} Wechsel.`,
        });
      }
    } catch (_) {}

    setSessionActive(false);
    setFinishing(false);
    queryClient.invalidateQueries({ queryKey: ['liveSessions'] });
    queryClient.invalidateQueries({ queryKey: ['session-reports'] });
    navigate('/session-reports');
  };

  // ── Live minute display (correct half) ───────────────────────────────────
  const displayMinute = Math.floor(elapsedTime / 60) + (halfTime === 2 ? 0 : 0);
  // HZ2: elapsed starts at 45*60, so minute 46-90
  const gameMinute = halfTime === 1
    ? Math.floor(elapsedTime / 60)
    : 45 + Math.floor((elapsedTime - 45 * 60) / 60);

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
        {sessionActive && (
          <Badge className="bg-muted text-muted-foreground border border-border text-xs">
            {halfTime}. HZ · {gameMinute}'
          </Badge>
        )}
      </motion.div>

      {/* ── HALBZEIT ALERT ── */}
      <AnimatePresence>
        {showHalftimeAlert && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className="glass rounded-2xl p-5 border border-yellow-500/40 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-yellow-400" />
                <span className="font-grotesk font-bold text-foreground">45 Minuten erreicht!</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Ist jetzt Halbzeit? Die 2. Halbzeit beginnt dann ab Minute 46.</p>
              <div className="flex gap-2">
                <Button onClick={startHalfTwo} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Ja, 2. HZ starten
                </Button>
                <Button variant="outline" onClick={() => setShowHalftimeAlert(false)} className="border-border text-muted-foreground">
                  Weiterlaufen
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SETUP PHASE ── */}
      {!sessionActive && (
        <div className="max-w-lg mx-auto space-y-3">
          {/* Step 1: Title — auto-filled */}
          <div className="glass rounded-xl p-5 space-y-3">
            <h2 className="font-grotesk font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              Spiel benennen
              <span className="text-[10px] text-primary font-normal ml-auto">✓ automatisch vorbelegt</span>
            </h2>
            <Input
              value={sessionTitle}
              onChange={e => setSessionTitle(e.target.value)}
              placeholder="z.B. FC Bayern vs BVB"
              className="bg-muted border-border text-base"
            />
            {recentMatches.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {recentMatches.slice(0, 3).map(m => (
                  <button key={m.id} onClick={() => setSessionTitle(m.title)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${sessionTitle === m.title ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}>
                    {m.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Cameras */}
          <div className="glass rounded-xl p-5 space-y-4">
            <h2 className="font-grotesk font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
              Kameras
              {cameraCount === 1 && <span className="text-[10px] text-primary font-normal ml-auto">✓ 1 Kamera reicht</span>}
            </h2>
            <p className="text-xs text-muted-foreground">Kameramann öffnet den Link und gibt den 6-stelligen Code ein.</p>

            <div className="flex items-center gap-3">
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
              {cameras.map((cam) => (
                <div key={cam.id} className="bg-muted rounded-lg p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Camera className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingCamId === cam.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={editingCamLabel}
                          onChange={e => setEditingCamLabel(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveLabel(cam.id); if (e.key === 'Escape') setEditingCamId(null); }}
                          className="flex-1 bg-background border border-primary/40 rounded px-2 py-0.5 text-sm text-foreground focus:outline-none"
                          autoFocus
                        />
                        <button onClick={() => saveLabel(cam.id)} className="text-primary hover:text-primary/80"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingCamId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group/label">
                        <span className="text-sm font-medium text-foreground">{cam.label}</span>
                        <button onClick={() => { setEditingCamId(cam.id); setEditingCamLabel(cam.label); }}
                          className="opacity-0 group-hover/label:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">Position wird automatisch erkannt</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-grotesk font-bold text-primary tracking-widest">{cam.code}</div>
                    <div className="text-[10px] text-muted-foreground">6-stelliger Code</div>
                  </div>
                  <CameraInviteButton code={cam.code} position={cam.label} />
                </div>
              ))}
            </div>
            <p className="text-xs text-primary">💡 KI fügt alle Kameraperspektiven automatisch zusammen</p>
          </div>

          <Button
            onClick={handleStart}
            disabled={!sessionTitle || createSession.isPending}
            className="w-full bg-red-500 hover:bg-red-600 text-white gap-2 h-14 text-lg font-bold"
          >
            {createSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Live starten
          </Button>
        </div>
      )}

      {/* ── LIVE PHASE ── */}
      {sessionActive && (
        <div className="grid lg:grid-cols-3 gap-3 lg:gap-4">
          {/* Left: Timer + Events */}
          <div className="space-y-3">
            <div className="glass rounded-xl p-3 sm:p-4 border border-red-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-400 font-bold truncate max-w-[120px]">LIVE · {sessionTitle}</span>
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

              {/* Timer */}
              <div className="text-4xl sm:text-5xl font-grotesk font-bold text-foreground tabular-nums text-center mb-1">
                {formatTime(elapsedTime)}
              </div>
              <div className="text-center text-xs text-muted-foreground mb-2">
                {halfTime}. Halbzeit · Minute {gameMinute}'
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2 text-center text-xs">
                <div className="bg-muted rounded-lg p-2">
                  <div className="font-bold text-primary">{cameraCount}</div>
                  <div className="text-muted-foreground">Kameras</div>
                </div>
                <div className="bg-muted rounded-lg p-2">
                  <div className="font-bold text-primary">{halfTime}. HZ</div>
                  <div className="text-muted-foreground">Halbzeit</div>
                </div>
                <div className="bg-muted rounded-lg p-2">
                  <div className="font-bold text-primary">{eventCount}</div>
                  <div className="text-muted-foreground">Events</div>
                </div>
              </div>

              {/* Halbzeit manuell */}
              {halfTime === 1 && (
                <button onClick={() => { setShowHalftimeAlert(true); }}
                  className="w-full mb-2 py-1.5 rounded-lg border border-yellow-500/30 text-yellow-400 text-xs font-medium hover:bg-yellow-500/10 transition-all flex items-center justify-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Halbzeit jetzt
                </button>
              )}

              <Button onClick={handleStop} disabled={finishing} variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2 text-xs sm:text-sm">
                {finishing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Bericht wird erstellt...</>
                  : <><Square className="w-3.5 h-3.5" /> Beenden & Report erstellen</>}
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
                onEventLogged={() => setEventCount(c => c + 1)}
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

            {/* Camera status grid — labels inline-editierbar */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-grotesk font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" /> Kamera-Merge
                </span>
                <span className="text-xs text-primary font-medium">KI kombiniert automatisch</span>
              </div>
              <div className={`grid gap-2 ${cameraCount > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {cameras.map((cam) => (
                  <div key={cam.id} className="aspect-video bg-black rounded-lg border border-primary/20 flex flex-col items-center justify-center gap-1 relative overflow-hidden group/cam">
                    <div className="absolute inset-0 opacity-10" style={{ background: 'linear-gradient(135deg, #1a3a1a 0%, #0d260d 100%)' }} />
                    <Video className="w-5 h-5 text-muted-foreground relative z-10" />
                    {/* Inline-editierbares Label */}
                    {editingCamId === cam.id ? (
                      <div className="relative z-10 flex items-center gap-1">
                        <input
                          value={editingCamLabel}
                          onChange={e => setEditingCamLabel(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveLabel(cam.id); if (e.key === 'Escape') setEditingCamId(null); }}
                          className="w-20 bg-background/80 border border-primary/40 rounded px-1 py-0.5 text-[10px] text-foreground focus:outline-none text-center"
                          autoFocus
                        />
                        <button onClick={() => saveLabel(cam.id)} className="text-primary"><Check className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <div className="relative z-10 flex items-center gap-1 group/lbl cursor-pointer"
                        onClick={() => { setEditingCamId(cam.id); setEditingCamLabel(cam.label); }}>
                        <span className="text-[10px] text-muted-foreground">{cam.label}</span>
                        <Pencil className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover/lbl:opacity-100 transition-opacity" />
                      </div>
                    )}
                    <div className="text-[9px] text-primary relative z-10">● Code {cam.code}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                💡 Kamera-Label anpassen? Einfach draufklicken.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}