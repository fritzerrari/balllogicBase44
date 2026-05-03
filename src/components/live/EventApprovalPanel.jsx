/**
 * EventApprovalPanel — Trainer Approval für Auto-Detected Events
 * Swipe: Approve / Reject / Ignore
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function EventApprovalPanel({ sessionId }) {
  const queryClient = useQueryClient();

  // Load pending auto-events
  const { data: pendingEvents = [], isLoading } = useQuery({
    queryKey: ['pending-events', sessionId],
    queryFn: () =>
      base44.entities.AutoEvent.filter({
        session_id: sessionId,
      }, '-timestamp_ms', 20),
    refetchInterval: 3000,
    staleTime: 1000,
  });

  const approveMutation = useMutation({
    mutationFn: (eventId) =>
      base44.entities.AutoEvent.update(eventId, { approved_by_trainer: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-events', sessionId] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (eventId) =>
      base44.entities.AutoEvent.update(eventId, { rejected: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-events', sessionId] }),
  });

  // Show only unreviewed events
  const unreviewed = pendingEvents.filter(e => !e.approved_by_trainer && !e.rejected);

  if (isLoading || unreviewed.length === 0) {
    return (
      <div className="glass rounded-xl p-4 border border-border text-center text-xs text-muted-foreground">
        {isLoading ? '⏳ Lade Events...' : '✓ Alle Events reviewed'}
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 border border-border space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <span>📋 {unreviewed.length} Events zur Genehmigung</span>
      </h3>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        <AnimatePresence>
          {unreviewed.map(event => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-muted/50 rounded-lg p-2.5 border border-border/50"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs">{getEventLabel(event.type)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Min {event.minute}' · {event.description?.slice(0, 40)}...
                  </div>
                </div>
                <Badge className="text-[9px] flex-shrink-0">
                  {event.confidence}%
                </Badge>
              </div>

              {/* Approve / Reject Buttons */}
              <div className="flex gap-1">
                <Button
                  onClick={() => approveMutation.mutate(event.id)}
                  disabled={approveMutation.isPending}
                  className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700 gap-1"
                >
                  <Check className="w-3 h-3" /> OK
                </Button>
                <Button
                  onClick={() => rejectMutation.mutate(event.id)}
                  disabled={rejectMutation.isPending}
                  variant="outline"
                  className="flex-1 h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <X className="w-3 h-3" /> Nein
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function getEventLabel(type) {
  const labels = {
    possession_change: '🔄 Ballbesitz-Wechsel',
    duel: '⚔️ Duell',
    ball_in_penalty_area: '🎯 Ball im Strafraum',
    ball_in_goal_area: '⚽ Ball im Tor',
    high_speed_transition: '⚡ Schneller Konter',
  };
  return labels[type] || type;
}