/**
 * PlayerStatsPanel — Live-Spieler Performance Metriken
 * Zeigt: Distance, Sprints, Avg Speed, Max Speed pro Spieler
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Zap, Activity } from 'lucide-react';

export default function PlayerStatsPanel({ sessionId }) {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('distance'); // 'distance' | 'sprints' | 'speed'

  // Poll aggregatePlayerStats every 8s
  useEffect(() => {
    if (!sessionId) return;

    const fetchStats = async () => {
      try {
        const result = await base44.functions.invoke('aggregatePlayerStats', { session_id: sessionId });
        if (result?.data?.stats) {
          setStats(result.data.stats);
        }
      } catch (e) {
        console.warn('⚠️ Stats fetch failed:', e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 8000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const playerArray = Object.values(stats);

  // Sort
  const sorted = [...playerArray].sort((a, b) => {
    if (sortBy === 'distance') return (b.total_distance_km || 0) - (a.total_distance_km || 0);
    if (sortBy === 'sprints') return (b.sprint_count || 0) - (a.sprint_count || 0);
    if (sortBy === 'speed') return (b.max_speed_kmh || 0) - (a.max_speed_kmh || 0);
    return 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 text-primary animate-spin mr-2" />
        <span className="text-xs text-muted-foreground">Spieler-Stats werden geladen...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sort Buttons */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: 'distance', label: '🏃 Distanz' },
          { key: 'sprints', label: '⚡ Sprints' },
          { key: 'speed', label: '💨 Speed' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              sortBy === opt.key
                ? 'bg-primary/20 border border-primary/40 text-primary'
                : 'bg-muted border border-border text-muted-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Player List */}
      {sorted.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          Noch keine Spieler-Daten
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sorted.map((player, idx) => (
            <motion.div
              key={player.player_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`rounded-lg p-3 border flex items-center justify-between ${
                player.team === 'home'
                  ? 'bg-primary/5 border-primary/20'
                  : player.team === 'away'
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-muted/30 border-border'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    player.team === 'home'
                      ? 'bg-primary text-primary-foreground'
                      : player.team === 'away'
                        ? 'bg-red-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {player.number || '?'}
                  </span>
                  {player.player_id?.substring(0, 20) || `Player ${idx + 1}`}
                </div>
                <div className="text-xs text-muted-foreground mt-1 grid grid-cols-3 gap-2">
                  <span>📏 {(player.total_distance_km || 0).toFixed(2)} km</span>
                  <span>⚡ {player.sprint_count || 0} Sprints</span>
                  <span>💨 {(player.max_speed_kmh || 0).toFixed(1)} km/h</span>
                </div>
              </div>
              {/* Quick Indicator */}
              <div className="flex-shrink-0 ml-2 text-right">
                {sortBy === 'distance' && (
                  <div className="text-lg font-grotesk font-bold text-primary">
                    {(player.total_distance_km || 0).toFixed(1)}
                  </div>
                )}
                {sortBy === 'sprints' && (
                  <div className="text-lg font-grotesk font-bold text-yellow-400">
                    {player.sprint_count || 0}
                  </div>
                )}
                {sortBy === 'speed' && (
                  <div className="text-lg font-grotesk font-bold text-cyan-400">
                    {(player.max_speed_kmh || 0).toFixed(0)}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground">
                  {sortBy === 'distance' && 'km'}
                  {sortBy === 'sprints' && 'x'}
                  {sortBy === 'speed' && 'km/h'}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}