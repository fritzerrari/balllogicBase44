/**
 * LiveStatsEnhanced — Real-time Match Statistics Dashboard
 * Possession, Tactical Lines, Player Counts + Quality Metrics
 */
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, AlertCircle } from 'lucide-react';
import usePossession from '@/hooks/usePossession';

export default function LiveStatsEnhanced({ 
  sessionId, 
  playerCounts = { home: 11, away: 11, referee: 1 },
  qualityScore = 0,
  pressureIntensity = { home: 0, away: 0 }
}) {
  const { possession, loading } = usePossession(sessionId);

  return (
    <div className="space-y-3">
      {/* Possession */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-4 border border-border"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold uppercase text-muted-foreground">Ballbesitz</div>
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
        
        <div className="flex items-center gap-2 mb-2">
          <div className="text-2xl font-grotesk font-bold text-primary">{possession.home}%</div>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
              style={{ width: `${possession.home}%` }}
            />
          </div>
          <div className="text-2xl font-grotesk font-bold text-red-400">{possession.away}%</div>
        </div>
        
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>🏠 Heim</span>
          <span>✈️ Gäste</span>
        </div>
      </motion.div>

      {/* Players */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-3 border border-border"
      >
        <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Spieler</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-primary/10 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-primary">{playerCounts.home}</div>
            <div className="text-[9px] text-muted-foreground">Heim</div>
          </div>
          <div className="bg-muted rounded-lg p-2 text-center">
            <div className="text-lg font-bold">{playerCounts.away}</div>
            <div className="text-[9px] text-muted-foreground">Gäste</div>
          </div>
          <div className="bg-yellow-500/10 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-yellow-400">{playerCounts.referee || 1}</div>
            <div className="text-[9px] text-muted-foreground">Schiri</div>
          </div>
        </div>
      </motion.div>

      {/* Quality Score */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl p-3 border border-border"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-bold uppercase text-muted-foreground">Detection Quality</div>
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                qualityScore >= 80 ? 'bg-green-500' :
                qualityScore >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${qualityScore}%` }}
            />
          </div>
          <div className="text-sm font-bold w-8 text-right">{qualityScore}%</div>
        </div>
        {qualityScore < 50 && (
          <div className="text-[10px] text-yellow-400 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Tracking-Qualität niedrig
          </div>
        )}
      </motion.div>

      {/* Pressure Intensity */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-xl p-3 border border-border"
      >
        <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Druck-Intensität</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 text-xs font-bold text-primary">🏠</div>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, pressureIntensity.home * 2)}%` }}
              />
            </div>
            <div className="w-6 text-xs text-right">{Math.round(pressureIntensity.home)}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 text-xs font-bold text-red-400">✈️</div>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${Math.min(100, pressureIntensity.away * 2)}%` }}
              />
            </div>
            <div className="w-6 text-xs text-right">{Math.round(pressureIntensity.away)}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}