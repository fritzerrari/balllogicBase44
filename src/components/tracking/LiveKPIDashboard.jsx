/**
 * LiveKPIDashboard – Real-time KPIs für Trainer während Session
 * 
 * Zeigt:
 * - Possession %
 * - Formation
 * - Pass-Quality
 * - Pressings
 * - Live-Updates alle 5s
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, Target, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function LiveKPIDashboard({ sessionId }) {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setLoading(true);
        const [formRes, possRes] = await Promise.all([
          base44.functions.invoke('detectFormation', { session_id: sessionId }),
          base44.functions.invoke('assignBallPossession', { session_id: sessionId }),
        ]);

        setKpis({
          formations: formRes?.data?.formations || {},
          possession: possRes?.data?.stats || {},
        });
      } catch (err) {
        console.error('KPI fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchKpis();
    const interval = setInterval(fetchKpis, 5000); // Poll alle 5s
    return () => clearInterval(interval);
  }, [sessionId]);

  if (loading || !kpis) {
    return (
      <div className="glass rounded-xl p-4 border border-border flex items-center justify-center min-h-24">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  const { formations, possession } = kpis;
  const homeForm = formations.home;
  const awayForm = formations.away;
  const homePoss = possession.home_possession_pct || 0;
  const awayPoss = possession.away_possession_pct || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 border border-primary/20 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-grotesk font-bold text-foreground">📊 Live KPIs</h3>
        <span className="text-xs text-primary animate-pulse">● Live</span>
      </div>

      {/* Possession Gauge */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-primary">🏠 Heim</span>
          <span className="text-muted-foreground">{homePoss}% | {awayPoss}%</span>
          <span className="text-red-400">✈️ Gäste</span>
        </div>
        <div className="flex h-6 rounded-lg overflow-hidden bg-muted border border-border">
          <div
            className="bg-primary/80 transition-all"
            style={{ width: `${homePoss}%` }}
          />
          <div
            className="bg-red-500/80 transition-all"
            style={{ width: `${awayPoss}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground">
          {possession.possession_changes || 0} Ballverluste
        </div>
      </div>

      {/* Formations */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">🏠 Formation</div>
          <div className="font-grotesk font-bold text-primary text-lg">
            {homeForm?.formation || 'unknown'}
          </div>
          {homeForm?.confidence && (
            <div className="text-[10px] text-muted-foreground">
              {homeForm.confidence}% sicher
            </div>
          )}
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">✈️ Formation</div>
          <div className="font-grotesk font-bold text-red-400 text-lg">
            {awayForm?.formation || 'unknown'}
          </div>
          {awayForm?.confidence && (
            <div className="text-[10px] text-muted-foreground">
              {awayForm.confidence}% sicher
            </div>
          )}
        </div>
      </div>

      {/* Formation Details */}
      {homeForm && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs space-y-1">
          <div className="font-bold text-foreground mb-2">Heim Struktur</div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>🛡️ Abwehr</span>
            <span className="font-bold text-primary">{homeForm.defenders}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>🔄 Mittelfeld</span>
            <span className="font-bold text-primary">{homeForm.midfielders}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>⚽ Angriff</span>
            <span className="font-bold text-primary">{homeForm.forwards}</span>
          </div>
        </div>
      )}

      {/* Possession Changes Warning */}
      {possession.possession_changes > 20 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-xs text-yellow-400">
          ⚠️ Viele Ballverluste ({possession.possession_changes}) — Passgenauigkeit checken
        </div>
      )}
    </motion.div>
  );
}