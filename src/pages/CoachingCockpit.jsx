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
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, Camera, Mic, MicOff, MessageSquare, Send,
  Zap, Users, Circle, Target, Shield,
  Copy, Check, Smartphone, Share2, Settings, Play, Pause,
  Eye, EyeOff, Wifi, WifiOff, Video
} from 'lucide-react';
import EventButtons from '@/components/live/EventButtons';
import SessionHealthCheck from '@/components/live/SessionHealthCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import FootballPitch from '@/components/pitch/FootballPitch';
import TrackingOverlay from '@/components/live/TrackingOverlay';
import VideoOverlayPlayer from '@/components/tracking/VideoOverlayPlayer';
import CameraFeedCard from '@/components/live/CameraFeedCard';
import ShareCameraLink from '@/components/live/ShareCameraLink';
import EventLog from '@/components/live/EventLog';
import LiveStats from '@/components/live/LiveStats';
import DsgvoConsentManager from '@/components/players/DsgvoConsentManager';
import NotificationBanner from '@/components/live/NotificationBanner';
import {
  detectFrame,
  assignTeamsByColor,
  detectEvents,
  smoothDetections,
  simulateDetections,
  computeStats,
} from '@/lib/footballTracker';
import useFrameCapture from '@/hooks/useFrameCapture';
import LiveTrackingPanel from '@/components/tracking/LiveTrackingPanel';

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

  // Tracking state
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

  // ── Load sessions + players (für DSGVO) ────────────────────────────────────
  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('-created_date', 100),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['liveSessions'],
    queryFn: () => base44.entities.LiveSession.filter({ status: 'active' }),
    refetchInterval: 8000,
  });

  const activeSession = sessions[0];
  const cameras = activeSession?.camera_streams || [
    { camera_id: '1', label: 'Tribüne Mitte', code: '382741', status: 'connected' },
    { camera_id: '2', label: 'Torlinie Heim', code: '194822', status: 'connected' },
    { camera_id: '3', label: 'Torlinie Gäste', code: '571039', status: 'waiting' },
  ];

  const liveUrl = `${window.location.origin}/cam`;

  // ── Simulation mode ────────────────────────────────────────────────────────
  useEffect(() => {
    if (trackingMode !== 'simulation') return;
    simIntervalRef.current = setInterval(() => {
      setTrackTick(t => {
        const newTick = t + 1;
        const { players } = simulateDetections(newTick, { playersPerTeam, pitchType, includeReferee: pitchType === 'full' });
        setPrevDetections(detections);
        setDetections(players);
        // Simulate auto events occasionally
        if (newTick % 40 === 0) {
          const simEvents = detectEvents(players, [], { left: 2, right: 98, top: 2, bottom: 98 });
          if (simEvents.length > 0) {
            setEvents(prev => [
              ...simEvents.map(e => ({ ...e, id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })),
              ...prev
            ].slice(0, 50));
          }
        }
        return newTick;
      });
    }, 500);
    return () => clearInterval(simIntervalRef.current);
  }, [trackingMode, playersPerTeam, pitchType]);

  // ── Roboflow mode ──────────────────────────────────────────────────────────
  // Frame capture hook — sendet alle 2s Frames an processFrame
  const { frameCount } = useFrameCapture(
    hiddenCanvasRef,
    activeSession?.id,
    'home',
    trackingMode === 'roboflow' && isDetecting
  );

  const startRoboflowTracking = useCallback(async (key) => {
    setApiError(null);
    setIsDetecting(true);

    // Start camera capture
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      setApiError('Kamera-Zugriff verweigert. Nutze Simulation.');
      setTrackingMode('simulation');
      setIsDetecting(false);
      return;
    }

    // Detection loop — 1 frame per 2 seconds (API rate limit)
    detectionIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const canvas = hiddenCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      try {
        let raw = await detectFrame(canvas, key);
        raw = assignTeamsByColor(canvas, raw);
        const smoothed = smoothDetections(raw);

        const newEvents = detectEvents(smoothed, detections, { left: 2, right: 98, top: 2, bottom: 98 });
        if (newEvents.length > 0) {
          setEvents(prev => [
            ...newEvents.map(e => ({
              ...e,
              id: Date.now() + Math.random(),
              time: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            })),
            ...prev,
          ].slice(0, 50));
        }

        setPrevDetections(detections);
        setDetections(smoothed);
        setStatsHistory(prev => [...prev.slice(-30), smoothed]);
        setApiError(null);
      } catch (e) {
        setApiError(`API-Fehler: ${e.message}`);
      }
    }, 2000);
  }, [detections]);

  const stopRoboflowTracking = () => {
    clearInterval(detectionIntervalRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsDetecting(false);
  };

  const handleActivateRoboflow = () => {
    if (!apiKeyInput.trim()) return;
    // DSGVO-Check: Warnen wenn Spieler mit ausstehender Einwilligung vorhanden
    const pendingConsent = players.filter(p =>
      !p.tracking_consent || p.tracking_consent === 'pending' || p.tracking_consent === 'guardian_required'
    );
    if (pendingConsent.length > 0 && !trackingUnlocked) {
      setShowDsgvo(true);
      return;
    }
    setApiKey(apiKeyInput.trim());
    setTrackingMode('roboflow');
    setShowApiSetup(false);
    clearInterval(simIntervalRef.current);
    startRoboflowTracking(apiKeyInput.trim());
  };

  const handleDsgvoConfirm = () => {
    setTrackingUnlocked(true);
    setShowDsgvo(false);
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      setTrackingMode('roboflow');
      setShowApiSetup(false);
      clearInterval(simIntervalRef.current);
      startRoboflowTracking(apiKeyInput.trim());
    }
  };

  const handleSwitchToSim = () => {
    stopRoboflowTracking();
    setTrackingMode('simulation');
    setApiError(null);
  };

  // Cleanup
  useEffect(() => () => {
    clearInterval(detectionIntervalRef.current);
    clearInterval(simIntervalRef.current);
    stopRoboflowTracking();
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const ball = detections.find(d => d.class === 'ball') || null;
  const playerList = detections.filter(d => d.class !== 'ball');
  const stats = computeStats(statsHistory);
  const playerCounts = {
    home: detections.filter(d => d.team === 'home').length,
    away: detections.filter(d => d.team === 'away').length,
    referee: detections.filter(d => d.class === 'referee').length,
  };

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
              Simulation
            </button>
            <button
              onClick={() => setShowApiSetup(s => !s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${trackingMode === 'roboflow' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'}`}
            >
              <Wifi className="w-3 h-3" /> Roboflow Live
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

      {/* Roboflow API Setup Panel */}
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
              Roboflow RF-DETR Live-Tracking aktivieren
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Kostenlos registrieren auf{' '}
              <a href="https://roboflow.com" target="_blank" rel="noopener" className="text-primary hover:underline">roboflow.com</a>
              {' '}→ API Key kopieren → hier einfügen.
              Das Modell erkennt Spieler, Torwart, Schiedsrichter & Ball automatisch mit RF-DETR/YOLOv11.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="rf_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="bg-muted border-border font-mono text-sm flex-1"
                onKeyDown={e => e.key === 'Enter' && handleActivateRoboflow()}
              />
              <Button
                onClick={handleActivateRoboflow}
                disabled={!apiKeyInput.trim()}
                className="bg-primary text-primary-foreground gap-2"
              >
                <Play className="w-4 h-4" /> Aktivieren
              </Button>
            </div>
            {apiError && (
              <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5" /> {apiError}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roboflow active banner */}
      {trackingMode === 'roboflow' && (
        <div className="glass rounded-xl p-3 mb-4 border border-primary/30 flex items-center gap-3 text-xs">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-primary font-bold">RF-DETR LIVE</span>
          <span className="text-muted-foreground">Erkennt: Spieler · Torwart · Schiedsrichter · Ball · Trikotfarben</span>
          <button onClick={handleSwitchToSim} className="ml-auto text-muted-foreground hover:text-foreground text-xs underline">
            Stoppen
          </button>
        </div>
      )}

      {/* Session Health Check */}
      {activeSession && <SessionHealthCheck session={activeSession} />}

      {/* No session warning */}
      {!activeSession && (
        <div className="glass rounded-xl p-3 mb-4 border border-yellow-500/20 bg-yellow-500/5 text-xs text-yellow-400 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5" />
          Keine aktive Live-Session — Demo-Daten werden angezeigt
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-4">

        {/* ── LEFT: Camera Grid + Pitch ── */}
        <div className="lg:col-span-7 space-y-4">

          {/* Camera grid */}
          <div className={`grid gap-3 ${cameras.length > 2 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
            {cameras.map((cam) => (
              <CameraFeedCard
                key={cam.camera_id}
                cam={cam}
                isSelected={selectedCam === cam.camera_id}
                onSelect={() => setSelectedCam(selectedCam === cam.camera_id ? null : cam.camera_id)}
                onShare={() => setShowShare(cam)}
                onCopyCode={() => copyCode(cam.code || cam.camera_id)}
                copied={copiedCode === (cam.code || cam.camera_id)}
                liveUrl={liveUrl}
                messages={messages[cam.camera_id] || []}
                inputMsg={inputMsg[cam.camera_id] || ''}
                onInputChange={(v) => setInputMsg(prev => ({ ...prev, [cam.camera_id]: v }))}
                onSend={() => sendMessage(cam.camera_id)}
                micActive={!!micActive[cam.camera_id]}
                onMicToggle={() => setMicActive(prev => ({ ...prev, [cam.camera_id]: !prev[cam.camera_id] }))}
              />
            ))}
            <div
              className="aspect-video rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/30 cursor-pointer transition-all group"
              onClick={() => setShowShare({ camera_id: 'new', label: 'Neue Kamera', code: Math.floor(100000 + Math.random() * 900000).toString() })}
            >
              <Camera className="w-6 h-6 group-hover:text-primary transition-colors" />
              <span className="text-xs">+ Kamera</span>
            </div>
          </div>

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
              detections={playerList}
              ball={ball}
            />
          </div>

          {/* Live Pitch + Tracking */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span className="text-sm font-grotesk font-semibold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Live-Tracking
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${trackingMode === 'roboflow' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {trackingMode === 'roboflow' ? '🔴 RF-DETR LIVE' : '⚪ Simulation'}
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
            <div className="relative aspect-[3/2] max-h-[300px]">
              <FootballPitch
                players={showTracking ? playerList : []}
                dangerZones={ball ? [{ x: ball.x, y: ball.y, intensity: 0.8, team: 'home' }] : []}
                showGrid
                pitchType={pitchType}
              />
              {showTracking && (
                <TrackingOverlay
                  players={playerList}
                  ball={ball}
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

          {/* Live Tracking Panel (Auto-Events + Heatmaps) */}
          {activeSession && (
            <LiveTrackingPanel sessionId={activeSession.id} />
          )}

          {/* Manual Event Buttons — Coach */}
          <div className="glass rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Target className="w-3.5 h-3.5" /> Ereignis tippen
            </div>
            <EventButtons
              sessionId={activeSession?.id}
              matchTitle={activeSession?.match_title}
              source="coach_cockpit"
              elapsedSeconds={0}
              compact={true}
            />
          </div>

          {/* Auto Event Log */}
          <EventLog events={events} />

          {/* Team Broadcast */}
          <div className="glass rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" /> Team-Broadcast
            </div>
            <div className="bg-muted rounded-lg p-3 mb-3 max-h-28 overflow-y-auto space-y-1.5">
              {(messages['broadcast'] || []).length === 0
                ? <div className="text-xs text-muted-foreground text-center">Nachrichten an alle Assistenten</div>
                : (messages['broadcast'] || []).map((m, i) => (
                  <div key={i} className="bg-primary/10 rounded-lg px-3 py-1.5 text-xs text-foreground flex justify-between">
                    <span>{m.text}</span><span className="text-muted-foreground">{m.time}</span>
                  </div>
                ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nachricht an alle..."
                value={inputMsg['broadcast'] || ''}
                onChange={e => setInputMsg(prev => ({ ...prev, broadcast: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && sendMessage('broadcast')}
                className="bg-muted border-border text-xs flex-1"
              />
              <Button size="sm" onClick={() => sendMessage('broadcast')} className="bg-primary text-primary-foreground px-3">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Camera codes */}
          <div className="glass rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5" /> Kameras einladen
            </div>
            <div className="space-y-2">
              {cameras.map((cam) => {
                const code = cam.code || cam.camera_id;
                const camUrl = `${liveUrl}?code=${code}`;
                return (
                  <div key={cam.camera_id} className="bg-muted rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-foreground">{cam.label}</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${cam.status === 'connected' ? 'bg-primary' : 'bg-yellow-400'} animate-pulse`} />
                        <span className={`text-[10px] ${cam.status === 'connected' ? 'text-primary' : 'text-yellow-400'}`}>
                          {cam.status === 'connected' ? 'Verbunden' : 'Wartet'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-grotesk font-bold text-primary tracking-[0.2em] flex-1">{code}</div>
                      <button onClick={() => copyCode(code)} className="p-1.5 rounded-lg bg-background border border-border text-muted-foreground hover:text-primary transition-colors">
                        {copiedCode === code ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setShowShare(cam)} className="p-1.5 rounded-lg bg-background border border-border text-muted-foreground hover:text-primary transition-colors">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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