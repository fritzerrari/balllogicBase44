/**
 * PlayerStatsPanel – Individual Player Performance Metrics
 * 
 * Zeigt pro Spieler:
 * - Distance, Sprints, Touches
 * - Heatmap
 * - Rating
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PlayerStatsPanel({ sessionId }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('distance');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const result = await base44.functions.invoke('aggregatePlayerStats', { session_id: sessionId });
        if (result?.data?.player_stats) {
          setStats(result.data.player_stats);
        }
      } catch (err) {
        console.error('Stats fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Poll alle 10s
    return () => clearInterval(interval);
  }, [sessionId]);

  if (loading) {
    return (
      <div className="glass rounded-xl p-4 border border-border flex items-center justify-center min-h-32">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  const sorted = [...stats].sort((a, b) => {
    if (sortBy === 'distance') return (b.distance_km || 0) - (a.distance_km || 0);
    if (sortBy === 'sprints') return (b.sprints || 0) - (a.sprints || 0);
    if (sortBy === 'touches') return (b.touch_count || 0) - (a.touch_count || 0);
    return 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-grotesk font-bold text-foreground">👥 Spieler-Performance</h3>
        <div className="flex gap-1.5">
          {[
            { key: 'distance', label: 'km' },
            { key: 'sprints', label: 'Sprints' },
            { key: 'touches', label: 'Touches' },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => setSortBy(btn.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                sortBy === btn.key
                  ? 'bg-primary/15 border border-primary/30 text-primary'
                  : 'bg-muted border border-border text-muted-foreground'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {stats.length === 0 ? (
        <div className="glass rounded-xl p-6 text-center text-sm text-muted-foreground border border-border">
          Noch keine Spieler-Daten — Tracking läuft...
        </div>
      ) : (
        <div className="glass rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border/30">
            {sorted.map((player, i) => {
              const distanceBar = Math.min(100, ((player.distance_km || 0) / 12) * 100); // 12km = max
              const sprintBar = Math.min(100, ((player.sprints || 0) / 40) * 100); // 40 sprints = max
              return (
                <motion.div
                  key={player.player_id || i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground truncate">
                        {player.player_name || `Spieler ${player.player_id}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.floor(player.minutes_played || 0)}min · {player.touch_count || 0} Touches
                      </div>
                    </div>
                    <Badge className={player.distance_km > 10 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}>
                      {(player.distance_km || 0).toFixed(1)} km
                    </Badge>
                  </div>

                  {/* Distance Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">Distanz</span>
                      <span className="text-[10px] font-bold text-primary">{Math.round(distanceBar)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${distanceBar}%` }}
                      />
                    </div>
                  </div>

                  {/* Sprints Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">Sprints</span>
                      <span className="text-[10px] font-bold text-accent">{player.sprints || 0}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${sprintBar}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-2 text-[10px] mt-3 pt-2 border-t border-border/30">
                    <div className="text-center">
                      <div className="text-muted-foreground">Intensität</div>
                      <div className="font-bold text-foreground">{player.intensity_index || 0}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Ballkontakte</div>
                      <div className="font-bold text-foreground">{player.ball_touches || 0}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Erfolgsquote</div>
                      <div className="font-bold text-foreground">{player.success_rate || 0}%</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}