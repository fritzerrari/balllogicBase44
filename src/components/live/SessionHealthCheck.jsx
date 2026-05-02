/**
 * SessionHealthCheck — Warnt vor Datenproblemen
 * 
 * Prüft:
 * - Session hat Match-Verknüpfung
 * - Session hat Kameras
 * - Mindestens 1 Kamera connected
 * - Session ist aktiv
 */
import { AlertTriangle, CheckCircle2, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SessionHealthCheck({ session }) {
  if (!session || session.status !== 'active') return null;

  const checks = {
    hasMatch: !!session.match_id || !!session.match_title,
    hasCameras: session.camera_streams?.length > 0,
    hasConnectedCamera: session.camera_streams?.some(c => c.status === 'connected'),
    isActive: session.status === 'active',
  };

  const warnings = [];

  if (!checks.hasMatch) {
    warnings.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Keine Match-Verknüpfung',
      description: 'Events werden ohne Match-ID gespeichert. Reports können nicht analysieren.',
      color: 'yellow',
    });
  }

  if (!checks.hasCameras) {
    warnings.push({
      type: 'critical',
      icon: '🔴',
      title: 'Keine Kameras!',
      description: 'Session ohne Kamera wird blind aufgezeichnet.',
      color: 'red',
    });
  }

  if (checks.hasCameras && !checks.hasConnectedCamera) {
    warnings.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Keine Kamera verbunden',
      description: `${session.camera_streams.length} Kamera(s) warten auf Verbindung.`,
      color: 'yellow',
    });
  }

  if (warnings.length === 0 && checks.isActive) {
    return (
      <div className="glass rounded-xl p-3 border border-primary/20 flex items-center gap-2 text-xs text-primary">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        <span>✓ Session healthy — {session.camera_streams.length} Kamera(s) connected</span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="space-y-2">
        {warnings.map((w, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass rounded-xl p-3 border flex items-start gap-3 text-xs ${
              w.color === 'red'
                ? 'border-red-500/20 bg-red-500/5'
                : 'border-yellow-500/20 bg-yellow-500/5'
            }`}
          >
            <span className="text-lg flex-shrink-0">{w.icon}</span>
            <div>
              <div className={`font-bold ${w.color === 'red' ? 'text-red-400' : 'text-yellow-400'}`}>
                {w.title}
              </div>
              <div className="text-muted-foreground">{w.description}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  );
}