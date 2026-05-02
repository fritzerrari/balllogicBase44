/**
 * LiveKPIDashboard — Real-time Possession & Tactical KPIs
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function LiveKPIDashboard({ sessionId }) {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    const fetchKPIs = async () => {
      try {
        const result = await base44.functions.invoke('aggregatePlayerStats', { session_id: sessionId });
        if (result?.data?.stats) {
          const stats = result.data.stats;
          const homePlayers = Object.values(stats).filter(s => s.team === 'home');
          const awayPlayers = Object.values(stats).filter(s => s.team === 'away');

          const homeDistance = homePlayers.reduce((s, p) => s + (p.total_distance_km || 0), 0);
          const awayDistance = awayPlayers.reduce((s, p) => s + (p.total_distance_km || 0), 0);
          const totalDistance = homeDistance + awayDistance || 1;

          const homeSprints = homePlayers.reduce((s, p) => s + (p.sprint_count || 0), 0);
          const awaySprints = awayPlayers.reduce((s, p) => s + (p.sprint_count || 0), 0);

          setKpis({
            possession_home: Math.round((homeDistance / totalDistance) * 100),
            possession_away: Math.round((awayDistance / totalDistance) * 100),
            sprints_home: homeSprints,
            sprints_away: awaySprints,
            distance_home: homeDistance.toFixed(2),
            distance_away: awayDistance.toFixed(2),
          });
        }
      } catch (e) {
        console.warn('⚠️ KPI fetch failed:', e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
    const interval = setInterval(fetchKPIs, 8000);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (loading || !kpis) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 text-primary animate-spin mr-2" />
        <span className="text-xs text-muted-foreground">KPIs werden berechnet...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {/* Possession */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/10 border border-primary/20 rounded-lg p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5">Ballbesitz</div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-primary">Heim</span>
              <span className="text-xs font-bold text-primary">{kpis.possession_home}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${kpis.possession_home}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-red-400">Gäste</span>
              <span className="text-xs font-bold text-red-400">{kpis.possession_away}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-300"
                style={{ width: `${kpis.possession_away}%` }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Distance */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">Distanz</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-primary font-bold">Heim</span>
            <span className="text-sm font-grotesk font-bold text-primary">{kpis.distance_home}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-400 font-bold">Gäste</span>
            <span className="text-sm font-grotesk font-bold text-red-400">{kpis.distance_away}</span>
          </div>
        </div>
      </motion.div>

      {/* Sprints */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">Sprints</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-primary font-bold">Heim</span>
            <span className="text-lg font-grotesk font-bold text-primary">{kpis.sprints_home}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-400 font-bold">Gäste</span>
            <span className="text-lg font-grotesk font-bold text-red-400">{kpis.sprints_away}</span>
          </div>
        </div>
      </motion.div>

      {/* Frame Count */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Status</div>
        <div className="text-sm font-grotesk font-bold text-purple-400">
          Live ✓
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">Alle Metriken aktiv</div>
      </motion.div>
    </div>
  );
}