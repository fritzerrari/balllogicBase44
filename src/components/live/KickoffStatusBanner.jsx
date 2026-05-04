/**
 * KickoffStatusBanner — Kompakte Anzeige des Kalibrierungsstatus
 * Ersetzt das große KickoffDetectionPanel im Desktop-Layout
 * Zeigt nur Status + Link zur manuellen Kalibrierung
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Settings2 } from 'lucide-react';
import LateKickoffCalibration from '@/components/live/LateKickoffCalibration';

export default function KickoffStatusBanner({ session, kickoffDetected, onKickoffDetected }) {
  const [showCalib, setShowCalib] = useState(false);

  if (kickoffDetected) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/25">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
          <span className="text-xs text-yellow-300 font-medium">
            Teams nicht kalibriert — Anstoß oben klicken
          </span>
        </div>
        <button
          onClick={() => setShowCalib(v => !v)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
        >
          <Settings2 className="w-3 h-3" />
          Manuell
        </button>
      </div>

      <AnimatePresence>
        {showCalib && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <LateKickoffCalibration
              session={session}
              onCalibrated={() => { setShowCalib(false); onKickoffDetected?.(); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}