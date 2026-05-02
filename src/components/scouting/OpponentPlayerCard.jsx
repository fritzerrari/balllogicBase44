/**
 * OpponentPlayerCard – Einzelner Gegner-Spieler mit Unlock-Status
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Lock, Unlock, Star, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function OpponentPlayerCard({ player, onAnalyze }) {
  const [unlocking, setUnlocking] = useState(false);

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      await base44.entities.OpponentPlayer.update(player.id, { unlocked: true });
      window.location.reload();
    } catch (_) {
    } finally {
      setUnlocking(false);
    }
  };

  const positionEmoji = {
    'Torwart': '🥅',
    'Innenverteidiger': '🛡️',
    'Außenverteidiger': '🛡️',
    'Defensives Mittelfeld': '🚧',
    'Zentrales Mittelfeld': '⚙️',
    'Offensives Mittelfeld': '🎯',
    'Linksaußen': '🌪️',
    'Rechtsaußen': '🌪️',
    'Mittelstürmer': '⚽',
  };

  if (!player.unlocked) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-xl p-4 border border-border/50 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent blur-xl" />
        <div className="relative z-10 text-center py-6">
          <Lock className="w-8 h-8 text-primary mx-auto mb-2" />
          <div className="font-bold text-foreground mb-1">#{player.number}</div>
          <div className="text-xs text-muted-foreground mb-3">{player.position}</div>
          <button
            onClick={handleUnlock}
            disabled={unlocking}
            className="w-full py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/25 transition-all disabled:opacity-50"
          >
            {unlocking ? 'Wird entsperrt...' : '🔓 Analyse freischalten'}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-xl p-4 border border-primary/30 hover:border-primary/60 transition-all cursor-pointer"
      onClick={() => onAnalyze?.(player)}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-bold text-foreground flex items-center gap-1">
            <span className="text-lg">{positionEmoji[player.position] || '⚽'}</span>
            #{player.number}
          </div>
          <div className="text-sm text-foreground">{player.name}</div>
          <div className="text-xs text-muted-foreground">{player.position}</div>
        </div>
        <div className="text-right">
          <Badge className="bg-primary/15 text-primary text-xs">
            <Star className="w-3 h-3 mr-1 inline" />
            {player.danger_rating || 0}/10
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-border/30 text-[10px]">
        <div>
          <div className="text-muted-foreground">Alter</div>
          <div className="font-bold text-foreground">{player.age || '?'}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Fuß</div>
          <div className="font-bold text-foreground">{player.dominant_foot === 'links' ? '🦶L' : player.dominant_foot === 'rechts' ? 'R🦶' : '🦶'}</div>
        </div>
      </div>

      {/* Strengths */}
      {player.strengths && (
        <div className="mt-2 pt-2 border-t border-border/30">
          <div className="text-[10px] text-muted-foreground mb-1">Stärken</div>
          <div className="text-xs text-foreground line-clamp-2">{player.strengths}</div>
        </div>
      )}

      {/* Weaknesses */}
      {player.weaknesses && (
        <div className="mt-2">
          <div className="text-[10px] text-muted-foreground mb-1">Schwächen</div>
          <div className="text-xs text-foreground line-clamp-2">{player.weaknesses}</div>
        </div>
      )}

      {/* Click hint */}
      <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-center text-[10px] text-primary">
        <TrendingUp className="w-3 h-3 mr-1" /> Klick für Details
      </div>
    </motion.div>
  );
}