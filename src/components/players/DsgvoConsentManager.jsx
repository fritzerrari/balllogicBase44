/**
 * DsgvoConsentManager — DSGVO-Einwilligungsverwaltung für Spieler-Tracking
 * 
 * Logik:
 * - Spieler >= 18: Einwilligung durch den Spieler selbst
 * - Spieler < 18: guardian_required → Erziehungsberechtigte müssen zustimmen
 * - Ohne Einwilligung: tracking_anonymize=true → Spieler wird als "Anon #X" behandelt
 *   Das ist DSGVO-konform da keine personenbezogenen Daten mehr verarbeitet werden.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, ShieldX, AlertTriangle, UserX, Check, X, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

const CONSENT_CONFIG = {
  granted:           { icon: ShieldCheck, label: 'Einwilligung erteilt',    color: 'text-primary',     bg: 'bg-primary/10 border-primary/30' },
  denied:            { icon: ShieldX,     label: 'Abgelehnt (Anonymisiert)', color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30' },
  pending:           { icon: Shield,      label: 'Ausstehend',               color: 'text-muted-foreground', bg: 'bg-muted border-border' },
  guardian_required: { icon: AlertTriangle, label: 'Erziehungsber. nötig',  color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/30' },
};

export default function DsgvoConsentManager({ players = [], onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [guardianEmail, setGuardianEmail] = useState({});

  const updateConsent = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Player.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
  });

  const grantConsent = (player) => {
    updateConsent.mutate({
      id: player.id,
      data: {
        tracking_consent: 'granted',
        tracking_consent_date: new Date().toISOString().split('T')[0],
        tracking_anonymize: false,
      },
    });
  };

  const denyConsent = (player) => {
    // DSGVO-konform: Tracking wird anonymisiert, kein Personenbezug mehr
    updateConsent.mutate({
      id: player.id,
      data: {
        tracking_consent: 'denied',
        tracking_anonymize: true,
      },
    });
  };

  const setGuardianRequired = (player) => {
    updateConsent.mutate({
      id: player.id,
      data: {
        tracking_consent: 'guardian_required',
        tracking_anonymize: true, // Solange keine Einwilligung: anonymisieren
      },
    });
  };

  const sendGuardianRequest = async (player) => {
    const email = guardianEmail[player.id];
    if (!email) return;
    await base44.integrations.Core.SendEmail({
      to: email,
      subject: `TactIQ: Einwilligung für Videoanalyse – ${player.name}`,
      body: `Sehr geehrte Erziehungsberechtigte,\n\nIhr Kind ${player.name} nimmt am Trainings- und Spielbetrieb teil, der mit TactIQ (KI-gestützte Videoanalyse) ausgewertet wird.\n\nBitte teilen Sie dem Trainer mit, ob Sie der Verwendung von Videodaten von ${player.name} zustimmen.\n\nOhne Einwilligung werden alle Bilddaten von ${player.name} automatisch anonymisiert – es werden keine personenbezogenen Daten verarbeitet.\n\nBei Fragen wenden Sie sich an Ihren Trainer.\n\nMit freundlichen Grüßen,\nIhr TactIQ-Team`,
    });
    updateConsent.mutate({
      id: player.id,
      data: { guardian_email: email, tracking_consent: 'guardian_required', tracking_anonymize: true },
    });
    toast({ title: 'E-Mail gesendet', description: `Einwilligungsanfrage an ${email} versandt.` });
  };

  const isMinor = (player) => player.age && player.age < 18;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="glass rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-grotesk font-bold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> DSGVO Tracking-Einwilligungen
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Verwalte die Einwilligungen für KI-Videoanalyse (Roboflow)</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* DSGVO Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 text-xs text-blue-300 space-y-1">
          <div className="font-bold">ℹ️ DSGVO-Hinweis</div>
          <div>Spieler <strong>ohne Einwilligung</strong> werden automatisch <strong>anonymisiert</strong>: Ihr Bild wird an Roboflow gesendet, aber ohne Namens- oder Personenzuordnung — kein Personenbezug nach Art. 4 DSGVO.</div>
          <div>Bei Minderjährigen (&lt;18 Jahre) muss die Einwilligung von Erziehungsberechtigten eingeholt werden.</div>
        </div>

        <div className="space-y-2">
          {players.map(player => {
            const consent = player.tracking_consent || 'pending';
            const cfg = CONSENT_CONFIG[consent];
            const Icon = cfg.icon;
            const minor = isMinor(player);

            return (
              <div key={player.id} className={`rounded-xl p-3 border ${cfg.bg}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold text-sm flex-shrink-0 ${cfg.color}`}>
                      {player.tracking_anonymize ? <UserX className="w-4 h-4" /> : (player.number || player.name?.[0])}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        {player.name}
                        {minor && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-bold">U18</span>}
                        {player.tracking_anonymize && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">ANON</span>}
                      </div>
                      <div className={`text-[10px] flex items-center gap-1 ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                        {player.tracking_consent_date && <span className="text-muted-foreground">· {player.tracking_consent_date}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {consent !== 'granted' && !minor && (
                      <button onClick={() => grantConsent(player)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/25 transition-all">
                        <Check className="w-3 h-3" /> Einwilligung
                      </button>
                    )}
                    {minor && consent !== 'granted' && (
                      <button onClick={() => setGuardianRequired(player)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-medium hover:bg-orange-500/25 transition-all">
                        <AlertTriangle className="w-3 h-3" /> U18 markieren
                      </button>
                    )}
                    {consent !== 'denied' && (
                      <button onClick={() => denyConsent(player)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-medium hover:bg-yellow-500/20 transition-all">
                        <UserX className="w-3 h-3" /> Anonymisieren
                      </button>
                    )}
                  </div>
                </div>

                {/* Guardian E-Mail für Minderjährige */}
                {(consent === 'guardian_required' || (minor && consent === 'pending')) && (
                  <div className="mt-2 flex gap-2">
                    <Input
                      type="email"
                      placeholder="E-Mail Erziehungsberechtigte(r)"
                      value={guardianEmail[player.id] || player.guardian_email || ''}
                      onChange={e => setGuardianEmail(p => ({ ...p, [player.id]: e.target.value }))}
                      className="bg-muted border-border text-xs h-8 flex-1"
                    />
                    <button onClick={() => sendGuardianRequest(player)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/25 transition-all">
                      <Mail className="w-3 h-3" /> Anfrage senden
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {players.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Keine Spieler im Kader vorhanden.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}