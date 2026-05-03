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
  Radio, Camera, Play, Square, Plus,
  Clock, Mic, MicOff, ExternalLink,
  CheckCircle2, Loader2, Check, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FootballPitch from '@/components/pitch/FootballPitch';
import EventButtons from '@/components/live/EventButtons';
import CameraInviteButton from '@/components/live/CameraInviteButton';
import FunkPanel from '@/components/live/FunkPanel';
import CameraStreamCard from '@/components/live/CameraStreamCard';

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
  const [halfTime, setHalfTime] = useState(1);
  const [cameras, setCameras] = useState([{ id: 1, label: 'Kamera 1' }]);
  const [editingCamId, setEditingCamId] = useState(null);
  const [editingCamLabel, setEditingCamLabel] = useState('');
  const [session, setSession] = useState(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [showHalftimeAlert, setShowHalftimeAlert] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [funkOpen, setFunkOpen] = useState(false);

  const timerRef = useRef(null);
  const halftimeAlertRef = useRef(false);

  const createSession = useMutation({ mutationFn: (data) => base44.entities.LiveSession.create(data) });
  const updateSession = useMutation({ mutationFn: ({ id, data }) => base44.entities.LiveSession.update(id, data) });

  // ── Auto-fill title from latest match ──────────────────────────────────────
  useEffect(() => {
    if (!sessionTitle) {
      const title = recentMatches.length > 0 ? recentMatches[0].title : `Spiel ${toDay()}`;
      setSessionTitle(title);
    }
  }, [recentMatches, sessionTitle]);

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



  const startHalfTwo = () => {
    setShowHalftimeAlert(false);
    setHalfTime(2);
    setElapsedTime(45 * 60);
    halftimeAlertRef.current = false;
    // In DB schreiben — Kameras zeigen Seitenwechsel-Banner
    if (session) {
      updateSession.mutate({ id: session.id, data: { half_time: 2 } });
    }
  };

  // ── Start: Create Session ────────────────────────────────────────────────
  const handleStart = async () => {
    if (!sessionTitle) return;

    let matchId = null;
    try {
      const m = await base44.entities.Match.create({
        title: sessionTitle,
        date: new Date().toISOString().split('T')[0],
        home_team: 'Team A',
        away_team: 'Team B',
        status: 'live',
      });
      matchId = m.id;
    } catch (_) {
      console.warn('⚠️ Auto-Match creation failed');
    }

    const s = await createSession.mutateAsync({
      match_title: sessionTitle,
      match_id: matchId,
      status: 'active',
      half_time: 1,
      started_at: new Date().toISOString(),
      camera_streams: cameras.map(c => ({ camera_id: c.id.toString(), label: c.label, stream_url: '', status: 'waiting' })),
    });
    setSession(s);
    setSessionActive(true);
    setElapsedTime(0);
  };

  // ── Stop + Auto-Report ────────────────────────────────────────────────────
  const handleStop = async () => {
    setFinishing(true);
    try {
      if (session) {
        // Mark session ended first (triggers onSessionEnd automation for heatmaps)
        await updateSession.mutateAsync({
          id: session.id,
          data: { status: 'ended', ended_at: new Date().toISOString() },
        });
        // Use finalizeSession backend function for report + cleanup
        await base44.functions.invoke('finalizeSession', { session_id: session.id });
      }
    } catch (err) {
      console.error('❌ Session finalization failed:', err);
    }

    setSessionActive(false);
    setFinishing(false);
    queryClient.invalidateQueries({ queryKey: ['liveSessions'] });
    queryClient.invalidateQueries({ queryKey: ['session-reports'] });
    if (session?.match_id) {
      navigate(`/analytics?match=${session.match_id}`);
    } else {
      navigate('/session-reports');
    }
  };



  // ── Add/Remove Cameras ────────────────────────────────────────────────────
  const addCamera = () => {
    const newCam = { id: cameras.length + 1, label: `Kamera ${cameras.length + 1}` };
    setCameras([...cameras, newCam]);
  };

  const deleteCamera = (id) => {
    setCameras(cameras.filter(c => c.id !== id));
  };

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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-4 flex-wrap">
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
        {/* PTT-Status wird im Funk-Panel angezeigt */}
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
          {/* Title + Cameras */}
          <div className="glass rounded-xl p-5 space-y-3">
            <h2 className="font-grotesk font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              Spiel benennen
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

          {/* Kameras */}
          <div className="glass rounded-xl p-5 space-y-3">
            <h2 className="font-grotesk font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
              Kameras
            </h2>
            <p className="text-xs text-muted-foreground">Kameramann öffnet den Session-Link direkt nach Session-Start.</p>

            <div className="space-y-2">
              {cameras.map((cam) => (
                <div key={cam.id} className="bg-muted rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Camera className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      {editingCamId === cam.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={editingCamLabel}
                            onChange={e => setEditingCamLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { setCameras(prev => prev.map(c => c.id === cam.id ? { ...c, label: editingCamLabel } : c)); setEditingCamId(null); } }}
                            className="flex-1 bg-background border border-primary/40 rounded px-2 py-0.5 text-sm text-foreground focus:outline-none"
                            autoFocus
                          />
                          <button onClick={() => { setCameras(prev => prev.map(c => c.id === cam.id ? { ...c, label: editingCamLabel } : c)); setEditingCamId(null); }} className="text-primary"><Check className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="font-medium text-foreground">{cam.label}</div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteCamera(cam.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button onClick={addCamera} variant="outline" className="w-full gap-2">
              <Plus className="w-4 h-4" /> Kamera hinzufügen
            </Button>
          </div>

          <Button
            onClick={handleStart}
            disabled={!sessionTitle || createSession.isPending}
            className="w-full bg-red-500 hover:bg-red-600 text-white gap-2 h-14 text-lg font-bold"
          >
            {createSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Session starten
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
                 <div className="font-bold text-primary">{cameras.length}</div>
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

              {/* Zum Cockpit wechseln — gleiche Session, gleiche Kameras */}
              <button
                onClick={() => navigate('/cockpit')}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Coaching Cockpit öffnen
              </button>

              {/* Funk Button — nur wenn Session aktiv */}
              {session && (
                <button
                  onClick={() => setFunkOpen(o => !o)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    funkOpen
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                  }`}>
                  <Radio className="w-3.5 h-3.5" />
                  📻 Funk-Kanal {funkOpen ? 'schließen' : 'öffnen'}
                </button>
              )}
            </div>

            {/* Event Buttons */}
            <div className="glass rounded-xl p-3 sm:p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-bold mb-2.5">Event tippen</div>
              <EventButtons
                sessionId={session?.id}
                matchId={session?.match_id}
                matchTitle={sessionTitle}
                source="coach"
                elapsedSeconds={elapsedTime}
                compact={true}
                onEventLogged={() => setEventCount(c => c + 1)}
              />
            </div>
          </div>

          {/* Funk Panel */}
          <AnimatePresence>
            {funkOpen && session && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="glass rounded-xl overflow-hidden" style={{ height: 360 }}>
                  <FunkPanel sessionId={session.id} onClose={() => setFunkOpen(false)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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

            {/* Camera Links */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-grotesk font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" /> Kameras
                  <span className="text-xs text-muted-foreground font-normal">{cameras.length}</span>
                </span>
                <button onClick={addCamera}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Kamera hinzufügen
                </button>
              </div>
              <div className="space-y-2">
                {cameras.map((cam) => {
                  const camLink = `${window.location.origin}/cam?session=${session?.id}`;
                  return (
                    <div key={cam.id} className="bg-muted rounded-lg p-3 flex items-center gap-3">
                      <Camera className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{cam.label}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {camLink.replace('http://', '').replace('https://', '')}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(camLink);
                          setTimeout(() => alert('Link kopiert!'), 100);
                        }}
                        className="px-2 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-all flex-shrink-0"
                      >
                        Kopieren
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}