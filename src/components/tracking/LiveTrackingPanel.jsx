/**
 * LiveTrackingPanel – Echtzeit Tracking-Dashboard für Trainer während Session
 * Zeigt Heatmaps + AutoEventLog mit Approval-Buttons
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Zap } from 'lucide-react';
import HeatmapVisualization from './HeatmapVisualization';
import AutoEventLog from './AutoEventLog';
import LiveKPIDashboard from './LiveKPIDashboard';
import PlayerStatsPanel from './PlayerStatsPanel';

export default function LiveTrackingPanel({ sessionId }) {
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState('home');
  const [heatmapType, setHeatmapType] = useState('player_density');

  // Auto-Events laden (Poll alle 15s um Cloudflare Challenge zu vermeiden)
  const { data: autoEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['auto-events', sessionId],
    queryFn: () => base44.entities.AutoEvent.filter({ session_id: sessionId }),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  // TrackingData laden für Stats
  const { data: allTracking = [] } = useQuery({
    queryKey: ['tracking-data', sessionId],
    queryFn: () => base44.entities.TrackingData.filter({ session_id: sessionId }),
    refetchInterval: 20000,
    staleTime: 15000,
  });

  // Heatmap-Cache laden
  const { data: heatmapCache, isLoading: heatmapLoading } = useQuery({
    queryKey: ['heatmap', sessionId, selectedTeam, heatmapType],
    queryFn: async () => {
      const caches = await base44.entities.HeatmapCache.filter({
        session_id: sessionId,
        team: selectedTeam,
        heatmap_type: heatmapType,
      });
      return caches[0] || null;
    },
    refetchInterval: 20000,
    staleTime: 15000,
  });

  // Approval Mutations
  const approveEvent = useMutation({
    mutationFn: (eventId) =>
      base44.entities.AutoEvent.update(eventId, { approved_by_trainer: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auto-events', sessionId] }),
  });

  const rejectEvent = useMutation({
    mutationFn: (eventId) =>
      base44.entities.AutoEvent.update(eventId, { rejected: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auto-events', sessionId] }),
  });

  const pendingEvents = autoEvents.filter(e => !e.approved_by_trainer && !e.rejected);

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border">
      <div className="flex items-center justify-between">
        <h3 className="font-grotesk font-bold text-foreground">🤖 Live-Tracking</h3>
        {(eventsLoading || heatmapLoading) && (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}
      </div>

      {/* KPIs */}
      <LiveKPIDashboard sessionId={sessionId} />

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-background">
          <TabsTrigger value="events">
            Events {pendingEvents.length > 0 && <span className="ml-1 text-xs font-bold text-destructive">{pendingEvents.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        {/* Events Tab */}
        <TabsContent value="events" className="mt-3">
          <AutoEventLog
            events={autoEvents}
            onApprove={(id) => approveEvent.mutate(id)}
            onReject={(id) => rejectEvent.mutate(id)}
          />
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="mt-3">
          {allTracking.length > 0 ? (
            <PlayerStatsPanel sessionId={sessionId} />
          ) : (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Warte auf Tracking-Daten...
            </div>
          )}
        </TabsContent>

        {/* Heatmap Tab */}
        <TabsContent value="heatmap" className="mt-3 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTeam('home')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedTeam === 'home'
                  ? 'bg-primary/20 border border-primary/40 text-primary'
                  : 'bg-muted border border-border text-muted-foreground'
              }`}
            >
              🏠 Heim
            </button>
            <button
              onClick={() => setSelectedTeam('away')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedTeam === 'away'
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                  : 'bg-muted border border-border text-muted-foreground'
              }`}
            >
              ✈️ Gäste
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'player_density', label: 'Spieler-Dichte' },
              { key: 'ball_possession', label: 'Ball-Bereich' },
              { key: 'offensive_actions', label: 'Offensive' },
              { key: 'defensive_actions', label: 'Defensive' },
            ].map(type => (
              <button
                key={type.key}
                onClick={() => setHeatmapType(type.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  heatmapType === type.key
                    ? 'bg-primary/20 border border-primary/40 text-primary'
                    : 'bg-muted border border-border text-muted-foreground'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {heatmapCache ? (
            <HeatmapVisualization
              gridData={heatmapCache.grid_data}
              title={`${selectedTeam === 'home' ? '🏠' : '✈️'} – ${heatmapCache.heatmap_type}`}
              loading={heatmapLoading}
            />
          ) : (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Heatmap wird generiert...
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}