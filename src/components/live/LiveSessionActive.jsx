/**
 * LiveSessionActive — Super Simple Live Session View
 * Timer + Event Buttons + Camera Links (ALLES)
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Square, Copy, Share2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import EventButtons from '@/components/live/EventButtons';
import CameraQuickShare from './CameraQuickShare';
import LiveSessionStats from './LiveSessionStats';
import AutomationControlPanel from './AutomationControlPanel';
import EventApprovalPanel from './EventApprovalPanel';
import MobileTrainerView from './MobileTrainerView';
import DsgvoGatekeeper from './DsgvoGatekeeper';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function LiveSessionActive({ session, onStop, isFinishing }) {
  // Auto-create SessionState if missing
  const [_sessionStateInit] = useState(() => {
    if (session) {
      base44.entities.SessionState.create({
        session_id: session.id,
        frame_count: 0,
        last_frame_number: 0,
        possession_percentage: { home: 50, away: 50, last_updated_frame: 0 },
        detection_quality_avg: 0,
        updated_at: new Date().toISOString(),
      }).catch(() => {}); // Silent if already exists
    }
    return null;
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [halfTime, setHalfTime] = useState(1);
  const [showHalftimeAlert, setShowHalftimeAlert] = useState(false);
  const timerRef = useRef(null);
  const halftimeRef = useRef(false);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(t => {
        const next = t + 1;
        // Auto-halftime alert at 45'
        if (next === 45 * 60 && halfTime === 1 && !halftimeRef.current) {
          halftimeRef.current = true;
          setShowHalftimeAlert(true);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [halfTime]);

  const gameMinute = halfTime === 1 ? Math.floor(elapsedSeconds / 60) : 45 + Math.floor((elapsedSeconds - 45 * 60) / 60);
  const cameraList = session?.camera_streams || [];

  const handleHalfTwo = () => {
    setShowHalftimeAlert(false);
    setHalfTime(2);
    setElapsedSeconds(45 * 60);
    halftimeRef.current = false;
    base44.entities.LiveSession.update(session.id, { half_time: 2 }).catch(() => {});
  };

  // Mobile view für Trainer
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return (
      <>
        <DsgvoGatekeeper sessionId={session.id} onReadyToStart={() => {}} />
        <MobileTrainerView session={session} elapsedSeconds={elapsedSeconds} onStop={onStop} />
      </>
    );
  }

  return (
    <>
      <DsgvoGatekeeper sessionId={session.id} onReadyToStart={() => {}} />
      <div className="min-h-screen bg-background">
        {/* HALFTIME ALERT */}
      <AnimatePresence>
        {showHalftimeAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          >
            <div className="glass rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
              <div className="text-5xl">⏸️</div>
              <h2 className="font-grotesk text-2xl font-bold">45 Minuten vorbei!</h2>
              <p className="text-sm text-muted-foreground">Halbzeit — wollen Sie weitermachen?</p>
              <div className="flex gap-3">
                <Button onClick={handleHalfTwo} className="flex-1 h-12 text-base font-bold bg-primary">
                  ▶️ 2. Halbzeit
                </Button>
                <Button onClick={() => setShowHalftimeAlert(false)} variant="outline" className="flex-1">
                  Pause
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP BAR */}
      <div className="bg-gradient-to-b from-background to-transparent border-b border-border p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Timer */}
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="font-mono text-3xl font-bold">{formatTime(elapsedSeconds)}</span>
            <div className="text-xs text-muted-foreground">
              <div className="font-bold">{halfTime}. HZ</div>
              <div>Min {gameMinute}'</div>
            </div>
          </div>

          {/* Center: Title */}
          <div className="text-center">
            <h1 className="font-grotesk font-bold text-lg">{session.match_title}</h1>
            <div className="text-xs text-muted-foreground">{cameraList.length} Kamera{cameraList.length !== 1 ? 's' : ''} aktiv</div>
          </div>

          {/* Right: Stop Button */}
          <Button
            onClick={onStop}
            disabled={isFinishing}
            className="bg-red-600 hover:bg-red-700 gap-2 h-10"
          >
            <Square className="w-4 h-4" /> {isFinishing ? 'Beende...' : 'Beenden'}
          </Button>
        </div>

        {/* Stats Row */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="px-3 py-1.5">
            ⚽ {eventCount} Events
          </Badge>
          <Badge variant="outline" className="px-3 py-1.5">
            {cameraList.filter(c => c.status === 'connected').length}/{cameraList.length} Kameras
          </Badge>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="p-3 md:p-4 lg:p-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* LEFT: AUTOMATION + EVENTS */}
          <div className="space-y-4">
            <div className="glass rounded-xl p-4 border border-border">
              <h2 className="text-sm font-bold mb-3">⚽ Event Tippen</h2>
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

            <AutomationControlPanel sessionId={session.id} matchId={session.match_id} />
            <EventApprovalPanel sessionId={session.id} />
          </div>

          {/* CENTER: CAMERA LINKS */}
          <div className="md:col-span-1 lg:col-span-3 space-y-4">
            {cameraList.length > 0 ? (
              cameraList.map(cam => (
                <CameraQuickShare
                  key={cam.camera_id}
                  session={session}
                  camera={cam}
                />
              ))
            ) : (
              <div className="glass rounded-xl p-8 text-center text-muted-foreground">
                <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Keine Kameras konfiguriert</p>
              </div>
            )}

            {/* Stats */}
            <LiveSessionStats sessionId={session.id} />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}