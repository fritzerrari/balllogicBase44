/**
 * KickoffDetectionPanel — Anstoß erfassen für präzise Teamerkennung
 * Trainer klickt "Anstoß jetzt" → Backend erfasst Spielerpositionen zur Kalibrierung
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Play, Zap, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function KickoffDetectionPanel({ session, onKickoffDetected }) {
  const [detecting, setDetecting] = useState(false);
  const [status, setStatus] = useState(null); // null | 'detecting' | 'success' | 'error'
  const [message, setMessage] = useState('');

  const handleKickoffDetection = async () => {
    if (!session?.id) {
      setStatus('error');
      setMessage('Keine aktive Session');
      return;
    }

    setDetecting(true);
    setStatus('detecting');
    setMessage('Erfasse Spielerpositionen...');

    try {
      // Backend-Funktion aufrufen, die beim nächsten Frame die Spieler erfasst
      await base44.functions.invoke('detectKickoffFormation', {
        session_id: session.id,
      });

      // Session aktualisieren — kickoff_detected = true
      await base44.entities.LiveSession.update(session.id, {
        kickoff_detected: true,
        kickoff_timestamp: new Date().toISOString(),
      });

      setStatus('success');
      setMessage('✓ Anstoß erkannt & Teams kalibriert');
      setDetecting(false);

      // Callback
      if (onKickoffDetected) {
        setTimeout(() => onKickoffDetected(), 2000);
      }
    } catch (error) {
      setStatus('error');
      setMessage(`Fehler: ${error.message}`);
      setDetecting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 border border-primary/20"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-grotesk font-bold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Anstoß-Kalibrierung
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Trainer klickt nach dem Anstoß → erfasst Spielerpositionen für präzise Teamerkennung
          </p>
        </div>
        {session?.kickoff_detected && (
          <Badge className="bg-primary/15 text-primary border-primary/30">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Kalibriert
          </Badge>
        )}
      </div>

      {/* Status Message */}
      {status && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-3 text-xs px-3 py-2 rounded-lg border ${
            status === 'detecting'
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              : status === 'success'
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2">
            {status === 'detecting' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {message}
          </div>
        </motion.div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleKickoffDetection}
        disabled={detecting || session?.kickoff_detected}
        className="w-full bg-primary text-primary-foreground gap-2"
      >
        {detecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Erfasse...
          </>
        ) : session?.kickoff_detected ? (
          <>
            <CheckCircle2 className="w-4 h-4" /> Teams kalibriert
          </>
        ) : (
          <>
            <Play className="w-4 h-4" /> Anstoß jetzt erfassen
          </>
        )}
      </Button>

      <div className="mt-3 text-[10px] text-muted-foreground space-y-1 bg-muted/40 rounded-lg p-2.5">
        <div className="flex gap-1">
          <span className="font-bold">Wie es funktioniert:</span>
        </div>
        <div>1️⃣ Klick nach dem Anstoß (wenn Teams auf Positionen stehen)</div>
        <div>2️⃣ Backend erfasst Spielerpositionen → erkennt Heim/Gäste-Seite</div>
        <div>3️⃣ Für Rest des Spiels: neue Spieler-IDs werden per Position zugeordnet</div>
      </div>
    </motion.div>
  );
}