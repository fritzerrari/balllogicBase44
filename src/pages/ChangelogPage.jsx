/**
 * Changelog — Öffentliche Versionshistorie für alle Nutzer
 */
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookOpen, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const typeConfig = {
  added:    { label: '✦ Neu',        color: 'bg-primary/15 text-primary border-primary/30' },
  improved: { label: '↑ Verbessert', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  fixed:    { label: '✓ Behoben',    color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  removed:  { label: '✕ Entfernt',   color: 'bg-destructive/15 text-destructive border-destructive/30' },
};

// Statische Einträge als Fallback / initiale Anzeige
const STATIC_ENTRIES = [
  { version: '2.0.0', date: '2026-05-01', type: 'added', title: 'Kader & Performance-Tracking', description: 'Spieler-Profile mit individuellem KI-Feedback, Radar-Charts und Spiel-Statistiken über alle Partien hinweg.' },
  { version: '2.0.0', date: '2026-05-01', type: 'added', title: 'Admin-Dashboard', description: 'Zentrales Admin-Panel mit Nutzerverwaltung, globaler Match-Übersicht, Statistiken und Changelog-Editor.' },
  { version: '2.0.0', date: '2026-05-01', type: 'added', title: 'Demo-Modus & Onboarding-Banner', description: 'Neue Nutzer sehen einen Willkommens-Banner mit Feature-Übersicht beim ersten Login.' },
  { version: '1.5.0', date: '2026-04-15', type: 'added', title: 'Coaching Cockpit mit RF-DETR Tracking', description: 'Multi-Kamera-Dashboard mit Roboflow RF-DETR Live-Tracking, Team-Clustering, Trikotfarben-Erkennung.' },
  { version: '1.5.0', date: '2026-04-15', type: 'added', title: 'Automatische Event-Erkennung', description: 'Tor, Ecke, Foul, Konter werden automatisch durch regelbasierte Algorithmen auf Spielfeldbasis erkannt.' },
  { version: '1.4.0', date: '2026-04-01', type: 'added', title: 'KI-Halbzeit-Ansprache', description: '3–5 präzise Coaching-Punkte für die Kabine, generiert in unter 5 Sekunden.' },
  { version: '1.3.0', date: '2026-03-20', type: 'added', title: 'Multi-Kamera-System (/cam)', description: 'Kameramann öffnet /cam auf dem Handy, gibt 6-stelligen Code ein — verbindet sich mit aktiver Session.' },
  { version: '1.2.0', date: '2026-03-10', type: 'added', title: 'KI-Gegner-Scouting', description: 'KI erstellt detailliertes Stärken/Schwächen-Profil für jeden Gegner aus der Spielhistorie.' },
  { version: '1.1.0', date: '2026-03-01', type: 'added', title: 'KI-Co-Trainer Chat', description: 'Persönlicher KI-Assistent mit Zugriff auf Spielhistorie und Reports.' },
  { version: '1.0.0', date: '2026-02-15', type: 'added', title: 'TactIQ Launch', description: 'KI-Spielanalyse, Live-Sessions, Taktik-Dashboard, Trainingsplan-Generator.' },
];

export default function ChangelogPage() {
  const { data: dbEntries = [] } = useQuery({
    queryKey: ['changelogs'],
    queryFn: () => base44.entities.Changelog.list('-date', 50),
  });

  // Merge DB + Static, DB hat Vorrang
  const allEntries = dbEntries.length > 0
    ? dbEntries
    : STATIC_ENTRIES;

  // Group by version
  const grouped = allEntries.reduce((acc, entry) => {
    const key = entry.version;
    if (!acc[key]) acc[key] = { version: entry.version, date: entry.date, entries: [] };
    acc[key].entries.push(entry);
    return acc;
  }, {});

  const versions = Object.values(grouped).sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));

  return (
    <div className="p-6 lg:p-8 min-h-screen max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 uppercase tracking-widest">
          <BookOpen className="w-3 h-3" /> Versionshistorie
        </div>
        <h1 className="text-3xl font-grotesk font-bold text-foreground">Changelog</h1>
        <p className="text-muted-foreground mt-1 text-sm">Alle wichtigen Änderungen & neuen Features</p>
      </motion.div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border/50" />

        <div className="space-y-8 pl-12">
          {versions.map((group, gi) => (
            <motion.div key={group.version} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: gi * 0.07 }}>
              {/* Version dot */}
              <div className="absolute left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center -translate-x-1/2 mt-1">
                <Zap className="w-2.5 h-2.5 text-primary-foreground" />
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-grotesk font-bold text-lg text-foreground">v{group.version}</span>
                  {group.date && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(group.date), 'dd. MMMM yyyy', { locale: de })}
                    </span>
                  )}
                  {gi === 0 && <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Aktuell</Badge>}
                </div>
              </div>

              <div className="glass rounded-xl p-4 space-y-3">
                {group.entries.map((entry, i) => {
                  const cfg = typeConfig[entry.type] || typeConfig.added;
                  return (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                      <Badge className={`text-[10px] border flex-shrink-0 mt-0.5 ${cfg.color}`}>{cfg.label}</Badge>
                      <div>
                        <div className="text-sm font-medium text-foreground">{entry.title}</div>
                        {entry.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}