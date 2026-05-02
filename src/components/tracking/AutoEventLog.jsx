/**
 * AutoEventLog — Auto-erkannte Events mit Approval/Reject Buttons
 */
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, AlertCircle } from 'lucide-react';

const EVENT_ICONS = {
  ball_in_penalty_area: '⚠️',
  ball_in_goal_area: '🎯',
  player_offside: '🚩',
  high_speed_transition: '⚡',
  ball_lost: '❌',
  possession_change: '🔄',
  dangerous_situation: '💥',
};

export default function AutoEventLog({ events, onApprove, onReject }) {
  const pending = events.filter(e => !e.approved_by_trainer && !e.rejected);
  const approved = events.filter(e => e.approved_by_trainer);
  const rejected = events.filter(e => e.rejected);

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-widest flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Ausstehend ({pending.length})
          </h4>
          <div className="space-y-1.5">
            <AnimatePresence>
              {pending.map((evt, idx) => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2.5 flex items-start gap-2.5"
                >
                  <span className="text-lg flex-shrink-0">{EVENT_ICONS[evt.type] || '•'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-yellow-400 capitalize">{evt.type.replace(/_/g, ' ')}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{evt.description}</div>
                    <div className="text-[9px] text-muted-foreground/70 mt-1">
                      {evt.minute}' · Confidence: {evt.confidence}%
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => onApprove(evt.id)}
                      className="w-6 h-6 rounded-lg bg-primary/20 border border-primary/30 text-primary hover:bg-primary/40 flex items-center justify-center text-xs transition-all"
                      title="Genehmigen"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => onReject(evt.id)}
                      className="w-6 h-6 rounded-lg bg-destructive/20 border border-destructive/30 text-destructive hover:bg-destructive/40 flex items-center justify-center text-xs transition-all"
                      title="Ablehnen"
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Genehmigt ({approved.length})
          </h4>
          <div className="space-y-1.5">
            <AnimatePresence>
              {approved.slice(0, 3).map(evt => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 text-xs"
                >
                  <div className="font-bold text-primary capitalize">{evt.type.replace(/_/g, ' ')}</div>
                  <div className="text-muted-foreground text-[9px] mt-1">{evt.minute}' · {evt.confidence}%</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {pending.length === 0 && approved.length === 0 && rejected.length === 0 && (
        <div className="text-center py-6 text-xs text-muted-foreground">
          Keine Auto-Events erkannt
        </div>
      )}
    </div>
  );
}