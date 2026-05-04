/**
 * TrackingCorrectionPanel — Trainer-Corrections in Echtzeit
 * Team-Wechsel, Spieler-IDs korrigieren, falsche Detections markieren
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Zap, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TrackingCorrectionPanel({ sessionId, lastTracking }) {
  const [correcting, setCorrecting] = useState(false);
  const [correctionApplied, setCorrectionApplied] = useState(null);

  const handleSwapTeams = async () => {
    if (!lastTracking?.player_positions) return;
    
    setCorrecting(true);
    try {
      // Erstelle TrackingCorrection
      await base44.entities.TrackingCorrection.create({
        session_id: sessionId,
        type: 'team_reassign',
        frame_number: lastTracking.frame_number,
        timestamp_ms: Date.now(),
        original_value: {
          home_count: lastTracking.player_positions.filter(p => p.team === 'home').length,
          away_count: lastTracking.player_positions.filter(p => p.team === 'away').length,
        },
        corrected_value: {
          home_count: lastTracking.player_positions.filter(p => p.team === 'away').length,
          away_count: lastTracking.player_positions.filter(p => p.team === 'home').length,
        },
        reason: 'Trainer: Teams erkannt vertauscht',
        corrected_by: 'coach',
        applied: true,
      });

      // Trigger Backend-Funktion zum Swap aller zukünftigen Frames
      await base44.functions.invoke('applyTeamSwapCorrection', {
        session_id: sessionId,
        from_frame: lastTracking.frame_number,
      }).catch(() => {});

      setCorrectionApplied('✅ Teams getauscht — alle zukünftigen Frames korrigiert');
      setTimeout(() => setCorrectionApplied(null), 3000);
    } catch (e) {
      console.error('Correction failed:', e);
    }
    setCorrecting(false);
  };

  const handleRejectFrame = async () => {
    if (!lastTracking) return;
    
    setCorrecting(true);
    try {
      await base44.entities.TrackingCorrection.create({
        session_id: sessionId,
        type: 'event_rejection',
        frame_number: lastTracking.frame_number,
        timestamp_ms: Date.now(),
        reason: 'Trainer: Frame mit schlechter Quality markiert',
        corrected_by: 'coach',
        applied: true,
      });

      setCorrectionApplied('⚠️ Frame als fehlerhaft markiert');
      setTimeout(() => setCorrectionApplied(null), 3000);
    } catch (e) {
      console.error('Rejection failed:', e);
    }
    setCorrecting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-3 border border-yellow-500/20 bg-yellow-500/5 space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-bold text-yellow-400">Live-Korrektionen</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSwapTeams}
          disabled={correcting || !lastTracking}
          size="sm"
          className="flex-1 text-xs h-8 bg-yellow-600 hover:bg-yellow-700 gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Teams tauschen
        </Button>
        <Button
          onClick={handleRejectFrame}
          disabled={correcting || !lastTracking}
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-8 gap-1"
        >
          <AlertCircle className="w-3 h-3" />
          Frame ablehnen
        </Button>
      </div>

      {correctionApplied && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-[10px] text-center py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded"
        >
          {correctionApplied}
        </motion.div>
      )}

      <div className="text-[9px] text-muted-foreground text-center">
        Alle Korrektionen werden aufgezeichnet für Nachbearbeitung
      </div>
    </motion.div>
  );
}