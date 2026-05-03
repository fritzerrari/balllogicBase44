/**
 * LiveSession — NEUE, SAUBERE Implementierung
 * 
 * EINFACHE 2-PHASEN WORKFLOW:
 * 1. SETUP: Session-Konfiguration + Kamera-Setup
 * 2. COACHING: Live-Timer + Tracking + Events (alles in einer View)
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, Camera, Play, Square, Plus, Clock, Mic, MicOff,
  CheckCircle2, Loader2, Check, X, Eye, Video, Target, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FootballPitch from '@/components/pitch/FootballPitch';
import EventButtons from '@/components/live/EventButtons';
import FunkPanel from '@/components/live/FunkPanel';
import KickoffDetectionPanel from '@/components/live/KickoffDetectionPanel';
import VideoOverlayPlayer from '@/components/tracking/VideoOverlayPlayer';
import LiveStats from '@/components/live/LiveStats';
import EventLog from '@/components/live/EventLog';
import TrackingOverlay from '@/components/live/TrackingOverlay';
import CoveragePitchOverlay from '@/components/pitch/CoveragePitchOverlay';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const toDay = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function LiveSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const sessionIdFromUrl = searchParams.get('session');

  // ── STATE ──────────────────────────────────────────────────
  const [phase, setPhase] = useState('setup'); // 'setup' | 'coaching'
  const [sessionTitle, setSessionTitle] = useState('');
  const [cameras, setCameras] = useState([{ id: 1, label: 'Kamera 1' }]);
  const [session, setSession] = useState(null);
  const [editingCamId, setEditingCamId] = useState(null);
  const [editingCamLabel, setEditingCamLabel] = useState('');

  // Coaching phase
  const [elapsedTime, setElapsedTime] = useState(0);
  const [halfTime, setHalfTime] = useState(1);
  const [eventCount, setEventCount] = useState(0);
  const [showHalftimeAlert, setShowHalftimeAlert] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [showFunk, setShowFunk] = useState(false);
  const [showKickoff, setShowKickoff] = useState(false);

  const timerRef = useRef(null);
  const halftimeRef = useRef(false);

  // ── MUTATIONS ──────────────────────────────────────────────
  const createSession = useMutation({
    mutationFn: (data) => base44.entities.LiveSession.create(data),
    onError: (err) => {
      console.error('❌ Session creation failed:', err.message);
      alert('❌ Session konnte nicht gestartet werden: ' + err.message);
    }
  });

  const updateSession = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LiveSession.update(id, data),
    onError: (err) => console.warn('⚠️ Update warning:', err.message)
  });

  // ── AUTO-LOAD SESSION IF URL ───────────────────────────────
  useEffect(() => {
    if (!sessionIdFromUrl) return;
    
    base44.entities.LiveSession.filter({ id: sessionIdFromUrl })
      .then(sessions => {
        if (sessions[0]) {
          setSession(sessions[0]);
          setSessionTitle(sessions[0].match_title || 'Session');
          setCameras(sessions[0].camera_streams?.map(c => ({ id: c.camera_id, label: c.label })) || []);
          setPhase('coaching');
        }
      })
      .catch(err => console.error('Session load failed:', err.message));
  }, [sessionIdFromUrl]);

  // ── TIMER ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'coaching') return;
    
    timerRef.current = setInterval(() => {
      setElapsedTime(t => {
        const next = t + 1;
        if (next === 45 * 60 && halfTime === 1 && !halftimeRef.current) {
          halftimeRef.current = true;
          setShowHalftimeAlert(true);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [phase, halfTime]);

  // ── HANDLERS ───────────────────────────────────────────────
  const handleStartSession = async () => {
    if (!sessionTitle.trim()) {
      alert('⚠️ Bitte geben Sie einen Spieltitel ein');
      return;
    }

    try {
      const s = await createSession.mutateAsync({
        match_title: sessionTitle,
        status: 'active',
        half_time: 1,
        started_at: new Date().toISOString(),
        camera_streams: cameras.map(c => ({
          camera_id: c.id.toString(),
          label: c.label,
          stream_url: '',
          status: 'waiting',
          code: Math.random().toString(36).substring(2, 8).toUpperCase()
        })),
      });

      setSession(s);
      setPhase('coaching');
      setElapsedTime(0);
    } catch (err) {
      console.error('Session creation failed:', err);
    }
  };

  const handleStopSession = async () => {
    if (!confirm('🛑 Session wirklich beenden?')) return;
    
    setFinishing(true);
    try {
      if (session) {
        await updateSession.mutateAsync({
          id: session.id,
          data: { status: 'ended', ended_at: new Date().toISOString() }
        });
        
        // Fire & forget finalization
        base44.functions.invoke('finalizeSession', { session_id: session.id }).catch(() => {});
      }
    } catch (err) {
      console.warn('Stop warning:', err.message);
    }

    setFinishing(false);
    setPhase('setup');
    setSession(null);
    setElapsedTime(0);
    setEventCount(0);
    setHalfTime(1);
    halftimeRef.current = false;

    // Navigate to analytics if match exists
    setTimeout(() => {
      if (session?.match_id) {
        navigate(`/analytics?match=${session.match_id}`);
      }
    }, 300);
  };

  const addCamera = () => {
    const newId = Math.max(...cameras.map(c => c.id), 0) + 1;
    setCameras([...cameras, { id: newId, label: `Kamera ${newId}` }]);
  };

  const deleteCamera = (id) => {
    if (cameras.length === 1) {
      alert('⚠️ Mindestens 1 Kamera erforderlich');
      return;
    }
    setCameras(cameras.filter(c => c.id !== id));
  };

  const handleHalfTwo = () => {
    setShowHalftimeAlert(false);
    setHalfTime(2);
    setElapsedTime(45 * 60);
    halftimeRef.current = false;
    if (session) {
      updateSession.mutate({ id: session.id, data: { half_time: 2 } });
    }
  };

  // ── DERIVED ────────────────────────────────────────────────
  const gameMinute = halfTime === 1 ? Math.floor(elapsedTime / 60) : 45 + Math.floor((elapsedTime - 45 * 60) / 60);

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-8 min-h-screen">
      {/* SETUP PHASE */}
      {phase === 'setup' && (
        <div className="max-w-lg mx-auto space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-6">
            <Radio className="w-5 h-5 text-red-500" />
            <h1 className="text-3xl font-grotesk font-bold text-foreground">Live-Session</h1>
          </motion.div>

          <div className="glass rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Spielname</label>
              <Input
                value={sessionTitle}
                onChange={e => setSessionTitle(e.target.value)}
                placeholder="z.B. Bayern vs Dortmund"
                className="bg-muted border-border text-lg"
                onKeyDown={e => e.key === 'Enter' && handleStartSession()}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block flex items-center gap-2">
                <Camera className="w-3 h-3" /> Kameras
              </label>
              <div className="space-y-2 mb-3">
                {cameras.map(cam => (
                  <div key={cam.id} className="bg-muted rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <Camera className="w-4 h-4 text-primary" />
                      {editingCamId === cam.id ? (
                        <input
                          value={editingCamLabel}
                          onChange={e => setEditingCamLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              setCameras(cameras.map(c => c.id === cam.id ? { ...c, label: editingCamLabel } : c));
                              setEditingCamId(null);
                            }
                          }}
                          className="flex-1 bg-background border border-primary/40 rounded px-2 py-1 text-sm focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-medium flex-1">{cam.label}</span>
                      )}
                    </div>
                    {editingCamId === cam.id ? (
                      <button
                        onClick={() => {
                          setCameras(cameras.map(c => c.id === cam.id ? { ...c, label: editingCamLabel } : c));
                          setEditingCamId(null);
                        }}
                        className="text-primary"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingCamId(cam.id);
                          setEditingCamLabel(cam.label);
                        }}
                        className="text-muted-foreground hover:text-foreground text-xs px-2 py-1"
                      >
                        Edit
                      </button>
                    )}
                    <button onClick={() => deleteCamera(cam.id)} className="text-destructive hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button onClick={addCamera} variant="outline" className="w-full gap-2 text-sm">
                <Plus className="w-4 h-4" /> Kamera hinzufügen
              </Button>
            </div>

            <Button
              onClick={handleStartSession}
              disabled={createSession.isPending || !sessionTitle.trim()}
              className="w-full bg-red-600 hover:bg-red-700 text-white gap-2 h-12 text-lg font-bold"
            >
              {createSession.isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Starten...</>
              ) : (
                <><Play className="w-5 h-5" /> Session Starten</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* COACHING PHASE */}
      {phase === 'coaching' && session && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* LEFT: TIMER + EVENTS */}
          <div className="space-y-4">
            {/* Timer Box */}
            <div className="glass rounded-xl p-5 border-2 border-red-500/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-bold text-red-400">● LIVE</span>
                </div>
                <button
                  onMouseDown={() => setIsMicActive(true)}
                  onMouseUp={() => setIsMicActive(false)}
                  onTouchStart={() => setIsMicActive(true)}
                  onTouchEnd={() => setIsMicActive(false)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isMicActive ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'
                  }`}
                >
                  {isMicActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="text-5xl font-grotesk font-bold text-foreground text-center mb-1">
                {formatTime(elapsedTime)}
              </div>
              <div className="text-center text-xs text-muted-foreground mb-4">
                {halfTime}. Halbzeit · Minute {gameMinute}'
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
                <div className="bg-muted rounded-lg p-2">
                  <div className="font-bold text-primary">{cameras.length}</div>
                  <div className="text-muted-foreground text-[10px]">Kameras</div>
                </div>
                <div className="bg-muted rounded-lg p-2">
                  <div className="font-bold text-primary">{halfTime}</div>
                  <div className="text-muted-foreground text-[10px]">HZ</div>
                </div>
                <div className="bg-muted rounded-lg p-2">
                  <div className="font-bold text-primary">{eventCount}</div>
                  <div className="text-muted-foreground text-[10px]">Events</div>
                </div>
              </div>

              {halfTime === 1 && (
                <button
                  onClick={() => setShowHalftimeAlert(true)}
                  className="w-full mb-2 py-2 rounded-lg border border-yellow-500/30 text-yellow-400 text-xs font-bold hover:bg-yellow-500/10 flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" /> Halbzeit (45')
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleStopSession}
                  disabled={finishing}
                  variant="outline"
                  className="border-red-500/30 text-red-400 gap-2"
                >
                  {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                  Beenden
                </Button>
                <Button onClick={() => setShowFunk(!showFunk)} className="bg-primary/20 text-primary gap-2">
                  <Radio className="w-4 h-4" /> Funk
                </Button>
              </div>
            </div>

            {/* Event Buttons */}
            <div className="glass rounded-xl p-3">
              <div className="text-xs font-bold text-muted-foreground uppercase mb-2">⚽ Events</div>
              <EventButtons
                sessionId={session.id}
                matchId={session.match_id}
                matchTitle={sessionTitle}
                source="coach"
                elapsedSeconds={elapsedTime}
                compact
                onEventLogged={() => setEventCount(c => c + 1)}
              />
            </div>
          </div>

          {/* CENTER: FIELD + VIDEO */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass rounded-xl p-4">
              <div className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5" /> Live-Spielfeld
              </div>
              <div className="aspect-[3/2] max-h-[280px]">
                <FootballPitch
                  players={[]}
                  dangerZones={[]}
                  showGrid
                  pitchType="full"
                />
              </div>
            </div>

            {cameras.length > 0 && (
              <div className="glass rounded-xl p-3">
                <div className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5" /> Kamera-Links
                </div>
                <div className="space-y-1">
                  {cameras.map(cam => {
                    const link = `${window.location.origin}/cam?session=${session.id}&cam=${cam.id}`;
                    return (
                      <button
                        key={cam.id}
                        onClick={() => {
                          navigator.clipboard.writeText(link);
                          alert('✓ Link kopiert!');
                        }}
                        className="w-full text-left p-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-mono text-muted-foreground hover:text-foreground transition-all"
                        title={link}
                      >
                        {cam.label}: {link.split('/').pop()}...
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: FUNK + KICKOFF */}
          <div className="space-y-4">
            <AnimatePresence>
              {showFunk && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="glass rounded-xl overflow-hidden" style={{ height: 340 }}>
                    <FunkPanel sessionId={session.id} onClose={() => setShowFunk(false)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showKickoff && (
              <Button
                onClick={() => setShowKickoff(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                <Target className="w-4 h-4" /> Anstoß Kalibrieren
              </Button>
            )}

            <AnimatePresence>
              {showKickoff && session && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <KickoffDetectionPanel
                    session={session}
                    onClose={() => setShowKickoff(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* HALFTIME ALERT */}
          <AnimatePresence>
            {showHalftimeAlert && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
              >
                <div className="glass rounded-xl p-5 border border-yellow-500/40">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    <span className="font-grotesk font-bold text-yellow-400">45 Minuten!</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleHalfTwo} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black gap-2">
                      <CheckCircle2 className="w-4 h-4" /> 2. Halbzeit starten
                    </Button>
                    <Button variant="outline" onClick={() => setShowHalftimeAlert(false)}>
                      Weiterlaufen
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}