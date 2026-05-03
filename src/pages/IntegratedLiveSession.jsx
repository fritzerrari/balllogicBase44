/**
 * IntegratedLiveSession — Unified Live Session + Coaching Interface
 * Replaces LiveSession + CoachingCockpit separation
 * 
 * 3-Phase Workflow:
 * 1. SETUP — Match title + cameras
 * 2. LIVE — Real-time timer, events, field view (simple)
 * 3. ANALYSIS — Full tracking, stats, AI events (advanced)
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, Camera, Play, Square, Plus, Clock, Mic, MicOff,
  CheckCircle2, Loader2, Check, X, Eye, EyeOff, Wifi, Video, Target, Circle, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FootballPitch from '@/components/pitch/FootballPitch';
import EventButtons from '@/components/live/EventButtons';
import FunkPanel from '@/components/live/FunkPanel';
import CameraCoverageSetup from '@/components/live/CameraCoverageSetup';
import KickoffDetectionPanel from '@/components/live/KickoffDetectionPanel';
import CameraReadinessPanel from '@/components/live/CameraReadinessPanel';
import CameraStreamViewLive from '@/components/live/CameraStreamViewLive';
import StreamMonitor from '@/components/live/StreamMonitor';
import LiveStats from '@/components/live/LiveStats';
import EventLog from '@/components/live/EventLog';
import VideoOverlayPlayer from '@/components/tracking/VideoOverlayPlayer';
import LiveTrackingPanel from '@/components/tracking/LiveTrackingPanel';
import TrackingOverlay from '@/components/live/TrackingOverlay';
import CoveragePitchOverlay from '@/components/pitch/CoveragePitchOverlay';
import SessionHealthCheck from '@/components/live/SessionHealthCheck';
import DsgvoConsentManager from '@/components/players/DsgvoConsentManager';
import NotificationBanner from '@/components/live/NotificationBanner';
import useFrameCapture from '@/hooks/useFrameCapture';
import useRealTimeTracking from '@/hooks/useRealTimeTracking';
import {
  detectEvents,
  simulateDetections,
  computeStats,
} from '@/lib/footballTracker';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const toDay = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function IntegratedLiveSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── PHASE STATE ────────────────────────────────────────────────────
  const [phase, setPhase] = useState('setup'); // 'setup' | 'live' | 'analysis'

  // ── COMMON STATE ───────────────────────────────────────────────────
  const [sessionTitle, setSessionTitle] = useState('');
  const [cameras, setCameras] = useState([{ id: 1, label: 'Kamera 1' }]);
  const [session, setSession] = useState(null);
  const [editingCamId, setEditingCamId] = useState(null);
  const [editingCamLabel, setEditingCamLabel] = useState('');

  // ── LIVE PHASE STATE ───────────────────────────────────────────────
  const [elapsedTime, setElapsedTime] = useState(0);
  const [halfTime, setHalfTime] = useState(1);
  const [eventCount, setEventCount] = useState(0);
  const [showHalftimeAlert, setShowHalftimeAlert] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);

  // ── ANALYSIS PHASE STATE ───────────────────────────────────────────
  const [trackingMode, setTrackingMode] = useState('simulation'); // 'simulation' | 'roboflow'
  const [isDetecting, setIsDetecting] = useState(false);
  const [showTracking, setShowTracking] = useState(true);
  const [showDsgvo, setShowDsgvo] = useState(false);
  const [trackingUnlocked, setTrackingUnlocked] = useState(false);
  const [detections, setDetections] = useState([]);
  const [events, setEvents] = useState([]);
  const [statsHistory, setStatsHistory] = useState([]);
  const [trackTick, setTrackTick] = useState(0);
  const [pitchType, setPitchType] = useState('full');
  const [playersPerTeam, setPlayersPerTeam] = useState(11);
  const [funkOpen, setFunkOpen] = useState(false);
  const [showCoverageSetup, setShowCoverageSetup] = useState(false);
  const [activeNotification, setActiveNotification] = useState(null);

  const timerRef = useRef(null);
  const halftimeAlertRef = useRef(false);
  const hiddenCanvasRef = useRef(null);
  const videoRef = useRef(null);
  const simIntervalRef = useRef(null);

  // ── DATA QUERIES ───────────────────────────────────────────────────
  const { data: recentMatches = [] } = useQuery({
    queryKey: ['matches-recent'],
    queryFn: () => base44.entities.Match.list('-date', 5),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['liveSessions'],
    queryFn: () => base44.entities.LiveSession.filter({ status: 'active' }),
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('-created_date', 100),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const activeSession = sessions[0];
  const cameraList = activeSession?.camera_streams || [];

  // ── MUTATIONS ──────────────────────────────────────────────────────
  const createSession = useMutation({ mutationFn: (data) => base44.entities.LiveSession.create(data) });
  const updateSession = useMutation({ mutationFn: ({ id, data }) => base44.entities.LiveSession.update(id, data) });

  // ── HOOKS (REDUCED POLLING) ────────────────────────────────────────
  const { status: trackingStreamStatus, stats: trackingStats } = useFrameCapture(
    hiddenCanvasRef,
    activeSession?.id,
    'home',
    trackingMode === 'roboflow' && isDetecting
  );
  const realTimeData = useRealTimeTracking(
    activeSession?.id,
    trackingMode === 'roboflow' && isDetecting
  );

  // ── AUTO-FILL TITLE ────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionTitle) {
      const title = recentMatches.length > 0 ? recentMatches[0].title : `Spiel ${toDay()}`;
      setSessionTitle(title);
    }
  }, [recentMatches, sessionTitle]);

  // ── TIMER + HALBZEIT ───────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'live') return;
    timerRef.current = setInterval(() => {
      setElapsedTime(t => {
        const next = t + 1;
        if (next === 45 * 60 && halfTime === 1 && !halftimeAlertRef.current) {
          halftimeAlertRef.current = true;
          setShowHalftimeAlert(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, halfTime]);

  // ── SIMULATION MODE ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'analysis' || trackingMode !== 'simulation') return;
    let prevPlayers = [];
    simIntervalRef.current = setInterval(() => {
      setTrackTick(t => {
        const newTick = t + 1;
        const { players } = simulateDetections(newTick, { playersPerTeam, pitchType, includeReferee: pitchType === 'full' });
        setDetections(players);
        setStatsHistory(prev => [...prev.slice(-30), players]);
        prevPlayers = players;

        if (newTick % 80 === 0) {
          const simEvents = detectEvents(players, [], { left: 2, right: 98, top: 2, bottom: 98 });
          if (simEvents.length > 0) {
            setEvents(prev => [
              ...simEvents.map(e => ({ ...e, id: `sim-${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })),
              ...prev
            ].slice(0, 50));
          }
        }
        return newTick;
      });
    }, 500);
    return () => {
      clearInterval(simIntervalRef.current);
      setEvents([]);
      setDetections([]);
    };
  }, [phase, trackingMode, playersPerTeam, pitchType]);

  // ── ROBOFLOW VIDEO SETUP ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'analysis' || trackingMode !== 'roboflow' || !isDetecting) return;
    const setupVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (e) {
        console.warn('⚠️ No camera for analysis:', e.message);
      }
    };
    setupVideo();

    const drawInterval = setInterval(() => {
      const video = videoRef.current;
      const canvas = hiddenCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
    }, 2000);

    return () => {
      clearInterval(drawInterval);
      videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    };
  }, [phase, trackingMode, isDetecting]);

  // ── HANDLERS ───────────────────────────────────────────────────────
  const handleStartSession = async () => {
    if (!sessionTitle) return;

    try {
      const serverActiveSessions = await base44.entities.LiveSession.filter({ status: 'active' });
      if (serverActiveSessions?.length > 0 && serverActiveSessions[0]?.status === 'active') {
        alert(`🛑 Eine Session läuft noch:\n\n${serverActiveSessions.map(s => `• ${s.match_title || 'Unbekannt'}`).join('\n')}\n\nBeende diese zuerst.`);
        return;
      }
    } catch (err) {
      console.error('❌ Session check failed:', err);
    }

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
    } catch (err) {
      console.error('❌ Match creation failed:', err);
    }

    try {
      const s = await createSession.mutateAsync({
        match_title: sessionTitle,
        match_id: matchId || null,
        status: 'active',
        half_time: 1,
        started_at: new Date().toISOString(),
        camera_streams: cameras.map(c => ({ camera_id: c.id.toString(), label: c.label, stream_url: '', status: 'waiting', code: Math.random().toString(36).substring(2, 8).toUpperCase() })),
      });
      setSession(s);
      setPhase('analysis');
      setElapsedTime(0);
    } catch (err) {
      console.error('❌ Session creation failed:', err);
      alert('❌ Session konnte nicht gestartet werden.');
    }
  };

  const handleStopSession = async () => {
    setFinishing(true);
    try {
      if (session) {
        await updateSession.mutateAsync({
          id: session.id,
          data: { status: 'ended', ended_at: new Date().toISOString() },
        });
        base44.functions.invoke('finalizeSession', { session_id: session.id }).catch(() => {});
      }
    } catch (err) {
      console.warn('⚠️ Session stop warning:', err.message);
    }

    setFinishing(false);
    setPhase('setup');
    setSession(null);
    queryClient.invalidateQueries({ queryKey: ['liveSessions'] });
    setTimeout(() => {
      if (session?.match_id) {
        navigate(`/analytics?match=${session.match_id}`);
      }
    }, 500);
  };

  const handleStartHalfTwo = () => {
    setShowHalftimeAlert(false);
    setHalfTime(2);
    setElapsedTime(45 * 60);
    halftimeAlertRef.current = false;
    if (session) {
      updateSession.mutate({ id: session.id, data: { half_time: 2 } });
    }
  };

  const handleActivateRoboflow = () => {
    const pendingConsent = players.filter(p => !p.tracking_consent || p.tracking_consent === 'pending' || p.tracking_consent === 'guardian_required');
    if (pendingConsent.length > 0 && !trackingUnlocked) {
      setShowDsgvo(true);
      return;
    }

    clearInterval(simIntervalRef.current);
    setTrackTick(0);
    setEvents([]);
    setDetections([]);
    setTrackingMode('roboflow');
    setIsDetecting(true);
  };

  const handleDsgvoConfirm = () => {
    setTrackingUnlocked(true);
    setShowDsgvo(false);
    clearInterval(simIntervalRef.current);
    setTrackTick(0);
    setEvents([]);
    setDetections([]);
    setTrackingMode('roboflow');
    setIsDetecting(true);
  };

  const handleSwitchToSim = () => {
    setIsDetecting(false);
    setTrackingMode('simulation');
    setEvents([]);
    setDetections([]);
    setTrackTick(0);
  };

  const addCamera = async () => {
    const newCamId = cameras.length + 1;
    const newCam = { id: newCamId, label: `Kamera ${newCamId}` };
    setCameras([...cameras, newCam]);
    if (session && phase === 'live') {
      const newStream = { camera_id: newCamId.toString(), label: newCam.label, stream_url: '', status: 'waiting', code: Math.random().toString(36).substring(2, 8).toUpperCase() };
      try {
        await updateSession.mutateAsync({ id: session.id, data: { camera_streams: [...(session.camera_streams || []), newStream] } });
      } catch (err) {
        console.error('❌ Camera add failed:', err);
      }
    }
  };

  const deleteCamera = (id) => {
    setCameras(cameras.filter(c => c.id !== id));
  };

  const handleCamerasConfigured = (configuredCameras) => {
    if (session) {
      const updatedStreams = session.camera_streams.map((stream) => {
        const config = configuredCameras.find((c) => c.id === parseInt(stream.camera_id));
        if (config) {
          return { ...stream, position_x: config.position_x, position_y: config.position_y, view_angle: config.view_angle, coverage_polygon: config.coverage_polygon };
        }
        return stream;
      });
      updateSession.mutate({ id: session.id, data: { camera_streams: updatedStreams } });
    }
    setShowCoverageSetup(false);
  };

  // ── DERIVED DATA ───────────────────────────────────────────────────
  const gameMinute = halfTime === 1 ? Math.floor(elapsedTime / 60) : 45 + Math.floor((elapsedTime - 45 * 60) / 60);
  const displayDetections = trackingMode === 'roboflow' && realTimeData.detections.length > 0 ? realTimeData.detections : detections;
  const displayBall = trackingMode === 'roboflow' && realTimeData.ballPos ? realTimeData.ballPos : detections.find(d => d.class === 'ball') || null;
  const playerList = displayDetections.filter(d => d.class !== 'ball');
  const stats = computeStats(statsHistory);
  const playerCounts = {
    home: displayDetections.filter(d => d.team === 'home' && d.class !== 'ball').length,
    away: displayDetections.filter(d => d.team === 'away' && d.class !== 'ball').length,
    referee: detections.filter(d => d.class === 'referee').length,
  };

  // ── RENDER ─────────────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-8 min-h-screen">
      {activeNotification && <NotificationBanner notification={activeNotification} onDismiss={() => setActiveNotification(null)} />}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {/* SETUP PHASE */}
      {phase === 'setup' && (
        <div className="max-w-lg mx-auto space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-6">
            <Radio className="w-4 h-4 text-red-400" />
            <h1 className="text-2xl font-grotesk font-bold text-foreground">Live-Session starten</h1>
          </motion.div>

          <div className="glass rounded-xl p-5 space-y-3">
            <h2 className="font-grotesk font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
              Spiel
            </h2>
            <Input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} placeholder="z.B. FC Bayern vs BVB" className="bg-muted border-border text-base" />
            {recentMatches.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {recentMatches.slice(0, 3).map(m => (
                  <button key={m.id} onClick={() => setSessionTitle(m.title)} className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${sessionTitle === m.title ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
                    {m.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="glass rounded-xl p-5 space-y-3">
            <h2 className="font-grotesk font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
              Kameras
            </h2>
            <div className="space-y-2">
              {cameras.map((cam) => (
                <div key={cam.id} className="bg-muted rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Camera className="w-4 h-4 text-primary" />
                    {editingCamId === cam.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input value={editingCamLabel} onChange={e => setEditingCamLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setCameras(prev => prev.map(c => c.id === cam.id ? { ...c, label: editingCamLabel } : c)); setEditingCamId(null); } }} className="flex-1 bg-background border border-primary/40 rounded px-2 py-0.5 text-sm focus:outline-none" autoFocus />
                        <button onClick={() => { setCameras(prev => prev.map(c => c.id === cam.id ? { ...c, label: editingCamLabel } : c)); setEditingCamId(null); }} className="text-primary"><Check className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <span className="font-medium text-foreground">{cam.label}</span>
                    )}
                  </div>
                  <button onClick={() => deleteCamera(cam.id)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <Button onClick={addCamera} variant="outline" className="w-full gap-2"><Plus className="w-4 h-4" /> Kamera hinzufügen</Button>
          </div>

          <Button onClick={handleStartSession} disabled={!sessionTitle || createSession.isPending} className="w-full bg-red-500 hover:bg-red-600 text-white gap-2 h-14 text-lg font-bold">
            {createSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Session starten
          </Button>
        </div>
      )}

      {/* LIVE PHASE */}
      {phase === 'live' && session && (
        <div className="grid lg:grid-cols-3 gap-3 lg:gap-4">
          <div className="space-y-3">
            <div className="glass rounded-xl p-4 border border-red-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-400 font-bold">LIVE</span>
                </div>
                <button onMouseDown={() => setIsMicActive(true)} onMouseUp={() => setIsMicActive(false)} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${isMicActive ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'}`}>
                  {isMicActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="text-4xl sm:text-5xl font-grotesk font-bold text-foreground text-center mb-1">{formatTime(elapsedTime)}</div>
              <div className="text-center text-xs text-muted-foreground mb-3">{halfTime}. Halbzeit · Minute {gameMinute}'</div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                <div className="bg-muted rounded-lg p-2"><div className="font-bold text-primary">{cameraList.length}</div><div className="text-muted-foreground">Kameras</div></div>
                <div className="bg-muted rounded-lg p-2"><div className="font-bold text-primary">{halfTime}. HZ</div></div>
                <div className="bg-muted rounded-lg p-2"><div className="font-bold text-primary">{eventCount}</div><div className="text-muted-foreground">Events</div></div>
              </div>

              {halfTime === 1 && <button onClick={() => setShowHalftimeAlert(true)} className="w-full mb-2 py-1.5 rounded-lg border border-yellow-500/30 text-yellow-400 text-xs font-medium hover:bg-yellow-500/10"><Clock className="w-3.5 h-3.5 inline mr-1" /> Halbzeit jetzt</button>}

              <Button onClick={handleStopSession} disabled={finishing} variant="outline" className="w-full border-red-500/30 text-red-400 mb-2 gap-2">
                {finishing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Bericht...</> : <><Square className="w-3.5 h-3.5" /> Beenden</>}
              </Button>

              <Button onClick={() => setPhase('analysis')} className="w-full bg-primary text-primary-foreground gap-2 mb-2"><Eye className="w-3.5 h-3.5" /> Analyse-Modus</Button>

              {session && <button onClick={() => setFunkOpen(!funkOpen)} className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-bold transition-all ${funkOpen ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-muted border-border'}`}><Radio className="w-3.5 h-3.5" /> Funk</button>}
            </div>

            <div className="glass rounded-xl p-3">
            <div className="text-xs text-muted-foreground uppercase font-bold mb-2">Event tippen</div>
            <EventButtons sessionId={session.id} matchId={session.match_id} matchTitle={sessionTitle} source="coach" elapsedSeconds={elapsedTime} compact onEventLogged={() => setEventCount(c => c + 1)} onError={() => null} />
            </div>
          </div>

          <AnimatePresence>{funkOpen && session && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="glass rounded-xl overflow-hidden" style={{ height: 360 }}><FunkPanel sessionId={session.id} onClose={() => setFunkOpen(false)} /></div></motion.div>}</AnimatePresence>

          <div className="lg:col-span-2">
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-grotesk font-semibold text-foreground">Live-Spielfeld</span>
                <Badge className="bg-red-500/20 text-red-400 text-[10px]">● LIVE</Badge>
              </div>
              <div className="aspect-[3/2] max-h-[320px]">
                <FootballPitch players={playerList} dangerZones={displayBall ? [{ x: displayBall.x, y: displayBall.y, intensity: 0.8, team: 'home' }] : []} showGrid pitchType={pitchType} />
              </div>
            </div>

            {cameraList.length > 0 && (
              <div className="glass rounded-xl p-4 mt-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-grotesk font-semibold"><Camera className="w-4 h-4 inline mr-1" /> Kameras</span>
                  <button onClick={addCamera} className="text-xs px-3 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary font-bold"><Plus className="w-3.5 h-3.5 inline mr-1" /> Kamera</button>
                </div>
                <div className="space-y-2">
                  {cameraList.map((cam) => {
                    const camLink = `${window.location.origin}/cam?session=${session.id}&cam=${cam.camera_id}`;
                    return (
                      <div key={cam.camera_id} className="bg-muted rounded-lg p-3 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-foreground">{cam.label}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{camLink.replace('http://', '').replace('https://', '')}</div>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(camLink); alert('Kopiert!'); }} className="px-2 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-bold flex-shrink-0">Kopieren</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <AnimatePresence>{showHalftimeAlert && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"><div className="glass rounded-2xl p-5 border border-yellow-500/40"><div className="flex items-center gap-2 mb-3"><Clock className="w-5 h-5 text-yellow-400" /><span className="font-grotesk font-bold">45 Minuten!</span></div><div className="flex gap-2"><Button onClick={handleStartHalfTwo} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"><CheckCircle2 className="w-4 h-4 inline mr-1" /> Ja, 2. HZ</Button><Button variant="outline" onClick={() => setShowHalftimeAlert(false)}>Weiterlaufen</Button></div></div></motion.div>}</AnimatePresence>
        </div>
      )}

      {/* ANALYSIS PHASE */}
      {phase === 'analysis' && session && (
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-primary" />
              <h1 className="text-2xl font-grotesk font-bold">Coaching Cockpit</h1>
              <Badge className="bg-primary/15 text-primary border-primary/30">{sessionTitle}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowDsgvo(true)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-blue-500/30 bg-blue-500/10 text-blue-400"><Shield className="w-3.5 h-3.5 inline mr-1" /> DSGVO</button>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button onClick={handleSwitchToSim} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${trackingMode === 'simulation' ? 'bg-background text-foreground shadow' : 'text-muted-foreground'}`}>Demo</button>
                <button onClick={() => handleActivateRoboflow()} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${trackingMode === 'roboflow' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'}`}><Wifi className="w-3 h-3" /> {isDetecting ? 'LIVE' : 'Echt'}</button>
              </div>
              <button onClick={() => setShowTracking(!showTracking)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${showTracking ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-muted border-border'}`}><Eye className="w-3.5 h-3.5 inline mr-1" /> Overlay</button>
              <Button onClick={() => setPhase('live')} variant="outline" size="sm">Zurück</Button>
            </div>
          </motion.div>

          {trackingMode === 'roboflow' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`glass rounded-xl p-3 border flex items-center gap-3 text-xs ${trackingStreamStatus === 'error' ? 'border-destructive/30' : 'border-primary/30'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${trackingStreamStatus === 'streaming' ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
              <span className={`font-bold ${trackingStreamStatus === 'streaming' ? 'text-primary' : 'text-destructive'}`}>{trackingStreamStatus === 'streaming' ? '🔴 LIVE TRACKING' : '⚠️ VERBINDUNG UNTERBROCHEN'}</span>
              <span className="text-muted-foreground flex-1">Frame {trackingStats.frameCount} · {trackingStats.playersDetected}👥 · {trackingStats.ballDetected ? '⚽' : '○'} · {trackingStats.latencyMs}ms</span>
              <Button size="sm" variant="outline" onClick={handleSwitchToSim}>Stop</Button>
            </motion.div>
          )}

          <SessionHealthCheck session={session} />

          <div className="grid lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-4">
              <div className="glass rounded-xl p-4 border border-primary/20">
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div><div className="text-sm font-grotesk font-bold">{playerCounts.home}</div><div className="text-[10px] text-muted-foreground">🏠 Heim</div></div>
                  <div><div className="text-sm font-grotesk font-bold">{playerCounts.away}</div><div className="text-[10px] text-muted-foreground">✈️ Gäste</div></div>
                  <div><div className="text-sm font-grotesk font-bold text-primary">{trackingMode === 'roboflow' ? '🔴' : '⚪'}</div><div className="text-[10px] text-muted-foreground">Tracking</div></div>
                  <div><div className="text-sm font-grotesk font-bold text-yellow-400">●</div><div className="text-[10px] text-muted-foreground">Ball</div></div>
                </div>
              </div>

              <div className="glass rounded-xl p-4">
                <div className="text-sm font-grotesk font-semibold text-foreground mb-3 flex items-center gap-2"><Video className="w-4 h-4 text-primary" /> Video + Overlay</div>
                <VideoOverlayPlayer detections={displayDetections.length > 0 ? displayDetections : playerList} ball={displayBall} />
              </div>

              <div className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-grotesk font-semibold"><Target className="w-4 h-4 inline mr-1" /> Live-Tracking</span>
                  <Badge className={trackingMode === 'roboflow' ? 'bg-primary/20 text-primary' : 'bg-yellow-500/30 text-yellow-400'}>{trackingMode === 'roboflow' ? '🔴 RF-DETR LIVE' : '▶️ SIMULATION'}</Badge>
                </div>
                <div className="relative aspect-[3/2] max-h-[300px]">
                  <FootballPitch players={playerList} dangerZones={displayBall ? [{ x: displayBall.x, y: displayBall.y, intensity: 0.8, team: 'home' }] : []} showGrid pitchType={pitchType} />
                  <div className="absolute inset-0"><CoveragePitchOverlay cameras={cameraList} /></div>
                  {displayDetections.length > 0 && <TrackingOverlay players={displayDetections} ball={displayBall} events={events.slice(0, 3)} />}
                </div>
              </div>

              <div className="glass rounded-xl p-3 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground uppercase">Modus:</span>
                {[{ key: 'full', label: '11v11' }, { key: 'half', label: 'Halbfeld' }, { key: 'small', label: 'Kleines Feld' }, { key: 'training', label: 'Training' }].map(p => (
                  <button key={p.key} onClick={() => setPitchType(p.key)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${pitchType === p.key ? 'bg-primary/15 border border-primary/30 text-primary' : 'bg-muted text-muted-foreground'}`}>{p.label}</button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <LiveStats stats={stats} playerCounts={playerCounts} />
              {session && <LiveTrackingPanel sessionId={session.id} />}
              {session && <div className="glass rounded-xl overflow-hidden" style={{ height: 360 }}><FunkPanel sessionId={session.id} /></div>}
              <div className="glass rounded-xl p-4"><div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3"><Target className="w-3.5 h-3.5 inline mr-2" /> Ereignis tippen</div><EventButtons sessionId={session.id} matchId={session.match_id} matchTitle={sessionTitle} source="coach_analysis" elapsedSeconds={0} compact onError={() => null} /></div>
              <EventLog events={events} />
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>{showDsgvo && <DsgvoConsentManager players={players} onClose={() => setShowDsgvo(false)} />}</AnimatePresence>
    </div>
  );
}