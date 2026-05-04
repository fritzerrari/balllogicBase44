/**
 * LiveSessionActive — Profi Live-Session Dashboard
 * Trainer-Ansicht: Kameras | Pitch-Tracking | Anstoß | Events | Statistiken
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Square, Zap, Video, BarChart3, Radio, Play, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import EventButtons from '@/components/live/EventButtons';
import LiveCameraGrid from '@/components/live/LiveCameraGrid';
import LivePitchTracker from '@/components/live/LivePitchTracker';
import KickoffDetectionPanel from '@/components/live/KickoffDetectionPanel';
import EventApprovalPanel from '@/components/live/EventApprovalPanel';
import DsgvoGatekeeper from '@/components/live/DsgvoGatekeeper';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const TABS = [
  { id: 'cameras', label: 'Kameras', icon: Video },
  { id: 'tracking', label: 'Tracking', icon: BarChart3 },
  { id: 'events', label: 'Events', icon: Zap },
];

export default function LiveSessionActive({ session, onStop, isFinishing }) {
  const [tab, setTab] = useState('cameras');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [halfTime, setHalfTime] = useState(1);
  const [showHalftimeAlert, setShowHalftimeAlert] = useState(false);
  const [kickoffDetected, setKickoffDetected] = useState(session?.kickoff_detected || false);
  const [doingKickoff, setDoingKickoff] = useState(false);
  const timerRef = useRef(null);
  const halftimeRef = useRef(false);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(t => {
        const next = t + 1;
        if (next === 45 * 60 && halfTime === 1 && !halftimeRef.current) {
          halftimeRef.current = true;
          setShowHalftimeAlert(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [halfTime]);

  // Poll session for kickoff status
  const { data: liveSession } = useQuery({
    queryKey: ['live-session-active', session.id],
    queryFn: () => base44.entities.LiveSession.filter({ id: session.id }).then(r => r[0]),
    refetchInterval: 5000,
    staleTime: 2000,
  });

  // Live camera connection count
  const connectedCams = (liveSession?.camera_streams || session?.camera_streams || [])
    .filter(c => {
      const ms = c.last_seen ? Date.now() - new Date(c.last_seen).getTime() : null;
      return ms !== null && ms < 15000;
    }).length;
  const totalCams = session?.camera_streams?.length || 0;

  const gameMinute = halfTime === 1
    ? Math.floor(elapsedSeconds / 60)
    : 45 + Math.floor((elapsedSeconds - 45 * 60) / 60);

  const handleHalfTwo = () => {
    setShowHalftimeAlert(false);
    setHalfTime(2);
    setElapsedSeconds(45 * 60);
    halftimeRef.current = false;
    // Halbzeit: kickoff_detected zurücksetzen → neue Kalibrierung nötig (Seitenwechsel)
    setKickoffDetected(false);
    base44.entities.LiveSession.update(session.id, {
      half_time: 2,
      kickoff_detected: false, // Kalibrierung zurücksetzen für Seitenwechsel
    }).catch(() => {});
  };

  const handleKickoff = async () => {
    setDoingKickoff(true);
    try {
      await base44.functions.invoke('detectKickoffFormation', { session_id: session.id }).catch(() => {});
      await base44.entities.LiveSession.update(session.id, {
        kickoff_detected: true,
        kickoff_timestamp: new Date().toISOString(),
      });
      setKickoffDetected(true);
    } catch (e) {
      // ignore
    }
    setDoingKickoff(false);
  };

  return (
    <>
      <DsgvoGatekeeper sessionId={session.id} onReadyToStart={() => {}} />

      {/* HALFTIME ALERT */}
      <AnimatePresence>
        {showHalftimeAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="glass rounded-2xl p-8 max-w-sm w-full text-center space-y-4"
            >
              <div className="text-5xl">⏸️</div>
              <h2 className="font-grotesk text-2xl font-bold">Halbzeit!</h2>
              <p className="text-sm text-muted-foreground">45 Minuten gespielt — weiter zur 2. Halbzeit?</p>
              <div className="flex gap-3">
                <Button onClick={handleHalfTwo} className="flex-1 h-12 text-base font-bold bg-primary">
                  ▶️ 2. Halbzeit
                </Button>
                <Button onClick={() => setShowHalftimeAlert(false)} variant="outline" className="flex-1">
                  Pause
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-background flex flex-col">

        {/* ── TOP STATUS BAR ── */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">

            {/* Timer */}
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
              <span className="font-mono text-2xl lg:text-3xl font-bold tabular-nums">{formatTime(elapsedSeconds)}</span>
              <div className="text-xs text-muted-foreground leading-tight">
                <div className="font-bold text-primary">{halfTime}. HZ</div>
                <div>{gameMinute}'</div>
              </div>
            </div>

            {/* Match Title + Stats */}
            <div className="text-center flex-1 min-w-0 hidden sm:block">
              <h1 className="font-grotesk font-bold text-lg truncate">{session.match_title}</h1>
              <div className="flex items-center justify-center gap-3 mt-0.5">
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                  📹 {connectedCams}/{totalCams} Kameras
                </Badge>
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                  ⚽ {eventCount} Events
                </Badge>
                {kickoffDetected && (
                  <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30 px-2 py-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Kalibriert
                  </Badge>
                )}
              </div>
            </div>

            {/* Right: Kickoff + Stop */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {!kickoffDetected ? (
                <Button
                  onClick={handleKickoff}
                  disabled={doingKickoff}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold gap-2 h-9"
                >
                  {doingKickoff
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Erfasse...</>
                    : <><Play className="w-4 h-4" /> Anstoß</>
                  }
                </Button>
              ) : (
                <Badge className="bg-primary/15 text-primary border-primary/30 gap-1 px-3 py-1.5 text-xs font-bold">
                  <CheckCircle2 className="w-3 h-3" /> Teams erkannt
                </Badge>
              )}
              <Button
                onClick={onStop}
                disabled={isFinishing}
                className="bg-red-600 hover:bg-red-700 gap-2 h-9"
              >
                <Square className="w-4 h-4" />
                {isFinishing ? 'Beende...' : 'Beenden'}
              </Button>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-3 lg:p-5">

          {/* Desktop: 3-Column Layout */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-4">

            {/* LEFT: Events (3 cols) */}
            <div className="col-span-3 space-y-4">
              <div className="glass rounded-xl p-4 border border-border">
                <h2 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-primary" /> Events tippen
                </h2>
                <EventButtons
                  sessionId={session.id}
                  matchId={session.match_id}
                  matchTitle={session.match_title}
                  source="coach"
                  elapsedSeconds={elapsedSeconds}
                  compact
                  onEventLogged={() => setEventCount(c => c + 1)}
                />
              </div>
              <EventApprovalPanel sessionId={session.id} />
            </div>

            {/* CENTER: Pitch Tracker (5 cols) */}
            <div className="col-span-5 space-y-4">
              <div className="glass rounded-xl p-4 border border-border">
                <h2 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-primary" /> Live Tracking
                </h2>
                <LivePitchTracker sessionId={session.id} kickoffDetected={kickoffDetected} />
              </div>

              {/* Kickoff Panel — only if not yet calibrated */}
              {!kickoffDetected && (
                <KickoffDetectionPanel
                  session={liveSession || session}
                  onKickoffDetected={() => setKickoffDetected(true)}
                />
              )}
            </div>

            {/* RIGHT: Cameras (4 cols) */}
            <div className="col-span-4 space-y-4">
              <div className="glass rounded-xl p-4 border border-border">
                <h2 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <Video className="w-3.5 h-3.5 text-primary" /> Live Kameras
                </h2>
                <LiveCameraGrid session={liveSession || session} />
              </div>
            </div>
          </div>

          {/* Mobile / Tablet: Tab Layout */}
          <div className="lg:hidden space-y-3">

            {/* Tab Nav */}
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              {TABS.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                      tab === t.id
                        ? 'bg-background text-foreground shadow'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {tab === 'cameras' && (
                <motion.div key="cameras" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <div className="glass rounded-xl p-4 border border-border">
                    <LiveCameraGrid session={liveSession || session} />
                  </div>
                </motion.div>
              )}
              {tab === 'tracking' && (
                <motion.div key="tracking" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                  <div className="glass rounded-xl p-4 border border-border">
                    <LivePitchTracker sessionId={session.id} kickoffDetected={kickoffDetected} />
                  </div>
                  {!kickoffDetected && (
                    <KickoffDetectionPanel
                      session={liveSession || session}
                      onKickoffDetected={() => setKickoffDetected(true)}
                    />
                  )}
                </motion.div>
              )}
              {tab === 'events' && (
                <motion.div key="events" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                  <div className="glass rounded-xl p-4 border border-border">
                    <EventButtons
                      sessionId={session.id}
                      matchId={session.match_id}
                      matchTitle={session.match_title}
                      source="coach"
                      elapsedSeconds={elapsedSeconds}
                      onEventLogged={() => setEventCount(c => c + 1)}
                    />
                  </div>
                  <EventApprovalPanel sessionId={session.id} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}