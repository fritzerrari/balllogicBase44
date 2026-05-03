/**
 * DsgvoGatekeeper — Auto-trigger DSGVO Consent Manager
 * Prüft bei Session-Start: Gibt es U18-Spieler ohne Einwilligung?
 * Falls ja: Modal + Blockierung bis Einwilligung/Anonymisierung
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DsgvoConsentManager from '@/components/players/DsgvoConsentManager';

export default function DsgvoGatekeeper({ sessionId, onReadyToStart }) {
  const [minorPlayers, setMinorPlayers] = useState([]);
  const [showGate, setShowGate] = useState(false);
  const [allApproved, setAllApproved] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const checkMinors = async () => {
      try {
        const players = await base44.entities.Player.list();
        
        // Find minors (age < 18) without consent
        const minorList = players.filter(p => 
          (p.age || 99) < 18 && 
          p.tracking_consent !== 'granted'
        );

        setMinorPlayers(minorList);
        
        // Show modal only if there are minors
        if (minorList.length > 0) {
          setShowGate(true);
        } else {
          setAllApproved(true);
          onReadyToStart?.();
        }
      } catch (err) {
        console.warn('DSGVO check error:', err);
        // Fallback: allow session to start if check fails
        setAllApproved(true);
        onReadyToStart?.();
      }
    };

    checkMinors();
  }, [sessionId, onReadyToStart]);

  const handleAllApproved = () => {
    setAllApproved(true);
    setShowGate(false);
    onReadyToStart?.();
  };

  if (allApproved) {
    return null; // No gating needed
  }

  return (
    <AnimatePresence>
      {showGate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="glass rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
              <div>
                <h2 className="font-grotesk font-bold text-lg text-foreground">
                  ⚖️ DSGVO-Konformitäts-Check
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {minorPlayers.length} Minderj&auml;hrige Spieler ({minorPlayers.length > 0 ? minorPlayers.map(p => p.name).join(', ') : ''}) ohne Tracking-Einwilligung erkannt.
                </p>
              </div>
            </div>

            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4">
              <p className="text-xs text-destructive">
                ⚠️ Tracking darf nur mit Einwilligung oder nach Anonymisierung erfolgen (DSGVO Artikel 8).
                Bitte aktualisieren Sie die Einwilligung oder markieren Sie Spieler als anonym.
              </p>
            </div>

            {/* Consent Manager */}
            <div className="mb-4">
              <DsgvoConsentManager minorPlayersOnly={true} />
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-[10px] text-muted-foreground mb-3">
                ✓ Aktualisieren Sie den Status aller Minderj&auml;hrigen:
                <br />• <span className="text-green-400">Einwilligung erteilt</span> = Tracking erlaubt
                <br />• <span className="text-blue-400">Anonymisiert</span> = Tracking ohne Namen
                <br />• <span className="text-yellow-400">Abgelehnt</span> = Kein Tracking
              </p>
            </div>

            <Button
              onClick={handleAllApproved}
              className="w-full bg-primary mt-4"
            >
              <CheckCircle2 className="w-4 h-4" /> Alle Einwilligungen aktualisiert — Session starten
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}