/**
 * GenerateReportButton — Button zum manuellen Generieren von Berichten
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const REPORT_TYPES = [
  { key: 'post_session', label: 'Spielbericht generieren', desc: 'Ereignisse der Session zusammenfassen' },
  { key: 'matchday', label: 'Spieltagsbericht', desc: 'Tagesübersicht aller Spiele' },
  { key: 'pre_match', label: 'Vorbericht erstellen', desc: 'Taktische Vorbereitung für nächstes Spiel' },
];

export default function GenerateReportButton({ session, match, events = [] }) {
  const [loading, setLoading] = useState(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generate = async (type) => {
    setLoading(type);
    setOpen(false);

    const goals = events.filter(e => e.type === 'goal');
    const cards = events.filter(e => e.type === 'yellow_card' || e.type === 'red_card');
    const subs = events.filter(e => e.type === 'substitution');
    const keyEvents = events.filter(e => ['goal', 'chance', 'yellow_card', 'red_card', 'substitution'].includes(e.type));

    const eventText = keyEvents.map(e =>
      `${e.minute || 0}' - ${e.type}: ${e.description || ''} (${e.team === 'home' ? 'Heim' : 'Gäste'})`
    ).join('\n') || 'Keine Ereignisse aufgezeichnet.';

    let prompt = '';
    if (type === 'post_session') {
      prompt = `Du bist Fußball-Trainer-Assistent. Erstelle einen präzisen Spielbericht auf Deutsch.
Spiel: ${session?.match_title || match?.title || 'Unbekanntes Spiel'}
Ereignisse:
${eventText}

Tore: ${goals.length}, Karten: ${cards.length}, Wechsel: ${subs.length}

Schreibe einen strukturierten Spielbericht (max. 200 Wörter) mit: Spielverlauf, wichtigste Momente, taktische Beobachtungen.`;
    } else if (type === 'matchday') {
      prompt = `Erstelle einen Spieltagsbericht auf Deutsch für:
Spiel: ${session?.match_title || match?.title || 'Unbekanntes Spiel'}
Ereignisse: ${eventText}

Format: Kurze Zusammenfassung des Spieltags, Ergebnisse, Highlights, Teamleistung (max. 150 Wörter).`;
    } else if (type === 'pre_match') {
      prompt = `Erstelle einen taktischen Vorbericht auf Deutsch für das nächste Spiel.
Letztes Spiel: ${session?.match_title || match?.title || 'Unbekanntes Spiel'}
Letzte Ereignisse: ${eventText}

Format: Taktische Schwerpunkte, Trainingsempfehlungen, Aufstellungshinweise, Stärken/Schwächen (max. 200 Wörter).`;
    }

    const summary = await base44.integrations.Core.InvokeLLM({ prompt });

    await base44.entities.SessionReport.create({
      session_id: session?.id || '',
      match_id: match?.id || '',
      match_title: session?.match_title || match?.title || 'Unbekanntes Spiel',
      report_type: type,
      generated_at: new Date().toISOString(),
      summary,
      goals,
      cards,
      substitutions: subs,
      key_events: keyEvents,
      event_count: events.length,
    });

    queryClient.invalidateQueries({ queryKey: ['session-reports'] });
    toast({ title: '✓ Bericht erstellt', description: 'Im Dashboard unter Berichte sichtbar.' });
    setLoading(null);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <Button
          onClick={() => generate('post_session')}
          disabled={!!loading}
          size="sm"
          className="bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 gap-1.5 text-xs h-8"
        >
          {loading === 'post_session'
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <FileText className="w-3.5 h-3.5" />}
          Bericht
        </Button>
        <button
          onClick={() => setOpen(s => !s)}
          className="h-8 px-2 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-all"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute top-full right-0 mt-1 glass rounded-xl p-1.5 z-50 min-w-[220px] shadow-xl border border-border">
          {REPORT_TYPES.map(rt => (
            <button key={rt.key} onClick={() => generate(rt.key)}
              disabled={!!loading}
              className="w-full text-left px-3 py-2.5 rounded-lg transition-all hover:bg-primary/10 disabled:opacity-50">
              <div className="text-sm font-medium text-foreground">{rt.label}</div>
              <div className="text-[10px] text-muted-foreground">{rt.desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}