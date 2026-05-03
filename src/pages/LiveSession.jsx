/**
 * LiveSession — SUPER SIMPLE 2-Phase: Setup → Live
 * Designed for non-tech users (coaches, players, cameramen)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Play, Square, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import SimpleSessionSetup from '@/components/live/SimpleSessionSetup';
import LiveSessionActive from '@/components/live/LiveSessionActive';
import DsgvoGatekeeper from '@/components/live/DsgvoGatekeeper';

export default function LiveSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState('setup'); // 'setup' | 'live'
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [finishing, setFinishing] = useState(false);

  const createSessionMutation = useMutation({
    mutationFn: async (data) => {
      // Create session
      const s = await base44.entities.LiveSession.create(data);
      
      // Auto-create SessionState für real-time Updates
      await base44.entities.SessionState.create({
        session_id: s.id,
        frame_count: 0,
        last_frame_number: 0,
        possession_percentage: { home: 50, away: 50, last_updated_frame: 0 },
        detection_quality_avg: 0,
        updated_at: new Date().toISOString(),
      }).catch(() => {});
      
      return s;
    },
    onError: (err) => {
      setError('❌ ' + err.message);
      setTimeout(() => setError(null), 4000);
    }
  });

  const handleStartSession = async (sessionData) => {
    try {
      const s = await createSessionMutation.mutateAsync(sessionData);
      setSession(s);
      setPhase('live');
      setError(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStopSession = async () => {
    if (!confirm('🛑 Session wirklich beenden?')) return;
    
    setFinishing(true);
    try {
      if (session) {
        await base44.entities.LiveSession.update(session.id, {
          status: 'ended',
          ended_at: new Date().toISOString()
        });
        // Trigger finalization
        await base44.functions.invoke('finalizeSession', { session_id: session.id }).catch(() => {});
      }
    } catch (err) {
      console.warn('Stop error:', err);
    }

    setFinishing(false);
    setPhase('setup');
    setSession(null);
    queryClient.invalidateQueries();
    
    setTimeout(() => {
      navigate('/');
    }, 500);
  };

  // SETUP PHASE
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="glass rounded-2xl p-8 space-y-6 border border-primary/20">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Radio className="w-8 h-8 text-red-500 animate-pulse" />
                <h1 className="text-3xl font-grotesk font-bold">Live-Session</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Starten Sie eine Live-Tracking-Session
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Setup Form */}
            <SimpleSessionSetup
              onStart={handleStartSession}
              isLoading={createSessionMutation.isPending}
            />

            {/* Info Box */}
            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg space-y-1">
              <div>✓ Geben Sie einfach den Match-Namen ein</div>
              <div>✓ Kameramänner erhalten direkten Link</div>
              <div>✓ Live-Tracking startet automatisch</div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // LIVE PHASE
  if (phase === 'live' && session) {
    return (
      <>
        <DsgvoGatekeeper sessionId={session.id} onReadyToStart={() => {}} />
        <LiveSessionActive
          session={session}
          onStop={handleStopSession}
          isFinishing={finishing}
        />
      </>
    );
  }

  return null;
}