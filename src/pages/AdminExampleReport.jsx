import { motion } from 'framer-motion';
import { FileText, CheckCircle2, TrendingUp, BarChart3, Calendar, Clock, Users, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const EXAMPLE_REPORT = {
  id: 'report-001',
  session_id: 'sess-12345',
  match_id: 'match-789',
  match_title: 'FC Bayern München vs Borussia Dortmund',
  report_type: 'post_session',
  generated_at: '2026-05-02T18:45:00Z',
  summary: `Spannendes Spiel zwischen Bayern und Dortmund. Bayern dominierte die erste Halbzeit mit hohem Druck und schnellen Kombinationen. Dortmund kam in der zweiten Halbzeit besser ins Spiel und erzielte den Ausgleich. Insgesamt 12 Events registriert: 2 Tore, 1 Gelbe Karte, 3 Ecken, 2 Fouls.`,
  event_count: 12,
  goals: [
    { minute: 12, team: 'home', player: 'Müller', description: 'Tor nach Flanke von Kimmich' },
    { minute: 67, team: 'away', player: 'Haaland', description: 'Konter-Tor nach Ballverlust Bayern' },
  ],
  cards: [
    { minute: 34, team: 'away', type: 'yellow_card', player: 'Bellingham', description: 'Verwarnung für hartes Foulspiel' },
  ],
  substitutions: [
    { minute: 62, team: 'home', player_out: 'Sané', player_in: 'Musiala', description: 'Offensiver Wechsel' },
  ],
  key_events: [
    { minute: 8, type: 'chance', team: 'home', description: '🎯 Gute Chance Müller (verfehlt)' },
    { minute: 12, type: 'goal', team: 'home', description: '⚽ TOR Müller (1:0)' },
    { minute: 23, type: 'corner', team: 'away', description: '📐 Ecke Dortmund (verteidigt)' },
    { minute: 34, type: 'yellow_card', team: 'away', description: '🟨 Gelbe Karte Bellingham' },
    { minute: 42, type: 'foul', team: 'home', description: '⛔ Foul Bayern (Freistoß Dortmund)' },
    { minute: 52, type: 'transition', team: 'away', description: '⚡ Schneller Konter Dortmund' },
    { minute: 67, type: 'goal', team: 'away', description: '⚽ TOR Haaland (1:1)' },
  ],
};

export default function AdminExampleReport() {
  return (
    <div className="min-h-screen p-4 lg:p-8 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-grotesk font-bold text-foreground">Beispiel-Report</h1>
          </div>
          <p className="text-muted-foreground">Vollständiger SessionReport nach Live-Session mit allen Daten, Statistiken und Events</p>
        </motion.div>

        {/* Main Report */}
        <div className="space-y-6">
          {/* Header Info */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 border border-primary/20">
            <div className="grid md:grid-cols-2 gap-8 mb-6">
              <div>
                <h2 className="font-grotesk font-bold text-2xl text-foreground mb-4">{EXAMPLE_REPORT.match_title}</h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      <strong>Wettbewerb:</strong> Bundesliga Saison 2025/26
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      <strong>Datum:</strong> 2. Mai 2026
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      <strong>Spieldauer:</strong> 90 Minuten
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-center">
                  <div className="font-grotesk font-bold text-5xl text-foreground mb-2">1:1</div>
                  <div className="text-sm text-muted-foreground mb-4">Endergebnis</div>
                  <Badge className="bg-primary/15 text-primary border-primary/30 text-base px-4 py-2">
                    ✓ Mit Match verknüpft
                  </Badge>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Summary */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 border border-border">
            <h3 className="font-grotesk font-bold text-lg text-foreground mb-3">📝 Zusammenfassung</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{EXAMPLE_REPORT.summary}</p>
          </motion.div>

          {/* Statistics Grid */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid md:grid-cols-4 gap-4">
            {[
              { icon: BarChart3, label: 'Total Events', value: EXAMPLE_REPORT.event_count },
              { icon: Trophy, label: 'Tore', value: EXAMPLE_REPORT.goals.length },
              { icon: Badge, label: 'Gelb/Rot', value: EXAMPLE_REPORT.cards.length },
              { icon: Users, label: 'Wechsel', value: EXAMPLE_REPORT.substitutions.length },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="glass rounded-xl p-4 border border-border text-center">
                  <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
                  <div className="font-bold text-2xl text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </motion.div>

          {/* Tore */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6 border border-border">
            <h3 className="font-grotesk font-bold text-lg text-foreground mb-4 flex items-center gap-2">
              ⚽ Tore ({EXAMPLE_REPORT.goals.length})
            </h3>
            <div className="space-y-3">
              {EXAMPLE_REPORT.goals.map((goal, i) => (
                <div key={i} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                  <div className="text-2xl">⚽</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground">{goal.player}</div>
                    <div className="text-sm text-muted-foreground">{goal.description}</div>
                  </div>
                  <Badge variant={goal.team === 'home' ? 'default' : 'outline'} className="flex-shrink-0">
                    {goal.team === 'home' ? '🏠 Heim' : '✈️ Gäste'} {goal.minute}'
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Karten */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass rounded-2xl p-6 border border-border">
            <h3 className="font-grotesk font-bold text-lg text-foreground mb-4 flex items-center gap-2">
              🟨 Gelbe/Rote Karten ({EXAMPLE_REPORT.cards.length})
            </h3>
            <div className="space-y-3">
              {EXAMPLE_REPORT.cards.map((card, i) => (
                <div key={i} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                  <div className="text-2xl">{card.type === 'yellow_card' ? '🟨' : '🟥'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground">{card.player}</div>
                    <div className="text-sm text-muted-foreground">{card.description}</div>
                  </div>
                  <Badge variant={card.team === 'home' ? 'default' : 'outline'} className="flex-shrink-0">
                    {card.team === 'home' ? '🏠 Heim' : '✈️ Gäste'} {card.minute}'
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Wechsel */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-2xl p-6 border border-border">
            <h3 className="font-grotesk font-bold text-lg text-foreground mb-4 flex items-center gap-2">
              🔄 Spielerwechsel ({EXAMPLE_REPORT.substitutions.length})
            </h3>
            <div className="space-y-3">
              {EXAMPLE_REPORT.substitutions.map((sub, i) => (
                <div key={i} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                  <div className="text-2xl">🔄</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground">{sub.player_out} → {sub.player_in}</div>
                    <div className="text-sm text-muted-foreground">{sub.description}</div>
                  </div>
                  <Badge variant={sub.team === 'home' ? 'default' : 'outline'} className="flex-shrink-0">
                    {sub.team === 'home' ? '🏠 Heim' : '✈️ Gäste'} {sub.minute}'
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Event Timeline */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass rounded-2xl p-6 border border-border">
            <h3 className="font-grotesk font-bold text-lg text-foreground mb-4">📋 Vollständiges Event-Protokoll</h3>
            <div className="space-y-2">
              {EXAMPLE_REPORT.key_events.map((event, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-sm">
                  <span className="font-mono font-bold text-primary min-w-12">{String(event.minute).padStart(2, '0')}'</span>
                  <span className="text-xl">{event.type === 'goal' ? '⚽' : event.type === 'chance' ? '🎯' : event.type === 'corner' ? '📐' : event.type === 'yellow_card' ? '🟨' : event.type === 'foul' ? '⛔' : '⚡'}</span>
                  <div className="flex-1">{event.description}</div>
                  <Badge variant={event.team === 'home' ? 'default' : 'outline'} className="text-xs">
                    {event.team === 'home' ? 'Heim' : 'Gäste'}
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Meta Info */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass rounded-2xl p-6 border border-border/50 bg-muted/30">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Report-Metadaten
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <strong>Report-ID:</strong> {EXAMPLE_REPORT.id}
              </div>
              <div>
                <strong>Session-ID:</strong> {EXAMPLE_REPORT.session_id}
              </div>
              <div>
                <strong>Match-ID:</strong> {EXAMPLE_REPORT.match_id}
              </div>
              <div>
                <strong>Report-Typ:</strong> {EXAMPLE_REPORT.report_type}
              </div>
              <div>
                <strong>Generiert:</strong> {new Date(EXAMPLE_REPORT.generated_at).toLocaleString('de-DE')}
              </div>
              <div>
                <strong>Status:</strong> <Badge className="bg-primary/15 text-primary">Vollständig</Badge>
              </div>
            </div>
          </motion.div>

          {/* Footer Info */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="p-6 bg-primary/5 rounded-2xl border border-primary/20 text-center text-sm text-muted-foreground">
            <p className="mb-2">📊 <strong>Dieser Report wird automatisch nach jeder Live-Session generiert</strong></p>
            <p>Alle Daten sind mit der LiveSession + Match verknüpft. Siehe Admin-Handbuch für technische Details.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}