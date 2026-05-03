/**
 * CoachingCockpit — Trainer-Dashboard mit echtem Roboflow-Tracking
 *
 * Tracking-Modi:
 *  1. ROBOFLOW LIVE — nimmt Frames vom <video>, sendet an Roboflow RF-DETR API
 *     → Erkennt Spieler (Heim/Gäste), Torwart, Schiedsrichter, Ball
 *     → Trikotfarben-Clustering per Canvas-Pixel → Team-Zuordnung
 *     → Regelbasierte Event-Erkennung: Tor, Ecke, Foul, Konter
 *  2. SIMULATION — Physics-basiert als Demo/Fallback
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import useFrameCapture from '@/hooks/useFrameCapture';
import useStreamHealth from '@/hooks/useStreamHealth';
import useRealTimeTracking from '@/hooks/useRealTimeTracking';
import useCameraConnections from '@/hooks/useCameraConnections';
import StreamMonitor from '@/components/live/StreamMonitor';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, Camera, Mic, MicOff,
  Zap, Circle, Target, Shield,
  Copy, Check, Smartphone, Share2, Play,
  Eye, EyeOff, Wifi, WifiOff, Video
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EventButtons from '@/components/live/EventButtons';
import SessionHealthCheck from '@/components/live/SessionHealthCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FootballPitch from '@/components/pitch/FootballPitch';
import TrackingOverlay from '@/components/live/TrackingOverlay';
import CoveragePitchOverlay from '@/components/pitch/CoveragePitchOverlay';
import VideoOverlayPlayer from '@/components/tracking/VideoOverlayPlayer';
import CameraFeedCard from '@/components/live/CameraFeedCard';
import ShareCameraLink from '@/components/live/ShareCameraLink';
import EventLog from '@/components/live/EventLog';
import LiveStats from '@/components/live/LiveStats';
import DsgvoConsentManager from '@/components/players/DsgvoConsentManager';
import NotificationBanner from '@/components/live/NotificationBanner';
import SimpleCameraView from '@/components/live/SimpleCameraView';
import useCameraStreamManager from '@/hooks/useCameraStreamManager';
import CameraReadinessPanel from '@/components/live/CameraReadinessPanel';
import {
  detectEvents,
  simulateDetections,
  computeStats,
} from '@/lib/footballTracker';
import LiveTrackingPanel from '@/components/tracking/LiveTrackingPanel';
import FunkPanel from '@/components/live/FunkPanel';

// removed buildSimFrame wrapper — simulateDetections used directly now

export default function CoachingCockpit() {
  // UI state
  const [selectedCam, setSelectedCam] = useState(null);
  const [messages, setMessages] = useState({});
  const [inputMsg, setInputMsg] = useState({});
  const [micActive, setMicActive] = useState({});
  const [showShare, setShowShare] = useState(null);
  const [showTracking, setShowTracking] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);
  const [showApiSetup, setShowApiSetup] = useState(false);
  const [showDsgvo, setShowDsgvo] = useState(false);
  // DSGVO-Gate: Tracking nur starten wenn Einwilligung geprüft oder bestätigt
  const [trackingUnlocked, setTrackingUnlocked] = useState(false);

  // Tracking state — start with simulation, user can switch to Roboflow
   const [trackingMode, setTrackingMode] = useState('simulation'); // 'simulation' | 'roboflow'
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [detections, setDetections] = useState([]);
  const [prevDetections, setPrevDetections] = useState([]);
  const [events, setEvents] = useState([]);
  const [statsHistory, setStatsHistory] = useState([]);
  const [trackTick, setTrackTick] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [activeNotification, setActiveNotification] = useState(null);

  // Training mode config
  const [pitchType, setPitchType] = useState('full'); // 'full' | 'half' | 'small' | 'training'
  const [playersPerTeam, setPlayersPerTeam] = useState(11);

  const videoRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const simIntervalRef = useRef(null);

  // Stream Health Monitoring
  const { cameraHealth, globalHealth, recordFrameLatency } = useStreamHealth();

  // ── Load sessions + players (für DSGVO + real-time roster sync) ────────────────────────────────────
  const queryClient = useQueryClient();
  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('-created_date', 100),
    refetchInterval: 30000, // Sync every 30s (substitutions, injuries)
    staleTime: 20000,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['liveSessions'],
    queryFn: () => base44.entities.LiveSession.filter({ status: 'active' }),
    refetchInterval: 12000,
    staleTime: 8000,
    gcTime: 60000,
  });

  const activeSession = sessions[0];
  // Kameras NUR aus aktiver Session — keine Demo-Fallback-Daten
  const cameras = activeSession?.camera_streams || [];

  // Camera Stream Manager — zentrale Verwaltung aller Kamera-Verbindungen
  const { cameraStates, globalStatus, connectedCount, totalCount } = useCameraStreamManager(activeSession?.id, true);

  // Race condition fix: Invalidate and refetch when session changes
  useEffect(() => {
    if (activeSession?.id) {
      queryClient.invalidateQueries({ queryKey: ['players'] });
    }
  }, [activeSession?.id, queryClient]);

  const liveUrl = `${window.location.origin}/cam`;

  // ── Simulation mode ────────────────────────────────────────────────────────
  useEffect(() => {
    if (trackingMode !== 'simulation') return;

    let prevPlayers = [];
    simIntervalRef.current = setInterval(() => {
      setTrackTick(t => {
        const newTick = t + 1;
        const { players } = simulateDetections(newTick, { playersPerTeam, pitchType, includeReferee: pitchType === 'full' });
        setPrevDetections(prevPlayers);
        setDetections(players);
        setStatsHistory(prev => [...prev.slice(-30), players]);
        prevPlayers = players;

        // Auto-Events
        if (newTick % 40 === 0) {
          const simEvents = detectEvents(players, [], { left: 2, right: 98, top: 2, bottom: 98 });
          if (simEvents.length > 0) {
            setEvents(prev => [
              ...simEvents.map(e => ({ 
                ...e, 
                id: `sim-${Date.now()}-${Math.random()}`, 
                time: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
              })),
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
  }, [trackingMode, playersPerTeam, pitchType]);

  // ── Roboflow mode: draw camera video onto hidden canvas so useFrameCapture gets real pixels ──
  useEffect(() => {
    if (trackingMode !== 'roboflow' || !isDetecting) return;
    // Try to grab the first connected camera's video stream
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
        console.warn('⚠️ No camera for cockpit capture:', e.message);
      }
    };
    setupVideo();

    // Draw video frames to canvas every 2s
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
  }, [trackingMode, isDetecting]);

  // Frame capture hook — sendet alle 3s Frames an processFrame backend
  const { status: trackingStreamStatus, stats: trackingStats } = useFrameCapture(
    hiddenCanvasRef,
    activeSession?.id,
    'home',
    trackingMode === 'roboflow' && isDetecting
  );

  // Real-time tracking hook — synced mit echten TrackingData aus DB
  const realTimeData = useRealTimeTracking(
    activeSession?.id,
    trackingMode === 'roboflow' && isDetecting
  );

  // Im Roboflow-Modus: echte Daten verwenden, sonst Simulation
   const displayDetections = trackingMode === 'roboflow' && realTimeData.detections.length > 0
     ? realTimeData.detections
     : detections;

  // ❌ REMOVED: Frontend should NOT call detectFrame() or startRoboflowTracking()
  // useFrameCapture hook handles Roboflow integration via processFrame backend
  // This prevents double-setup, CORS errors, and keeps tracking logic on server side

  // useFrameCapture hook handles tracking lifecycle — no manual video setup needed

  const handleActivateRoboflow = () => {
     const pendingConsent = players.filter(p =>
       !p.tracking_consent || p.tracking_consent === 'pending' || p.tracking_consent === 'guardian_required'
     );
     if (pendingConsent.length > 0 && !trackingUnlocked) {
       setShowDsgvo(true);
       return;
     }

     // STOP Simulation
     clearInterval(simIntervalRef.current);
     setTrackTick(0);
     setEvents([]);
     setDetections([]);

     // Switch to Roboflow mode (useFrameCapture hook handles streaming via processFrame backend)
     setTrackingMode('roboflow');
     setShowApiSetup(false);
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
    setShowApiSetup(false);
    setIsDetecting(true);
  };

  const handleSwitchToSim = () => {
    setIsDetecting(false); // Stop useFrameCapture
    setTrackingMode('simulation');
    setApiError(null);
    setApiKey('');
    setApiKeyInput('');
    setEvents([]);
    setDetections([]);
    setTrackTick(0);
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  // CONSISTENCY: Use displayBall / displayDetections consistently
  const displayBall = trackingMode === 'roboflow' && realTimeData.ballPos
    ? realTimeData.ballPos
    : detections.find(d => d.class === 'ball') || null;
  
  const ball = displayBall;

  const playerList = trackingMode === 'roboflow' && displayDetections.length > 0
    ? displayDetections.filter(d => d.class !== 'ball')
    : detections.filter(d => d.class !== 'ball');

  const stats = computeStats(statsHistory);

  const playerCounts = trackingMode === 'roboflow' && displayDetections.length > 0
    ? {
        home: displayDetections.filter(d => d.team === 'home' && d.class !== 'ball').length,
        away: displayDetections.filter(d => d.team === 'away' && d.class !== 'ball').length,
        referee: 0,
      }
    : {
        home: detections.filter(d => d.team === 'home' && d.class !== 'ball').length,
        away: detections.filter(d => d.team === 'away' && d.class !== 'ball').length,
        referee: detections.filter(d => d.class === 'referee').length,
      };

  // Cleanup — only on unmount
  useEffect(() => {
    return () => {
      clearInterval(simIntervalRef.current);
      setIsDetecting(false); // Stop useFrameCapture hook
    };
  }, []);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const sendMessage = (camId) => {
    const msg = inputMsg[camId]?.trim();
    if (!msg) return;
    setMessages(prev => ({
      ...prev,
      [camId]: [...(prev[camId] || []), { from: 'coach', text: msg, time: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }) }]
    }));
    setInputMsg(prev => ({ ...prev, [camId]: '' }));
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      {/* Notifications */}
      {activeNotification && (
        <NotificationBanner
          notification={activeNotification}
          onDismiss={() => setActiveNotification(null)}
        />
      )}
      {/* Hidden elements for Roboflow capture */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 font-bold text-sm uppercase tracking-widest">Coaching Cockpit</span>
          </div>
          {activeSession && (
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">{activeSession.match_title}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* DSGVO Button */}
          <button
            onClick={() => setShowDsgvo(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-1"
          >
            <Shield className="w-3.5 h-3.5" /> DSGVO
          </button>
          {/* Tracking mode toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={handleSwitchToSim}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${trackingMode === 'simulation' ? 'bg-background text-foreground shadow' : 'text-muted-foreground'}`}
            >
              Demo
            </button>
            <button
              onClick={() => setShowApiSetup(s => !s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${trackingMode === 'roboflow' ? 'bg-primary text-primary-foreground shadow animate-pulse' : 'text-muted-foreground'}`}
            >
              <Wifi className="w-3 h-3" /> {isDetecting ? 'LIVE' : 'Echt'}
            </button>
          </div>
          <button
            onClick={() => setShowTracking(s => !s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${showTracking ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'}`}
          >
            {showTracking ? <Eye className="w-3.5 h-3.5 inline mr-1" /> : <EyeOff className="w-3.5 h-3.5 inline mr-1" />}
            Overlay
          </button>
        </div>
      </div>

      {/* Roboflow Tracking Setup Panel */}
      <AnimatePresence>
        {showApiSetup && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass rounded-xl p-4 mb-4 border border-primary/20"
          >
            <div className="text-sm font-grotesk font-semibold text-foreground mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Roboflow Live-Tracking aktivieren
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Verwendet den hinterlegten API-Key und Workflow <span className="font-mono text-primary/80">football-tracking-phase-1</span>.
              Die Kamera dieses Geräts wird für die Frame-Erfassung genutzt.
            </p>
            {!activeSession && (
              <div className="mb-3 text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
                ⚠️ Keine aktive Session — starte zuerst eine Live-Session.
              </div>
            )}
            <Button
              onClick={handleActivateRoboflow}
              disabled={!activeSession}
              className="bg-primary text-primary-foreground gap-2"
            >
              <Play className="w-4 h-4" /> Tracking starten
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roboflow Live Status */}
      {trackingMode === 'roboflow' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`glass rounded-xl p-3 mb-4 border flex items-center gap-3 text-xs ${
            trackingStreamStatus === 'error' ? 'border-destructive/30' : 'border-primary/30'
          }`}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${
            trackingStreamStatus === 'streaming' ? 'bg-primary animate-pulse' : 'bg-destructive'
          }`} />
          <span className={`font-bold ${trackingStreamStatus === 'streaming' ? 'text-primary' : 'text-destructive'}`}>
            {trackingStreamStatus === 'streaming' ? '🔴 LIVE TRACKING' : '⚠️ CONNECTION LOST'}
          </span>
          <span className="text-muted-foreground flex-1">
            Frame {trackingStats.frameCount} · {trackingStats.playersDetected}👥 · 
            {trackingStats.ballDetected ? '⚽' : '○'} · Latency {trackingStats.latencyMs}ms
          </span>
          <Button size="sm" variant="outline" onClick={handleSwitchToSim} className="text-xs">
            Stop
          </Button>
        </motion.div>
      )}

      {/* Session Health Check */}
      {activeSession && <SessionHealthCheck session={activeSession} />}

      {/* No session warning — mit Link zu Live-Session */}
      {!activeSession && (
        <div className="glass rounded-xl p-3 mb-4 border border-yellow-500/20 bg-yellow-500/5 text-sm text-yellow-400 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 flex-shrink-0" />
            <span>Keine aktive Live-Session. Starte zuerst eine Session um Kameras und Tracking zu nutzen.</span>
          </div>
          <a href="/live" className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs font-bold hover:bg-yellow-500/30 transition-all">
            → Live-Session starten
          </a>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-4">

        {/* ── LEFT: Camera Grid + Pitch ── */}
        <div className="lg:col-span-7 space-y-4">
          {/* TOP STATUS BAR */}
          <div className="glass rounded-xl p-4 border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div><div className="text-sm font-grotesk font-bold text-foreground">{playerCounts.home}</div><div className="text-[10px] text-muted-foreground">🏠 Heim</div></div>
              <div><div className="text-sm font-grotesk font-bold text-foreground">{playerCounts.away}</div><div className="text-[10px] text-muted-foreground">✈️ Gäste</div></div>
              <div><div className="text-sm font-grotesk font-bold text-primary">{trackingMode === 'roboflow' ? '🔴' : '⚪'}</div><div className="text-[10px] text-muted-foreground">Tracking</div></div>
              <div><div className="text-sm font-grotesk font-bold text-yellow-400">●</div><div className="text-[10px] text-muted-foreground">Ball</div></div>
            </div>
          </div>

          {/* Kamera-Bereitschaften Check */}
          {activeSession && trackingMode === 'roboflow' && (
            <CameraReadinessPanel
              cameras={cameras}
              readyToTrack={connectedCount > 0}
              onStartTracking={() => setIsDetecting(true)}
              disabled={isDetecting}
            />
          )}

          {/* Camera grid — Live Video Streams */}
          {cameras.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center border border-dashed border-border">
              <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Keine Kameras in dieser Session</p>
              <p className="text-xs text-muted-foreground mt-1">Füge Kameras in der Live-Session-Einrichtung hinzu</p>
            </div>
          ) : (
            <div className={`grid gap-3 ${cameras.length > 2 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
              {cameras.map((cam) => (
                <SimpleCameraView
                  key={cam.camera_id}
                  camera={cam}
                  status={cameraStates[cam.camera_id]?.status || 'waiting'}
                  liveUrl={liveUrl}
                  sessionId={activeSession?.id}
                />
              ))}
            </div>
          )}

          {/* Training Config */}
          <div className="glass rounded-xl p-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Modus:</span>
            {[
              { key: 'full', label: '11v11 Vollfeld' },
              { key: 'half', label: 'Halbfeld' },
              { key: 'small', label: 'Kleines Feld' },
              { key: 'training', label: 'Training' },
            ].map(p => (
              <button key={p.key} onClick={() => setPitchType(p.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${pitchType === p.key ? 'bg-primary/15 border border-primary/30 text-primary' : 'bg-muted border border-transparent text-muted-foreground hover:text-foreground'}`}>
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Spieler/Team:</span>
              {[3, 5, 7, 9, 11].map(n => (
                <button key={n} onClick={() => setPlayersPerTeam(n)}
                  className={`w-8 h-7 rounded-lg text-xs font-bold transition-all ${playersPerTeam === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Video Overlay Player */}
          <div className="glass rounded-xl p-4">
            <div className="text-sm font-grotesk font-semibold text-foreground mb-3 flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              Video + Overlay
            </div>
            <VideoOverlayPlayer
              detections={displayDetections.length > 0 ? displayDetections : playerList}
              ball={ball}
            />
          </div>

          {/* Live Pitch + Tracking */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span className="text-sm font-grotesk font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Live-Tracking
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${trackingMode === 'roboflow' ? 'bg-primary/20 text-primary' : 'bg-yellow-500/30 text-yellow-400'}`}>
                  {trackingMode === 'roboflow' ? '🔴 RF-DETR LIVE' : '▶️ SIMULATION (aktiv)'}
                </span>
                <span className="text-[10px] text-muted-foreground">{playersPerTeam}v{playersPerTeam}</span>
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-primary"><Circle className="w-2 h-2 fill-current" /> Heim ({playerCounts.home})</span>
                <span className="flex items-center gap-1 text-red-400"><Circle className="w-2 h-2 fill-current" /> Gäste ({playerCounts.away})</span>
                {pitchType === 'full' && <span className="flex items-center gap-1 text-orange-400"><Circle className="w-2 h-2 fill-current" /> SR ({playerCounts.referee})</span>}
                <span className="flex items-center gap-1 text-yellow-400"><Circle className="w-2 h-2 fill-current" /> Ball</span>
              </div>
            </div>
            {playerCounts.home === 0 && playerCounts.away === 0 && (
              <div className="mb-2 text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
                💡 Spieler erscheinen in wenigen Sekunden — Simulation startet automatisch...
              </div>
            )}
            <div className="relative aspect-[3/2] max-h-[300px]">
               <FootballPitch
                 players={playerList}
                 dangerZones={displayBall ? [{ x: displayBall.x, y: displayBall.y, intensity: 0.8, team: 'home' }] : []}
                 showGrid
                 pitchType={pitchType}
               />
               {/* Coverage-Bereiche der Kameras */}
               <div className="absolute inset-0">
                 <CoveragePitchOverlay cameras={cameras} />
               </div>
               {displayDetections.length > 0 && (
                 <TrackingOverlay
                   players={displayDetections}
                   ball={displayBall}
                   events={events.slice(0, 3)}
                 />
               )}
             </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span>🟢 Heim · 🔴 Gäste{pitchType === 'full' ? ' · 🟠 SR' : ''} · 🟡 Ball</span>
              <span className="ml-auto capitalize">{pitchType === 'full' ? '11v11' : pitchType === 'small' ? 'Kleines Feld' : pitchType === 'half' ? 'Halbfeld' : 'Training'} · {playersPerTeam}v{playersPerTeam}</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Stats + Events + Chat ── */}
        <div className="lg:col-span-5 space-y-4">

          {/* Live Stats */}
          <LiveStats stats={stats} playerCounts={playerCounts} />

          {/* Stream Monitor */}
          <StreamMonitor cameraHealth={cameraHealth} globalHealth={globalHealth} />

          {/* Live Tracking Panel (Auto-Events + Heatmaps) */}
          {activeSession && (
            <LiveTrackingPanel sessionId={activeSession.id} />
          )}

          {/* Funk-Kanal — Real-time Kommunikation mit Kameras */}
          {activeSession && (
            <div className="glass rounded-xl overflow-hidden" style={{ height: 360 }}>
              <FunkPanel sessionId={activeSession.id} />
            </div>
          )}

          {/* Manual Event Buttons — Coach */}
          <div className="glass rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Target className="w-3.5 h-3.5" /> Ereignis tippen
            </div>
            <EventButtons
              sessionId={activeSession?.id}
              matchId={activeSession?.match_id}
              matchTitle={activeSession?.match_title}
              source="coach_cockpit"
              elapsedSeconds={0}
              compact={true}
            />
          </div>

          {/* Auto Event Log */}
          <EventLog events={events} />

          {/* Camera codes — Codes kommen aus Session-DB, keine Random-Generierung */}
          {cameras.length > 0 && (
            <div className="glass rounded-xl p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5" /> Kameras einladen
              </div>
              <div className="space-y-2">
                {cameras.map((cam) => {
                  // Code aus Session-Daten — KEIN Math.random() hier (würde bei jedem Render neu generieren!)
                  const code = cam.code || cam.camera_id;
                  const camUrl = `${liveUrl}?session=${activeSession.id}&cam=${cam.camera_id}`;
                  return (
                    <div key={cam.camera_id} className="bg-muted rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-foreground">{cam.label || `Kamera ${cam.camera_id}`}</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${cam.status === 'connected' ? 'bg-primary' : 'bg-yellow-400'} animate-pulse`} />
                          <span className={`text-[10px] ${cam.status === 'connected' ? 'text-primary' : 'text-yellow-400'}`}>
                            {cam.status === 'connected' ? 'Verbunden' : 'Wartet'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-base font-grotesk font-bold text-primary tracking-[0.15em] flex-1 truncate">{camUrl}</div>
                        <button onClick={() => copyCode(camUrl)} className="p-1.5 rounded-lg bg-background border border-border text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                          {copiedCode === camUrl ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setShowShare(cam)} className="p-1.5 rounded-lg bg-background border border-border text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && (
          <ShareCameraLink cam={showShare} liveUrl={liveUrl} onClose={() => setShowShare(null)} />
        )}
      </AnimatePresence>

      {/* DSGVO Manager Modal */}
      <AnimatePresence>
        {showDsgvo && (
          <div>
            <DsgvoConsentManager players={players} onClose={() => setShowDsgvo(false)} />
            {/* Bestätigungs-Banner wenn Roboflow aktiviert werden soll */}
            {apiKeyInput.trim() && !trackingUnlocked && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] glass rounded-2xl p-4 border border-primary/30 shadow-2xl flex items-center gap-4 max-w-sm w-full mx-4">
                <Shield className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground">Einwilligungen geprüft?</div>
                  <div className="text-xs text-muted-foreground">Tracking starten wenn alle Einwilligungen erteilt oder anonymisiert</div>
                </div>
                <Button size="sm" onClick={handleDsgvoConfirm} className="bg-primary text-primary-foreground">
                  Starten
                </Button>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}