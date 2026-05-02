import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * AutoEventLog — Zeigt auto-erkannte Events mit Approval-Buttons
 * 
 * Props:
 *   - events: AutoEvent[]
 *   - onApprove: (eventId) => void
 *   - onReject: (eventId) => void
 */
export default function AutoEventLog({ events = [], onApprove, onReject }) {
  const typeEmojis = {
    ball_in_penalty_area: '🎯',
    ball_in_goal_area: '⚽',
    player_offside: '🚩',
    high_speed_transition: '⚡',
    ball_lost: '❌',
    possession_change: '🔄',
    dangerous_situation: '⚠️',
  };

  const typeLabels = {
    ball_in_penalty_area: 'Ball im Strafraum',
    ball_in_goal_area: 'Ball im Tor-Bereich',
    player_offside: 'Abseits?',
    high_speed_transition: 'Schneller Konter',
    ball_lost: 'Ballverlust',
    possession_change: 'Ballwechsel',
    dangerous_situation: 'Gefährliche Situation',
  };

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {events.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground">
          Keine automatischen Events erkannt
        </div>
      ) : (
        <AnimatePresence>
          {events.map((evt, i) => (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-border/50"
            >
              {/* Icon */}
              <div className="flex-shrink-0 text-lg">
                {typeEmojis[evt.type] || '📍'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground text-xs">
                  {typeLabels[evt.type] || evt.type}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {evt.description}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className="text-[9px]"
                  >
                    {evt.minute}' · {evt.team === 'home' ? '🏠' : evt.team === 'away' ? '✈️' : '⚪'}
                  </Badge>
                  <Badge
                    className={`text-[9px] ${
                      evt.confidence >= 80
                        ? 'bg-green-500/20 text-green-400'
                        : evt.confidence >= 60
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {evt.confidence}% Konfidenz
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!evt.approved_by_trainer && !evt.rejected ? (
                  <>
                    <button
                      onClick={() => onApprove?.(evt.id)}
                      className="p-1 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-all"
                      title="Bestätigen"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onReject?.(evt.id)}
                      className="p-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all"
                      title="Ablehnen"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : evt.approved_by_trainer ? (
                  <Badge className="bg-green-500/20 text-green-400 text-[9px]">
                    ✓ Bestätigt
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 text-[9px]">
                    ✗ Abgelehnt
                  </Badge>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}