/**
 * LiveSessionStats — Show simple real-time stats during session
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function LiveSessionStats({ sessionId }) {
  const { data: tracking, isLoading } = useQuery({
    queryKey: ['live-session-stats', sessionId],
    queryFn: async () => {
      const data = await base44.entities.TrackingData.filter(
        { session_id: sessionId },
        '-timestamp_ms',
        1
      );
      return data[0] || null;
    },
    refetchInterval: 3000,
    staleTime: 1000,
  });

  if (isLoading || !tracking) {
    return (
      <div className="glass rounded-xl p-6 border border-border text-center">
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-primary" />
            <div className="text-xs text-muted-foreground">Warte auf Tracking-Daten...</div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">Keine Tracking-Daten vorhanden</div>
        )}
      </div>
    );
  }

  const playerCount = tracking.player_positions?.length || 0;
  const ballDetected = !!tracking.ball_position;
  const quality = tracking.detection_quality || 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass rounded-xl p-4 border border-border"
    >
      <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">📊 Live-Daten</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold">👥</div>
          <div className="text-sm font-bold mt-1">{playerCount}</div>
          <div className="text-[10px] text-muted-foreground">Spieler</div>
        </div>
        <div className={`rounded-lg p-3 text-center ${
          ballDetected ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-muted/50'
        }`}>
          <div className="text-xl font-bold">⚽</div>
          <div className="text-sm font-bold mt-1">{ballDetected ? '✓' : '○'}</div>
          <div className="text-[10px] text-muted-foreground">Ball</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold">📊</div>
          <div className="text-sm font-bold mt-1">{quality}%</div>
          <div className="text-[10px] text-muted-foreground">Qualität</div>
        </div>
      </div>
    </motion.div>
  );
}