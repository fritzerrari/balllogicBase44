/**
 * LiveSession — VOLLSTÄNDIGES System mit allen Features
 * 
 * 3-PHASEN WORKFLOW:
 * 1. SETUP — Spiel + Kameras konfigurieren
 * 2. LIVE — Timer + Live-Video + Events tappen
 * 3. COACHING COCKPIT — Tracking + Heatmaps + AI-Events + Analytics
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, Camera, Play, Square, Plus, Clock, Eye, EyeOff, Target, 
  Video, Zap, Settings, Loader2, Check, X, AlertCircle, Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import FootballPitch from '@/components/pitch/FootballPitch';
import EventButtons from '@/components/live/EventButtons';
import FunkPanel from '@/components/live/FunkPanel';
import KickoffDetectionPanel from '@/components/live/KickoffDetectionPanel';
import CameraStreamViewLive from '@/components/live/CameraStreamViewLive';
import VideoOverlayPlayer from '@/components/tracking/VideoOverlayPlayer';
import LiveTrackingPanel from '@/components/tracking/LiveTrackingPanel';
import TrackingOverlay from '@/components/live/TrackingOverlay';
import CoveragePitchOverlay from '@/components/pitch/CoveragePitchOverlay';
import SessionHealthCheck from '@/components/live/SessionHealthCheck';
import DsgvoGatekeeper from '@/components/live/DsgvoGatekeeper';
import LiveStatsEnhanced from '@/components/live/LiveStatsEnhanced';
import EventLog from '@/components/live/EventLog';
import CameraReadinessPanel from '@/components/live/CameraReadinessPanel';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function LiveSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── PHASE STATE ────────────────────────────────────────────────────
  const [phase, setPhase] = useState('setup'); // 'setup' | 'live' | 'coaching'

  // ── SETUP PHASE ────────────────────────────────────────────────────
  const [sessionTitle, setSessionTitle] = useState('');
  const [cameras, setCameras] = useState([{ id: 1, label: 'Kamera 1' }]);

  // ── COMMON STATE ───────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [editingCamId, setEditingCamId] = useState(null);
  const [editingCamLabel, setEditingCamLabel] = useState('');

  // ── LIVE PHASE STATE ───────────────────────────────────────────────
  const [elapsedTime, setElapsedTime] = useState(0);
  const [halfTime, setHalfTime] = useState(1);
  const [eventCount, setEventCount] = useState(0);
  const [showHalftimeAlert, setShowHalftimeAlert] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // ── COACHING PHASE STATE ───────────────────────────────────────────
  const [showTracking, setShowTracking] = useState(true);
  const [trackingMode, setTrackingMode] = useState('simulation');
  const [showDsgvo, setShowDsgvo] = useState(false);
  const [trackingUnlocked, setTrackingUnlocked] = useState(false);
  const [showCameraPanel, setShowCameraPanel] = useState(true);
  const [showFunk, setShowFunk] = useState(false);
  const [showKickoff, setShowKickoff] = useState(false);
  const [events, setEvents] = useState([]);
  const [pitchType, setPitchType] = useState('full');

  const timerRef = useRef(null);
  const halftimeRef = useRef(false);

  // ── MUTATIONS ──────────────────────────────────────────────────────
  const createSession = useMutation({
    mutationFn: (data) => base44.entities.LiveSession.create(data),
    onError: (err) => alert('❌ ' + err.message)
  });

  const updateSession = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LiveSession.update(id, data),
    onError: (err) => console.warn('⚠️ Update warning:', err.message)
  });

  // ── TIMER ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'live' && phase !== 'coaching') return;
    
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

  // ── HANDLERS ───────────────────────────────────────────────────────
  const handleStartSession = async () => {
    if (!sessionTitle.trim()) {
      alert('⚠️ Spieltitel erforderlich');
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
      setPhase('live');
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
        base44.functions.invoke('finalizeSession', { session_id: session.id }).catch(() => {});
      }
    } catch (err) {
      console.warn('Stop warning:', err.message);
    }

    setFinishing(false);
    setPhase('setup');
    setSession(null);
    queryClient.invalidateQueries({ queryKey: ['liveSessions'] });
    setTimeout(() => {
      if (session?.match_id) {
        navigate(`/analytics?match=${session.match_id}`);
      }
    }, 300);
  };

  const handleSwitchToCooking = () => {
    clearInterval(timerRef.current);
    setPhase('coaching');
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

  const addCamera = () => {
    const newId = Math.max(...cameras.map(c => c.id), 0) + 1;
    const newCam = { id: newId, label: `Kamera ${newId}` };
    setCameras([...cameras, newCam]);
    
    // Update active session wenn läuft
    if (session && phase !== 'setup') {
      const newStream = {
        camera_id: newId.toString(),
        label: newCam.label,
        stream_url: '',
        status: 'waiting',
        code: Math.random().toString(36).substring(2, 8).toUpperCase()
      };
      updateSession.mutate({
        id: session.id,
        data: { camera_streams: [...(session.camera_streams || []), newStream] }
      });
    }
  };

  const deleteCamera = (id) => {
    if (cameras.length === 1) {
      alert('⚠️ Mindestens 1 Kamera erforderlich');
      return;
    }
    setCameras(cameras.filter(c => c.id !== id));
  };

  const updateCameraLabel = (id, newLabel) => {
    setCameras(cameras.map(c => c.id === id ? { ...c, label: newLabel } : c));
    if (session && phase !== 'setup') {
      const updated = session.camera_streams.map(s => 
        s.camera_id === id.toString() ? { ...s, label: newLabel } : s
      );
      updateSession.mutate({ id: session.id, data: { camera_streams: updated } });
    }
  };

  // ── DERIVED ────────────────────────────────────────────────────────
  const gameMinute = halfTime === 1 ? Math.floor(elapsedTime / 60) : 45 + Math.floor((elapsedTime - 45 * 60) / 60);
  const cameraList = session?.camera_streams || [];

  // ── RENDER SETUP ───────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="p-4 lg:p-8 min-h-screen">
        <div className="max-w-lg mx-auto space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-6">
            <Radio className="w-5 h-5 text-red-500" />
            <h1 className="text-3xl font-grotesk font-bold">Live-Session</h1>
          </motion.div>

          <div className="glass rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground block mb-2">Spielname</label>
              <Input
                value={sessionTitle}
                onChange={e => setSessionTitle(e.target.value)}
                placeholder="z.B. Bayern vs Dortmund"
                className="text-lg"
                onKeyDown={e => e.key === 'Enter' && handleStartSession()}
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground block mb-2 flex items-center gap-2">
                <Camera className="w-3 h-3" /> Kameras ({cameras.length})
              </label>
              <div className="space-y-2 mb-3">
                {cameras.map(cam => (
                  <div key={cam.id} className="bg-muted rounded-lg p-3 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    {editingCamId === cam.id ? (
                      <input
                        value={editingCamLabel}
                        onChange={e => setEditingCamLabel(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            updateCameraLabel(cam.id, editingCamLabel);
                            setEditingCamId(null);
                          }
                        }}
                        className="flex-1 bg-background border border-primary/40 rounded px-2 py-1 text-sm focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1 font-medium">{cam.label}</span>
                    )}
                    {editingCamId === cam.id ? (
                      <button onClick={() => { updateCameraLabel(cam.id, editingCamLabel); setEditingCamId(null); }} className="text-primary">
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => { setEditingCamId(cam.id); setEditingCamLabel(cam.label); }} className="text-xs text-muted-foreground">
                        Edit
                      </button>
                    )}
                    <button onClick={() => deleteCamera(cam.id)} className="text-destructive">
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
              onClick={handleStartSession}
              disabled={createSession.isPending || !sessionTitle.trim()}
              className="w-full bg-red-600 hover:bg-red-700 h-12 text-lg gap-2 font-bold"
            >
              {createSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              Session Starten
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER LIVE ────────────────────────────────────────────────────
  if (phase === 'live' && session) {
    return (
      <>
        <DsgvoGatekeeper sessionId={session.id} onReadyToStart={() => {}} />
        <div className="p-4 lg:p-8 min-h-screen">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* LEFT: TIMER + CONTROLS */}
          <div className="space-y-4">
            <div className="glass rounded-xl p-5 border-2 border-red-500/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-red-400">● LIVE</span>
              </div>
              
              <div className="text-5xl font-grotesk font-bold text-center mb-1">
                {formatTime(elapsedTime)}
              </div>
              <div className="text-center text-xs text-muted-foreground mb-4">
                {halfTime}. Halbzeit · Minute {gameMinute}'
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
                <div className="bg-muted rounded p-2"><div className="font-bold text-primary">{cameras.length}</div><div className="text-[10px]">Kameras</div></div>
                <div className="bg-muted rounded p-2"><div className="font-bold text-primary">{halfTime}</div><div className="text-[10px]">HZ</div></div>
                <div className="bg-muted rounded p-2"><div className="font-bold text-primary">{eventCount}</div><div className="text-[10px]">Events</div></div>
              </div>

              {halfTime === 1 && (
                <button onClick={() => setShowHalftimeAlert(true)} className="w-full mb-2 py-2 rounded-lg border border-yellow-500/30 text-yellow-400 text-xs font-bold hover:bg-yellow-500/10 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Halbzeit (45')
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 mb-2">
                <Button onClick={handleSwitchToCooking} className="bg-primary/20 text-primary gap-2">
                  <Zap className="w-4 h-4" /> Analysis
                </Button>
                <Button onClick={handleStopSession} disabled={finishing} variant="outline" className="border-red-500/30 text-red-400 gap-2">
                  {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />} Beenden
                </Button>
              </div>
            </div>

            <div className="glass rounded-xl p-3">
              <div className="text-xs font-bold uppercase text-muted-foreground mb-2">⚽ Event tippen</div>
              <EventButtons sessionId={session.id} matchId={session.match_id} matchTitle={sessionTitle} source="coach" elapsedSeconds={elapsedTime} compact onEventLogged={() => setEventCount(c => c + 1)} />
            </div>
          </div>

          {/* CENTER: LIVE CAMERA FEEDS + LINKS */}
          <div className="space-y-4">
            {cameraList.length > 0 ? (
              <div className="space-y-3">
                {cameraList.map(cam => {
                  const camLink = `${window.location.origin}/cam?session=${session.id}&cam=${cam.camera_id}`;
                  return (
                    <div key={cam.camera_id} className="space-y-2">
                      <CameraStreamViewLive camera={cam} sessionId={session.id} />
                      <div className="glass rounded-lg p-2 border border-green-500/40 bg-green-500/5 flex gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(camLink); alert('✓ Link kopiert'); }} className="flex-1 py-1.5 rounded-lg bg-green-600/80 hover:bg-green-600 text-white text-xs font-bold gap-1 flex items-center justify-center">
                          📋 Kopieren
                        </button>
                        <button onClick={() => {
                          const title = 'TactIQ Kamera-Link';
                          const text = `Kameramann für "${sessionTitle}": ${camLink}`;
                          if (navigator.share) {
                            navigator.share({ title, text }).catch(() => {});
                          } else {
                            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                            window.open(whatsappUrl, '_blank');
                          }
                        }} className="px-3 py-1.5 rounded-lg bg-muted border border-border hover:border-green-500/40 hover:bg-green-500/10 text-muted-foreground hover:text-green-400 transition-all">
                          💬
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass rounded-xl p-4 text-center">
                <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <div className="text-xs text-muted-foreground">Keine Kameras verbunden</div>
                <button onClick={() => addCamera()} className="mt-2 px-3 py-1 text-xs rounded-lg bg-primary/20 text-primary">
                  <Plus className="w-3 h-3 inline mr-1" /> Hinzufügen
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: FUNK + MORE CAMERAS */}
          <div className="space-y-4">
            <button onClick={() => addCamera()} className="w-full py-3 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Kamera hinzufügen
            </button>

            <AnimatePresence>
              {showFunk && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="glass rounded-xl overflow-hidden" style={{ height: 340 }}>
                    <FunkPanel sessionId={session.id} onClose={() => setShowFunk(false)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showFunk && (
              <Button onClick={() => setShowFunk(true)} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                <Radio className="w-4 h-4" /> Funk öffnen
              </Button>
            )}
          </div>

          {/* HALFTIME ALERT */}
          <AnimatePresence>
            {showHalftimeAlert && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
                <div className="glass rounded-xl p-5 border border-yellow-500/40">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    <span className="font-grotesk font-bold text-yellow-400">45 Minuten!</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleHalfTwo} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black">
                      2. HZ starten
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
      </div>
      </>
    );
  }

  // ── RENDER COACHING COCKPIT ────────────────────────────────────────
  if (phase === 'coaching' && session) {
    return (
      <div className="p-4 lg:p-8 min-h-screen">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-grotesk font-bold">Coaching Cockpit</h1>
            <Badge className="bg-primary/15 text-primary border-primary/30">{sessionTitle}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{formatTime(elapsedTime)} · HZ {halfTime}</span>
            <Button onClick={() => setPhase('live')} variant="outline" size="sm">
              ← Zurück zu Live
            </Button>
          </div>
        </motion.div>

        <SessionHealthCheck session={session} />

        <div className="grid lg:grid-cols-12 gap-4 mt-4">
          {/* MAIN: LIVE CAMERAS */}
          <div className="lg:col-span-8 space-y-4">
            {cameraList.length > 0 ? (
              <div className="space-y-3">
                {cameraList.slice(0, 2).map(cam => (
                  <CameraStreamViewLive key={cam.camera_id} camera={cam} sessionId={session.id} />
                ))}
              </div>
            ) : (
              <div className="glass rounded-xl p-8 text-center">
                <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <div className="text-sm text-muted-foreground">Starten Sie eine Live-Session um Kameras zu verbinden</div>
              </div>
            )}

            <div className="glass rounded-xl p-4">
              <div className="text-sm font-grotesk font-semibold mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Echtzeit-Spielfeld
              </div>
              <div className="relative aspect-[3/2] max-h-[320px] glass rounded-xl overflow-hidden p-0">
                  <FootballPitch players={[]} dangerZones={[]} showGrid pitchType={pitchType} />
                  <div className="absolute inset-0 pointer-events-none"><CoveragePitchOverlay cameras={cameraList} /></div>
                </div>
              </div>

              {/* Camera Coverage Setup Info */}
              {cameraList.length > 0 && (
                <div className="glass rounded-xl p-3 border border-green-500/30 bg-green-500/5">
                  <div className="text-xs font-bold text-green-400 mb-1">📍 Feldabdeckung</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {cameraList.map(cam => (
                      <div key={cam.camera_id} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400" />
                        <span>{cam.label}</span>
                        {cam.coverage_polygon?.length > 0 && <span className="text-[9px] text-green-400">✓ {cam.coverage_polygon.length} Punkte</span>}
                        {!cam.coverage_polygon && <span className="text-[9px] text-yellow-400">⏳ Auto-Erkennung läuft...</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <LiveTrackingPanel sessionId={session.id} />
          </div>

          {/* RIGHT: STATS + EVENTS + CONTROLS */}
          <div className="lg:col-span-4 space-y-4">
           <LiveStatsEnhanced sessionId={session.id} playerCounts={{ home: 11, away: 11, referee: 1 }} qualityScore={75} pressureIntensity={{ home: 45, away: 38 }} />
            
            <div className="glass rounded-xl p-3">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <Target className="w-3.5 h-3.5" /> Events tippen
              </div>
              <EventButtons sessionId={session.id} matchId={session.match_id} matchTitle={sessionTitle} source="coach" elapsedSeconds={elapsedTime} compact />
            </div>

            <div className="glass rounded-xl p-4">
              <div className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" /> Steuerung
              </div>
              <div className="space-y-2">
                <Button onClick={() => setShowTracking(!showTracking)} className="w-full justify-start" variant="outline">
                  {showTracking ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  Overlay {showTracking ? 'AN' : 'AUS'}
                </Button>
                <Button onClick={() => setShowCameraPanel(!showCameraPanel)} className="w-full justify-start" variant="outline">
                  <Camera className="w-4 h-4" /> Kameras {showCameraPanel ? 'AN' : 'AUS'}
                </Button>
                <Button onClick={handleStopSession} disabled={finishing} className="w-full border-red-500/30 text-red-400" variant="outline">
                  <Square className="w-4 h-4" /> Session beenden
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}