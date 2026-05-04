/**
 * MobileTrainerView — Mobile-Optimiert für Trainer/Session-Creator
 * Funk als Overlay (nicht als Tab — damit man nie "feststeckt")
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import EventButtons from './EventButtons';
import FunkPanel from './FunkPanel';
import LiveTrackingPanel from '@/components/tracking/LiveTrackingPanel';
import CameraStreamViewLive from './CameraStreamViewLive';
import useFunkSubscription from '@/hooks/useFunkSubscription';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function MobileTrainerView({ session, elapsedSeconds, onStop }) {
  const [activeTab, setActiveTab] = useState('cameras');
  const [showFunk, setShowFunk] = useState(false);

  // Live Funk messages count for badge
  const { messages } = useFunkSubscription(session?.id);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const unreadCount = messages.length - lastSeenCount;

  const handleOpenFunk = () => {
    setShowFunk(true);
    setLastSeenCount(messages.length);
  };
  const handleCloseFunk = () => {
    setShowFunk(false);
    setLastSeenCount(messages.length);
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-40">
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border flex-shrink-0">
        <div>
          <div className="text-xs font-bold text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            LIVE
          </div>
          <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{session.match_title}</div>
        </div>
        <div className="text-sm font-mono text-foreground font-bold">
          {formatTime(elapsedSeconds)}
        </div>
        <div className="flex items-center gap-2">
          {/* Funk Button — immer sichtbar */}
          <button
            onClick={handleOpenFunk}
            className="relative px-2.5 py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary text-[11px] font-bold"
          >
            📻 Funk
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={onStop}
            className="px-2 py-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded"
          >
            STOP
          </button>
        </div>
      </div>

      {/* TABBED CONTENT */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 px-2 py-1 h-auto bg-muted rounded-none flex-shrink-0">
          <TabsTrigger value="cameras" className="text-[11px] py-1.5">
            📹 Kameras
          </TabsTrigger>
          <TabsTrigger value="events" className="text-[11px] py-1.5">
            ⚽ Events
          </TabsTrigger>
          <TabsTrigger value="tracking" className="text-[11px] py-1.5">
            📊 Tracking
          </TabsTrigger>
        </TabsList>

        {/* CAMERAS TAB — Live-Streams + Status */}
        <TabsContent value="cameras" className="flex-1 overflow-y-auto p-2 space-y-2">
          {session.camera_streams?.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              Keine Kameras konfiguriert
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {session.camera_streams?.map(cam => (
              <div key={cam.camera_id} className="glass rounded-lg overflow-hidden border border-border">
                <div className="aspect-video bg-black relative">
                  <CameraStreamViewLive
                    camera={cam}
                    sessionId={session.id}
                    trackingData={null}
                  />
                </div>
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-foreground">{cam.label}</div>
                    <div className={`text-[10px] ${cam.status === 'connected' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {cam.status === 'connected' ? '✓ Verbunden' : '○ Wartet'}
                    </div>
                  </div>
                  {cam.code && (
                    <div className="text-[9px] font-mono text-muted-foreground">
                      #{cam.code}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Letzte Funk-Nachrichten auch im Kamera-Tab sichtbar */}
          {messages.length > 0 && (
            <div className="glass rounded-lg p-2 border border-border/50">
              <div className="text-[10px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                📻 Letzte Funksprüche
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {messages.slice(-5).map((msg, i) => (
                  <div key={msg.id || i} className="flex items-start gap-2 text-[10px]">
                    <span className="text-primary font-bold flex-shrink-0">{msg.from_label || msg.from}:</span>
                    <span className="text-foreground/80">{msg.text}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleOpenFunk} className="mt-1.5 text-[10px] text-primary underline">
                Alle anzeigen →
              </button>
            </div>
          )}
        </TabsContent>

        {/* EVENTS TAB */}
        <TabsContent value="events" className="flex-1 overflow-y-auto p-2">
          <EventButtons
            sessionId={session.id}
            matchId={session.match_id}
            matchTitle={session.match_title}
            source="coach"
            elapsedSeconds={elapsedSeconds}
            compact={true}
          />
        </TabsContent>

        {/* TRACKING TAB */}
        <TabsContent value="tracking" className="flex-1 overflow-y-auto p-2">
          <LiveTrackingPanel sessionId={session.id} />
        </TabsContent>
      </Tabs>

      {/* FUNK OVERLAY — Slide-up, schließbar mit X */}
      <AnimatePresence>
        {showFunk && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            {/* Funk-Header mit X-Button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">📻 Funk-Kanal</span>
                <span className="text-[10px] text-muted-foreground">{session.match_title}</span>
              </div>
              <button
                onClick={handleCloseFunk}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <FunkPanel sessionId={session.id} onClose={handleCloseFunk} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}