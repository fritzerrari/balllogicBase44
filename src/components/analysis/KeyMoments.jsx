import { motion } from 'framer-motion';
import { Zap, Target, Shield, ArrowRight, TrendingUp } from 'lucide-react';

const typeConfig = {
  goal: { label: 'Tor', icon: Target, color: 'text-primary bg-primary/15 border-primary/30' },
  chance: { label: 'Chance', icon: TrendingUp, color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' },
  transition: { label: 'Umschalten', icon: ArrowRight, color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
  pressing: { label: 'Pressing', icon: Zap, color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
  defensive: { label: 'Defensive', icon: Shield, color: 'text-purple-400 bg-purple-500/15 border-purple-500/30' },
};

export default function KeyMoments({ moments = [], homeTeam, awayTeam }) {
  if (moments.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-muted-foreground text-sm">Keine Schlüsselszenen erkannt</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {moments.map((moment, i) => {
        const cfg = typeConfig[moment.type?.toLowerCase()] || typeConfig.chance;
        const Icon = cfg.icon;
        const isHome = moment.team === homeTeam || moment.team === 'home';
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 flex items-start gap-4 hover:border-primary/20 transition-all"
          >
            <div className="flex-shrink-0 text-center">
              <div className="text-lg font-grotesk font-bold text-foreground">{moment.minute}'</div>
              <div className="text-[10px] text-muted-foreground">Min</div>
            </div>
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${cfg.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-bold border px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                <span className={`text-xs font-medium ${isHome ? 'text-primary' : 'text-red-400'}`}>
                  {moment.team}
                </span>
              </div>
              <p className="text-sm text-foreground/80">{moment.description}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}