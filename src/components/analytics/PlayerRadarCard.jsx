/**
 * PlayerRadarCard — Spieler-Kurzprofil mit Radar und KI-Score
 * Verwendbar für eigene und Gegner-Spieler
 */
import { Link } from 'react-router-dom';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { Shield, Unlock, Lock, ChevronRight, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const positionColors = {
  'Torwart': 'text-yellow-400',
  'Innenverteidiger': 'text-blue-400',
  'Außenverteidiger': 'text-blue-300',
  'Defensives Mittelfeld': 'text-green-400',
  'Zentrales Mittelfeld': 'text-primary',
  'Offensives Mittelfeld': 'text-orange-400',
  'Linksaußen': 'text-pink-400',
  'Rechtsaußen': 'text-pink-400',
  'Mittelstürmer': 'text-red-400',
};

export default function PlayerRadarCard({ player, stats, analysis, isOpponent = false, onUnlock, onClick }) {
  const avgRating = stats?.length > 0
    ? (stats.reduce((s, p) => s + (p.rating || 0), 0) / stats.length).toFixed(1)
    : null;

  const radarData = stats?.length > 0 ? [
    { metric: 'Note', value: ((avgRating / 10) * 100) },
    { metric: 'Zweikampf', value: Math.min(100, (stats.reduce((s,p) => s+(p.duels_won||0),0) / Math.max(1, stats.reduce((s,p) => s+(p.duels_total||1),0))) * 100) },
    { metric: 'Tore', value: Math.min(100, (stats.reduce((s,p) => s+(p.goals||0),0) / stats.length) * 50) },
    { metric: 'Assists', value: Math.min(100, (stats.reduce((s,p) => s+(p.assists||0),0) / stats.length) * 50) },
    { metric: 'km/Spiel', value: Math.min(100, (stats.reduce((s,p) => s+(p.distance_km||0),0) / stats.length / 12) * 100) },
  ] : [];

  const danger = player?.danger_rating ?? 0;
  const dangerColor = danger >= 8 ? 'text-red-400' : danger >= 6 ? 'text-orange-400' : 'text-yellow-400';

  const locked = isOpponent && !player?.unlocked;

  return (
    <div
      onClick={onClick}
      className="glass rounded-xl p-4 border border-border hover:border-primary/30 transition-all cursor-pointer group relative overflow-hidden"
    >
      {/* Locked overlay */}
      {locked && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-xl z-10 flex flex-col items-center justify-center gap-2">
          <Lock className="w-6 h-6 text-muted-foreground" />
          <div className="text-xs text-muted-foreground font-medium">Detailanalyse gesperrt</div>
          <button
            onClick={(e) => { e.stopPropagation(); onUnlock?.(player); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/25 transition-all"
          >
            <Unlock className="w-3 h-3" /> Freischalten
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-grotesk font-bold text-foreground text-sm truncate">{player.name}</div>
          <div className={`text-[10px] font-medium mt-0.5 ${positionColors[player.position] || 'text-muted-foreground'}`}>
            {player.position}
            {player.number && <span className="ml-1 text-muted-foreground">#{player.number}</span>}
          </div>
        </div>
        {isOpponent && danger > 0 && (
          <div className={`flex flex-col items-center ${dangerColor}`}>
            <Star className="w-4 h-4 fill-current" />
            <div className="text-[10px] font-bold">{danger}/10</div>
          </div>
        )}
        {!isOpponent && avgRating && (
          <div className="text-center">
            <div className="text-xl font-grotesk font-bold text-primary">{avgRating}</div>
            <div className="text-[9px] text-muted-foreground">Ø Note</div>
          </div>
        )}
      </div>

      {radarData.length > 0 && (
        <ResponsiveContainer width="100%" height={110}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 8 }} />
            <Radar dataKey="value" stroke={isOpponent ? '#ef4444' : 'hsl(var(--primary))'}
              fill={isOpponent ? '#ef4444' : 'hsl(var(--primary))'} fillOpacity={0.15} strokeWidth={1.5} />
          </RadarChart>
        </ResponsiveContainer>
      )}

      {(player.strengths || player.weaknesses) && !locked && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
          {player.strengths && <div className="text-[10px] text-primary"><span className="font-bold">+</span> {player.strengths.slice(0,60)}{player.strengths.length>60?'…':''}</div>}
          {player.weaknesses && <div className="text-[10px] text-destructive"><span className="font-bold">-</span> {player.weaknesses.slice(0,60)}{player.weaknesses.length>60?'…':''}</div>}
        </div>
      )}

      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
    </div>
  );
}