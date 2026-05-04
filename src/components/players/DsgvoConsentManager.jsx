/**
 * DsgvoConsentManager — DSGVO-Einwilligungsverwaltung für Spieler-Tracking
 * Lädt alle Spieler selbst. Filtert nach Team/Mannschaft.
 * Einmalige globale Einwilligung wird direkt am Spieler gespeichert.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, ShieldX, AlertTriangle, UserX, Check, X, Mail, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

const CONSENT_CONFIG = {
  granted:           { icon: ShieldCheck,   label: 'Einwilligung erteilt',     color: 'text-primary',          bg: 'bg-primary/10 border-primary/30' },
  denied:            { icon: ShieldX,       label: 'Abgelehnt (Anonymisiert)', color: 'text-yellow-400',       bg: 'bg-yellow-500/10 border-yellow-500/30' },
  pending:           { icon: Shield,        label: 'Ausstehend',               color: 'text-muted-foreground', bg: 'bg-muted border-border' },
  guardian_required: { icon: AlertTriangle, label: 'Erziehungsber. nötig',     color: 'text-orange-400',       bg: 'bg-orange-500/10 border-orange-500/30' },
};

export default function DsgvoConsentManager({ players: playersProp, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [guardianEmail, setGuardianEmail] = useState({});
  const [selectedTeam, setSelectedTeam] = useState('all');

  // Lade alle Spieler selbst, falls keine übergeben wurden
  const { data: allPlayers = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('-created_date', 200),
    // Nutze prop-Daten wenn vorhanden, aber lade trotzdem für den Fall
  });

  const players = (playersProp && playersProp.length > 0) ? playersProp : allPlayers;

  // Alle einzigartigen Teams extrahieren
  const teams = ['all', ...Array.from(new Set(players.map(p => p.team).filter(Boolean)))];
  const filteredPlayers = selectedTeam === 'all'
    ? players
    : players.filter(p => p.team === selectedTeam);

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
    updateConsent.mutate({
      id: player.id,
      data: { tracking_consent: 'denied', tracking_anonymize: true },
    });
  };

  const setGuardianRequired = (player) => {
    updateConsent.mutate({
      id: player.id,
      data: { tracking_consent: 'guardian_required', tracking_anonymize: true },
    });
  };

  const grantAllPending = () => {
    filteredPlayers
      .filter(p => !p.age || p.age >= 18) // nur Erwachsene
      .filter(p => (p.tracking_consent || 'pending') === 'pending')
      .forEach(p => grantConsent(p));
    toast({ title: '✓ Alle ausstehenden Einwilligungen erteilt' });
  };

  const grantAll = () => {
    filteredPlayers
      .filter(p => !p.age || p.age >= 18) // nur Erwachsene
      .forEach(p => grantConsent(p));
    toast({ title: '✓ Allen Spielern Einwilligung erteilt' });
  };

  const sendGuardianRequest = async (player) => {
    const email = guardianEmail[player.id];
    if (!email) return;
    await base44.integrations.Core.SendEmail({
      to: email,
      subject: `TactIQ: Einwilligung für Videoanalyse – ${player.name}`,
      body: `Sehr geehrte Erziehungsberechtigte,\n\nIhr Kind ${player.name} nimmt am Trainings- und Spielbetrieb teil, der mit TactIQ (KI-gestützte Videoanalyse) ausgewertet wird.\n\nBitte teilen Sie dem Trainer mit, ob Sie der Verwendung von Videodaten von ${player.name} zustimmen.\n\nOhne Einwilligung werden alle Bilddaten von ${player.name} automatisch anonymisiert – es werden keine personenbezogenen Daten verarbeitet.\n\nMit freundlichen Grüßen,\nIhr TactIQ-Team`,
    });
    updateConsent.mutate({
      id: player.id,
      data: { guardian_email: email, tracking_consent: 'guardian_required', tracking_anonymize: true },
    });
    toast({ title: 'E-Mail gesendet', description: `Einwilligungsanfrage an ${email} versandt.` });
  };

  const isMinor = (player) => player.age && player.age < 18;
  const pendingCount = filteredPlayers.filter(p => (p.tracking_consent || 'pending') === 'pending').length;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="glass rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div>
            <h2 className="font-grotesk font-bold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> DSGVO Tracking-Einwilligungen
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {players.length} Spieler · {players.filter(p => p.tracking_consent === 'granted').length} erteilt · {pendingCount} ausstehend
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DSGVO Info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-3 text-xs text-blue-300 space-y-1 flex-shrink-0">
          <div className="font-bold">ℹ️ DSGVO-Hinweis</div>
          <div>Spieler <strong>ohne Einwilligung</strong> werden automatisch <strong>anonymisiert</strong> — kein Personenbezug nach Art. 4 DSGVO. Bei Minderjährigen (&lt;18 J.) muss die Einwilligung von Erziehungsberechtigten eingeholt werden.</div>
        </div>

        {/* Team-Filter */}
        {teams.length > 2 && (
          <div className="flex gap-1.5 flex-wrap mb-3 flex-shrink-0">
            {teams.map(t => (
              <button key={t} onClick={() => setSelectedTeam(t)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                  selectedTeam === t
                    ? 'bg-primary/20 border-primary/40 text-primary'
                    : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                }`}>
                <Users className="w-3 h-3" />
                {t === 'all' ? 'Alle Mannschaften' : t}
              </button>
            ))}
          </div>
        )}

        {/* Spieler-Liste */}
        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {filteredPlayers.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-10">
              {players.length === 0
                ? 'Keine Spieler vorhanden. Lege zuerst Spieler im Kader an.'
                : 'Keine Spieler in dieser Mannschaft.'}
            </div>
          ) : (
            filteredPlayers.map(player => {
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
                        <div className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
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
                          <Check className="w-3 h-3" /> Erteilen
                        </button>
                      )}
                      {minor && consent !== 'granted' && (
                        <button onClick={() => setGuardianRequired(player)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-medium hover:bg-orange-500/25 transition-all">
                          <AlertTriangle className="w-3 h-3" /> U18
                        </button>
                      )}
                      {minor && consent === 'granted' && (
                        <button onClick={() => grantConsent(player)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/25 transition-all">
                          <Check className="w-3 h-3" /> Bestätigt
                        </button>
                      )}
                      {consent !== 'denied' && (
                        <button onClick={() => denyConsent(player)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-medium hover:bg-yellow-500/20 transition-all">
                          <UserX className="w-3 h-3" /> Ablehnen
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
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/25 transition-all whitespace-nowrap">
                        <Mail className="w-3 h-3" /> Anfrage senden
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-border flex-shrink-0">
          <div className="flex gap-2">
            {filteredPlayers.some(p => !isMinor(p) && (p.tracking_consent || 'pending') === 'pending') && (
              <button onClick={grantAllPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/25 transition-all">
                <Check className="w-4 h-4" /> Ausstehende erteilen
              </button>
            )}
            {filteredPlayers.some(p => !isMinor(p) && p.tracking_consent !== 'granted') && (
              <button onClick={grantAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/25 border border-primary/50 text-primary text-sm font-medium hover:bg-primary/35 transition-all">
                <Check className="w-4 h-4" /> Allen erteilen
              </button>
            )}
          </div>
          <Button onClick={onClose} className="bg-primary text-primary-foreground px-8">
            {players.length === 0 ? 'Verstanden' : 'Schließen'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}