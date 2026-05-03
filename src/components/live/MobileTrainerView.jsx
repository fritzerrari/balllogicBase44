/**
 * MobileTrainerView — Mobile-Optimiert für Trainer/Session-Creator
 * Alles sichtbar: Kameras, Stats, Events, Funk
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Radio, BarChart3, Settings } from 'lucide-react';
import EventButtons from './EventButtons';
import FunkPanel from './FunkPanel';
import LiveTrackingPanel from '@/components/tracking/LiveTrackingPanel';
import CameraStreamViewLive from './CameraStreamViewLive';

export default function MobileTrainerView({ session, elapsedSeconds, onStop }) {
  const [activeTab, setActiveTab] = useState('cameras');

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-40 md:hidden">
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border">
        <div>
          <div className="text-xs font-bold text-primary">🔴 LIVE</div>
          <div className="text-[10px] text-muted-foreground truncate">{session.match_title}</div>
        </div>
        <div className="text-xs font-mono text-foreground">
          {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
        </div>
        <button
          onClick={onStop}
          className="px-2 py-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded"
        >
          STOP
        </button>
      </div>

      {/* TABBED CONTENT */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-4 px-2 py-1 h-auto bg-muted rounded-none">
          <TabsTrigger value="cameras" className="text-[11px] py-1">
            📹 Kameras
          </TabsTrigger>
          <TabsTrigger value="events" className="text-[11px] py-1">
            ⚽ Events
          </TabsTrigger>
          <TabsTrigger value="tracking" className="text-[11px] py-1">
            📊 Tracking
          </TabsTrigger>
          <TabsTrigger value="funk" className="text-[11px] py-1">
            📻 Funk
          </TabsTrigger>
        </TabsList>

        {/* CAMERAS TAB */}
        <TabsContent value="cameras" className="flex-1 overflow-y-auto p-2 space-y-2">
          {session.camera_streams?.map(cam => (
            <div key={cam.camera_id} className="glass rounded-lg overflow-hidden border border-border">
              <div className="aspect-video bg-black relative">
                <CameraStreamViewLive
                  camera={cam}
                  sessionId={session.id}
                  trackingData={null}
                />
              </div>
              <div className="p-2 text-[10px]">
                <div className="font-bold">{cam.label}</div>
                <div className={`text-[9px] ${
                  cam.status === 'connected' ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {cam.status === 'connected' ? '✓ Verbunden' : '○ Wartet'}
                </div>
              </div>
            </div>
          ))}
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

        {/* FUNK TAB */}
        <TabsContent value="funk" className="flex-1 overflow-hidden flex flex-col p-0">
          <FunkPanel sessionId={session.id} onClose={() => setActiveTab('cameras')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}