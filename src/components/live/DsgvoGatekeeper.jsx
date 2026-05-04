/**
 * DsgvoGatekeeper — prüft einmalig bei Session-Start ob U18-Spieler ohne Einwilligung existieren.
 * Öffnet ggf. den DsgvoConsentManager als Modal.
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { AnimatePresence } from 'framer-motion';
import DsgvoConsentManager from '@/components/players/DsgvoConsentManager';

export default function DsgvoGatekeeper({ sessionId, onReadyToStart }) {
  const [showConsent, setShowConsent] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (!sessionId || checked.current) return;
    checked.current = true;

    base44.entities.Player.list('-created_date', 200)
      .then(players => {
        const hasUnresolvedMinors = players.some(p =>
          p.age && p.age < 18 && p.tracking_consent !== 'granted' && p.tracking_consent !== 'denied'
        );
        if (hasUnresolvedMinors) {
          setShowConsent(true);
        }
        // No gating — session starts regardless, consent is informational
      })
      .catch(() => {
        // Fehler ignorieren, Session läuft weiter
      });
  }, [sessionId]); // onReadyToStart bewusst nicht als Dependency

  return (
    <AnimatePresence>
      {showConsent && (
        <DsgvoConsentManager onClose={() => setShowConsent(false)} />
      )}
    </AnimatePresence>
  );
}