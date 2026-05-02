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
    setElapsedTime(45 * 60);
    halftimeAlertRef.current = false;
    // In DB schreiben — Kameras zeigen Seitenwechsel-Banner
    if (session) {
      updateSession.mutate({ id: session.id, data: { half_time: 2 } });
    }
  };

  // ── Start (Setup → Create Session für Funk) ────────────────────────────────
  // ── Start ─────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    // Validierungen
    if (!sessionTitle) return;
    if (cameras.length === 0) {
      alert('Mindestens 1 Kamera erforderlich');
      return;
    }

    // Try: Auto-create Match wenn nicht vorhanden
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
      console.warn('⚠️ Auto-Match creation failed, continuing without match_id');
    }

    const s = await createSession.mutateAsync({
      match_title: sessionTitle,
      match_id: matchId,
      status: 'ready',
      half_time: 1,
      started_at: new Date().toISOString(),
      camera_streams: cameras.map(c => ({ camera_id: c.id.toString(), label: c.label, stream_url: '', code: c.code, status: 'waiting', enabled: c.enabled !== false })),
    });
    setSession(s);
  };

  const handleLiveStart = async () => {
    if (!session) return;
    await updateSession.mutateAsync({ id: session.id, data: { status: 'active' } });
    setSessionActive(true);
    setElapsedTime(0);
  };

  // ── Stop + Auto-Report ────────────────────────────────────────────────────
  const handleStop = async () => {
    setFinishing(true);
    try {
      // 1. Session als beendet markieren + Match.status updaten
      if (session) {
        await updateSession.mutateAsync({
          id: session.id,
          data: { status: 'ended', ended_at: new Date().toISOString() },
        });
        // Update Match.status → 'analyzed' (damit Dashboard "LIVE" verschwindet)
        if (session.match_id) {
          base44.entities.Match.update(session.match_id, { status: 'analyzed' }).catch(() => {});
        }
        // FunkMessages der Session aufräumen
        try {
          const funkMsgs = await base44.entities.FunkMessage.filter({ session_id: session.id });
          await Promise.all(funkMsgs.map(m => base44.entities.FunkMessage.delete(m.id)));
        } catch (_) {}
      }

      // 2. Events laden
      let events = [];
      try {
        events = await base44.entities.MatchEvent.filter({ session_id: session?.id });
      } catch (_) {}

      // 3. Automatisch SessionReport erstellen (mit Delta-Tracking für Kameras)
      if (session) {
        const goals = events.filter(e => e.type === 'goal');
        const cards = events.filter(e => e.type === 'yellow_card' || e.type === 'red_card');
        const subs = events.filter(e => e.type === 'substitution');
        
        // Delta-Check: vergleiche finale vs initial camera count
        const cameraStreams = session.camera_streams || [];
        const initialCount = cameras.length;
        const cameraChanges = cameraStreams.length !== initialCount ? `Kameras: ${initialCount} → ${cameraStreams.length}` : null;

        await base44.entities.SessionReport.create({
          session_id: session.id,
          match_id: session.match_id,
          match_title: sessionTitle,
          report_type: 'post_session',
          generated_at: new Date().toISOString(),
          event_count: events.length,
          goals: goals.map(e => ({ minute: e.minute, team: e.team, description: e.description })),
          cards: cards.map(e => ({ minute: e.minute, team: e.team, type: e.type })),
          substitutions: subs.map(e => ({ minute: e.minute, team: e.team })),
          key_events: events.slice(0, 20),
          summary: `Session "${sessionTitle}" — ${events.length} Events aufgezeichnet. ${goals.length} Tore, ${cards.length} Karten, ${subs.length} Wechsel.${cameraChanges ? ` [⚠️ ${cameraChanges}]` : ''}`,
        });
      }
    } catch (_) {}

    setSessionActive(false);
    setFinishing(false);
    queryClient.invalidateQueries({ queryKey: ['liveSessions'] });
    queryClient.invalidateQueries({ queryKey: ['session-reports'] });
    // Navigiere zur Analyse wenn match_id vorhanden, sonst zu Reports
    if (session?.match_id) {
      navigate(`/analytics?match=${session.match_id}`);
    } else {
      navigate('/session-reports');
    }
  };

  // Live camera status — efficient single lookup instead of .list()
  const [liveCameraStreams, setLiveCameraStreams] = useState([]);
  useEffect(() => {
    if (!session?.id) return; // Safety: must have session.id
    const sessionId = session.id; // Capture in closure
    const poll = async () => {
      try {
        // CRITICAL FIX: use direct filter instead of .list() + find
        const fresh = await base44.entities.LiveSession.filter({ id: sessionId }, '-created_date', 1);
        if (fresh?.[0]?.camera_streams) setLiveCameraStreams(fresh[0].camera_streams);
      } catch (_) {}
    };
    poll(); // Initial call
    const interval = setInterval(poll, 8000); // 8s (not 5s) to reduce API calls
    return () => clearInterval(interval);
  }, [session?.id]);

  // ── Kamera während laufender Session hinzufügen ───────────────────────────
  const addCameraLive = async () => {
    const newCam = { id: cameras.length + 1, label: `Kamera ${cameras.length + 1}`, code: generateCode(), status: 'waiting', enabled: true };
    const updatedCameras = [...cameras, newCam];
    setCameras(updatedCameras);
    setCameraCount(updatedCameras.length);
    if (session) {
      const updatedStreams = updatedCameras.map(c => ({
        camera_id: c.id.toString(), label: c.label, stream_url: '', code: c.code, status: 'waiting', enabled: c.enabled !== false,
      }));
      await base44.entities.LiveSession.update(session.id, { camera_streams: updatedStreams });
      setLiveCameraStreams(updatedStreams);
    }
  };

  const deleteCamera = async (id) => {
    const updatedCameras = cameras.filter(c => c.id !== id);
    setCameras(updatedCameras);
    setCameraCount(updatedCameras.length);
    if (session) {
      const updatedStreams = updatedCameras.map(c => ({
        camera_id: c.id.toString(), label: c.label, stream_url: '', code: c.code, status: c.status || 'waiting', enabled: c.enabled !== false,
      }));
      await base44.entities.LiveSession.update(session.id, { camera_streams: updatedStreams });
      setLiveCameraStreams(updatedStreams);
    }
  };

  const toggleCameraEnabled = async (id, currentEnabled) => {
    const updatedCameras = cameras.map(c => c.id === id ? { ...c, enabled: !currentEnabled } : c);
    setCameras(updatedCameras);
    if (session) {
      const updatedStreams = updatedCameras.map(c => ({
        camera_id: c.id.toString(), label: c.label, stream_url: '', code: c.code, status: c.status || 'waiting', enabled: c.enabled !== false,
      }));
      await base44.entities.LiveSession.update(session.id, { camera_streams: updatedStreams });
      setLiveCameraStreams(updatedStreams);
    }
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
          {/* Wenn Session bereit: Setup-Modal mit Kamera-Overview */}
          {session && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur z-40 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-b from-card to-card/80 px-6 py-4 border-b border-border/50">
                  <h2 className="font-grotesk font-bold text-xl text-foreground">Session bereit</h2>
                  <p className="text-xs text-muted-foreground mt-1">{sessionTitle}</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Status Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 text-center">
                      <div className="text-2xl font-grotesk font-bold text-primary">{cameras.length}</div>
                      <div className="text-xs text-muted-foreground mt-1">Kameras konfiguriert</div>
                    </div>
                    <div className={`rounded-xl border p-3 text-center ${liveCameraStreams.filter(s => s.status === 'connected').length > 0 ? 'bg-primary/10 border-primary/30' : 'bg-muted border-border'}`}>
                      <div className="text-2xl font-grotesk font-bold text-primary">{liveCameraStreams.filter(s => s.status === 'connected').length}</div>
                      <div className="text-xs text-muted-foreground mt-1">Kameras verbunden</div>
                    </div>
                    <div className={`rounded-xl border p-3 text-center ${liveCameraStreams.some(s => s.thumbnail) ? 'bg-primary/10 border-primary/30' : 'bg-muted border-border'}`}>
                      <div className="text-2xl font-grotesk font-bold text-primary">{liveCameraStreams.filter(s => s.thumbnail).length}</div>
                      <div className="text-xs text-muted-foreground mt-1">Mit Live-Bild</div>
                    </div>
                  </div>

                  {/* Kamera-Grid mit Einladung inline */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-grotesk font-semibold text-foreground">Kameras</h3>
                      <button onClick={addCameraLive}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-all">
                        <Plus className="w-3.5 h-3.5" /> Kamera hinzufügen
                      </button>
                    </div>
                    <div className={`grid gap-3 ${cameras.length > 2 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
                      {cameras.map(cam => {
                        const liveStream = liveCameraStreams.find(s => String(s.code) === String(cam.code));
                        const isConnected = liveStream?.status === 'connected';
                        const thumbnail = liveStream?.thumbnail;
                        return (
                          <div key={cam.id} className={`rounded-xl border overflow-hidden flex flex-col transition-all ${isConnected ? 'border-primary/60 bg-primary/5' : 'border-border/50 bg-muted/30'}`}>
                            {/* Thumbnail */}
                            <div className={`aspect-video bg-black relative flex items-center justify-center overflow-hidden group/thumb`}>
                              {thumbnail ? (
                                <img src={thumbnail} alt={cam.label} className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-center">
                                  <Video className="w-6 h-6 text-muted-foreground/50 mx-auto mb-1" />
                                  <div className="text-[10px] text-muted-foreground/60">{isConnected ? 'Wird geladen...' : 'Wartet auf Kamera'}</div>
                                </div>
                              )}
                              {/* Status Badge */}
                              <div className={`absolute top-2 left-2 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 ${isConnected ? 'bg-primary/80 text-primary-foreground' : 'bg-black/70 text-muted-foreground'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-muted-foreground'}`} />
                                {isConnected ? 'LIVE' : 'WARTET'}
                              </div>
                            </div>

                            {/* Info + Actions */}
                            <div className="p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground truncate">{cam.label}</div>
                                  <div className="text-xs text-muted-foreground font-mono tracking-widest">{cam.code}</div>
                                </div>
                                <button onClick={() => deleteCamera(cam.id)}
                                  className="flex-shrink-0 w-7 h-7 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/40 flex items-center justify-center text-sm font-bold transition-all"
                                  title="Kamera löschen">
                                  ✕
                                </button>
                              </div>

                              {/* Invite Actions */}
                              <div className="space-y-1.5">
                                <CameraInviteButton code={cam.code} position={cam.label} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hinweis */}
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <p className="text-xs text-muted-foreground/80 leading-relaxed">
                      💡 <strong>Tipp:</strong> Teile den Code oder Link mit deinem Kameramann. Sobald er den Code eingibt, siehst du hier das Live-Bild. Du kannst dann Live starten.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gradient-to-t from-card to-card/80 px-6 py-4 border-t border-border/50 flex gap-2">
                  <Button variant="outline" onClick={() => { setSession(null); setCameras([]); setCameraCount(1); }}
                    className="flex-1">
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handleLiveStart}
                    disabled={liveCameraStreams.filter(s => s.status === 'connected').length === 0}
                    className="flex-1 bg-primary text-primary-foreground gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    title={liveCameraStreams.filter(s => s.status === 'connected').length === 0 ? 'Warte bis mindestens eine Kamera verbunden ist' : ''}
                  >
                    <Play className="w-4 h-4" /> Live starten ({liveCameraStreams.filter(s => s.status === 'connected').length}/{cameras.length})
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* ── SETUP PHASE (Kamera Konfiguration) ── */}
      {!sessionActive && !session && (
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
            Weiter
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

            {/* Camera status grid — live + add during session */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-grotesk font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" /> Kameras
                  <span className="text-xs text-muted-foreground font-normal">
                    {liveCameraStreams.filter(s => s.status === 'connected').length}/{cameras.length} online
                  </span>
                </span>
                {/* + Kamera während Live */}
                <button onClick={addCameraLive}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Kamera hinzufügen
                </button>
              </div>
              <div className={`grid gap-3 ${cameras.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {cameras.map((cam) => {
                  const liveStream = liveCameraStreams.find(s => String(s.code) === String(cam.code));
                  const isConnected = liveStream?.status === 'connected';
                  return (
                    <CameraStreamCard
                      key={cam.id}
                      cam={cam}
                      sessionId={session?.id}
                      isConnected={isConnected}
                      onDelete={() => deleteCamera(cam.id)}
                      onEdit={() => { setEditingCamId(cam.id); setEditingCamLabel(cam.label); }}
                      onShare={() => {}}
                      onCopyCode={() => {}}
                      copied={null}
                    />
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Kamera-Label: klicken zum Bearbeiten · neue Kamera teilen über <span className="text-primary">Share-Icon</span> pro Karte
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}