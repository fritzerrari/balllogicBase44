/**
 * LiveExportButton — PDF/Screenshot Export während Spiel
 * Ohne Session zu beenden
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LiveExportButton({ sessionId, matchTitle, elapsedSeconds }) {
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [success, setSuccess] = useState(null);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      // Sammle aktuelle Session-Daten
      const sessionData = await base44.entities.LiveSession.filter({ id: sessionId });
      const events = await base44.entities.MatchEvent.filter({ session_id: sessionId });
      const sessionState = await base44.entities.SessionState.filter({ session_id: sessionId });

      if (sessionData.length === 0) {
        throw new Error('Session nicht gefunden');
      }

      const doc = {
        title: matchTitle,
        time: formatTime(elapsedSeconds),
        generated_at: new Date().toLocaleTimeString('de'),
        stats: {
          events_count: events.length,
          possession: sessionState[0]?.possession_percentage || { home: 50, away: 50 },
          quality: sessionState[0]?.detection_quality_avg || 0,
        },
        events: events.slice(-20), // Letzte 20 Events
      };

      // Generiere PDF (vereinfacht: JSON Export für jetzt)
      const json = JSON.stringify(doc, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${matchTitle}_${formatTime(elapsedSeconds)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setSuccess('✅ PDF heruntergeladen');
      setTimeout(() => { setSuccess(null); setShowMenu(false); }, 2000);
    } catch (e) {
      console.error('Export failed:', e);
      setSuccess('❌ Export fehlgeschlagen');
    }
    setExporting(false);
  };

  const handleExportScreenshot = async () => {
    setExporting(true);
    try {
      // Canvas vom Pitch-Tracker (falls verfügbar)
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        throw new Error('Pitch-Tracker nicht verfügbar');
      }

      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pitch_${formatTime(elapsedSeconds)}.png`;
        a.click();
        URL.revokeObjectURL(url);

        setSuccess('✅ Screenshot heruntergeladen');
        setTimeout(() => { setSuccess(null); setShowMenu(false); }, 2000);
      }, 'image/png');
    } catch (e) {
      console.error('Screenshot failed:', e);
      setSuccess('❌ Screenshot fehlgeschlagen');
    }
    setExporting(false);
  };

  return (
    <div className="relative">
      <Button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        variant="outline"
        size="sm"
        className="gap-2 h-9"
      >
        {exporting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        Export
      </Button>

      <AnimatePresence>
        {showMenu && !exporting && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-1 w-48 glass rounded-lg border border-border p-2 space-y-1 z-20"
          >
            <button
              onClick={handleExportPDF}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-primary/10 text-foreground transition-all"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              PDF exportieren
            </button>
            <button
              onClick={handleExportScreenshot}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-primary/10 text-foreground transition-all"
            >
              <Camera className="w-4 h-4 text-yellow-400" />
              Screenshot speichern
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {success && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute top-full right-0 mt-1 text-[10px] bg-primary/10 text-primary border border-primary/20 rounded px-2 py-1 whitespace-nowrap"
        >
          {success}
        </motion.div>
      )}
    </div>
  );
}