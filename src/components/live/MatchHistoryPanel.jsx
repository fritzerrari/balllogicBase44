/**
 * MatchHistoryPanel — Letzte 5 Spiele gegen Gegner
 * Trendvergleich: Ballbesitz, Tore, Chancen
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function MatchHistoryPanel({ session }) {
  const opponentName = session?.match_title?.split(' vs ')?.pop() || 'Gegner';

  // Lade letzten 10 Matches
  const { data: recentMatches = [] } = useQuery({
    queryKey: ['recent-matches', session?.id],
    queryFn: async () => {
      const clubMatches = await base44.entities.ClubMatch.list('-date', 20);
      // Filter nur Matches gegen diesen Gegner
      return clubMatches.filter(m =>
        (m.away_team?.includes(opponentName) || m.home_team?.includes(opponentName))
      ).slice(0, 5);
    },
    enabled: !!session?.id,
  });

  // Lade Berichte der letzten Matches
  const { data: reports = [] } = useQuery({
    queryKey: ['match-reports', recentMatches.map(m => m.id).join(',')],
    queryFn: async () => {
      if (recentMatches.length === 0) return [];
      const allReports = await base44.entities.TeamAnalysis.list('-generated_at', 50);
      return allReports.filter(r => recentMatches.some(m => r.match_id === m.id)).slice(0, 5);
    },
    enabled: recentMatches.length > 0,
  });

  // Kalkuliere Trends
  const calcTrend = (key) => {
    if (reports.length === 0) return null;
    const values = reports.map(r => r.raw_metrics?.[key] || 0).filter(v => v > 0);
    if (values.length < 2) return null;
    const avg = values.reduce((a, b) => a + b) / values.length;
    const trend = values[values.length - 1] - values[0];
    return { avg: avg.toFixed(1), trend: trend > 0 ? '↑' : trend < 0 ? '↓' : '→' };
  };

  const ballPossessionTrend = calcTrend('possession_avg');
  const goalsTrend = calcTrend('goals_scored');
  const chancesTrend = calcTrend('chances_created');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 border border-border space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-muted-foreground uppercase">
            vs {opponentName} — Letzte 5 Spiele
          </span>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {recentMatches.length} Matches
        </Badge>
      </div>

      {recentMatches.length === 0 ? (
        <div className="text-center text-[10px] text-muted-foreground py-4">
          Keine vorherigen Matches gegen diesen Gegner
        </div>
      ) : (
        <>
          {/* Trend Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg p-2 text-center text-[10px] ${
              ballPossessionTrend?.avg > 50 ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
            }`}>
              <div className="font-bold text-sm">{ballPossessionTrend?.avg || '-'}%</div>
              <div className="text-[9px]">Ø Ballbesitz</div>
              <div className="text-[11px] font-bold">{ballPossessionTrend?.trend}</div>
            </div>

            <div className="rounded-lg p-2 text-center text-[10px] bg-blue-500/10 text-blue-400">
              <div className="font-bold text-sm">{goalsTrend?.avg || '-'}</div>
              <div className="text-[9px]">Ø Tore</div>
              <div className="text-[11px] font-bold">{goalsTrend?.trend}</div>
            </div>

            <div className="rounded-lg p-2 text-center text-[10px] bg-purple-500/10 text-purple-400">
              <div className="font-bold text-sm">{chancesTrend?.avg || '-'}</div>
              <div className="text-[9px]">Ø Chancen</div>
              <div className="text-[11px] font-bold">{chancesTrend?.trend}</div>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {recentMatches.map((match, idx) => (
              <div key={match.id} className="flex items-center justify-between text-[10px] py-1.5 border-b border-border/30 last:border-0">
                <div className="flex-1">
                  <div className="font-bold text-foreground">
                    {match.is_home ? '🏠' : '✈️'} {match.date ? new Date(match.date).toLocaleDateString('de') : 'N/A'}
                  </div>
                  <div className="text-muted-foreground">
                    {match.home_team} {match.home_score} — {match.away_score} {match.away_team}
                  </div>
                </div>
                <Badge
                  className={`text-[9px] px-1.5 py-0.5 ${
                    match.home_score > match.away_score
                      ? 'bg-green-500/20 text-green-400'
                      : match.home_score < match.away_score
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {match.home_score > match.away_score ? 'W' : match.home_score < match.away_score ? 'L' : 'D'}
                </Badge>
              </div>
            ))}
          </div>

          {/* Insights */}
          <div className="bg-muted/40 rounded-lg p-2 text-[9px] text-muted-foreground space-y-1">
            <div>📊 <strong>Trend:</strong> {goalsTrend?.trend === '↑' ? 'Gegner wird offensiver' : 'Defensive Stabilität'}</div>
            <div>🎯 <strong>Schwachstelle:</strong> {ballPossessionTrend?.avg < 40 ? 'Gegner unterlegen im Ballbesitz' : 'Gegner dominiert Ballbesitz'}</div>
          </div>
        </>
      )}
    </motion.div>
  );
}