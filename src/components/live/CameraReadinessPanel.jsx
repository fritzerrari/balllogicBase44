/**
 * CameraReadinessPanel — Zeigt Verbindungs-Status aller Kameras
 * Blockiert Tracking-Start bis mind. 1 Kamera verbunden ist
 */
import { motion } from 'framer-motion';
import { Radio, Camera, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function CameraReadinessPanel({ cameras, readyToTrack, onStartTracking, disabled = false }) {
  const connectedCount = cameras.filter(c => c.status === 'connected').length;
  const totalCount = cameras.length;
  const allConnected = connectedCount === totalCount && totalCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 border border-primary/20"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <span className="font-grotesk font-bold text-foreground">Kamera-Bereitschaft</span>
        </div>
        <Badge variant={allConnected ? 'default' : 'outline'} className="text-xs">
          {connectedCount}/{totalCount} verbunden
        </Badge>
      </div>

      {/* Camera List */}
      <div className="space-y-2 mb-4">
        {cameras.map((cam) => (
          <div
            key={cam.camera_id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/50"
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              cam.status === 'connected'
                ? 'bg-primary animate-pulse'
                : 'bg-yellow-400'
            }`} />
            <span className="text-xs font-medium text-foreground flex-1">{cam.label}</span>
            <span className={`text-[10px] font-mono ${
              cam.status === 'connected'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}>
              {cam.status === 'connected' ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Aktiv
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Wartet
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Status Message */}
      <div className={`text-xs p-2.5 rounded-lg border mb-3 ${
        allConnected
          ? 'bg-primary/10 border-primary/30 text-primary'
          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      }`}>
        {allConnected ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            ✓ Alle Kameras verbunden — Tracking kann gestartet werden
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Warte auf Kameras... Kameramann muss den Link öffnen
          </div>
        )}
      </div>

      {/* Start Button */}
      <Button
        onClick={onStartTracking}
        disabled={!readyToTrack || disabled || connectedCount === 0}
        className="w-full bg-primary text-primary-foreground gap-2"
      >
        <span>▶️ Tracking starten</span>
        {connectedCount > 0 && <span className="text-xs">({connectedCount} Kamera{connectedCount !== 1 ? 's' : ''})</span>}
      </Button>
    </motion.div>
  );
}