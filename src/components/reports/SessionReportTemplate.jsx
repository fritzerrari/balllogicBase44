/**
 * SessionReportTemplate – Professional Post-Match Report
 * 
 * Struktur:
 * - Summary + Score
 * - Event Timeline
 * - Stats + Analysis
 * - Coaching Notes
 */
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, Trophy, AlertCircle } from 'lucide-react';

export default function SessionReportTemplate({ report }) {
  if (!report) return null;

  const eventsByType = {
    goals: report.goals || [],
    cards: report.cards || [],
    subs: report.substitutions || [],
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto p-6"
    >
      {/* Header */}
      <div className="glass rounded-2xl p-8 border border-primary/20">
        <h1 className="text-4xl font-grotesk font-bold text-foreground mb-2">
          {report.match_title}
        </h1>
        <p className="text-lg text-muted-foreground mb-4">{report.summary}</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            {new Date(report.generated_at).toLocaleDateString('de-DE')}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            {new Date(report.generated_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <Badge className="bg-primary/15 text-primary">{report.event_count} Events</Badge>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Trophy, label: 'Tore', value: eventsByType.goals.length },
          { icon: AlertCircle, label: 'Karten', value: eventsByType.cards.length },
          { icon: Users, label: 'Wechsel', value: eventsByType.subs.length },
          { icon: Clock, label: 'Events', value: report.event_count },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="glass rounded-xl p-4 text-center border border-border">
              <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="text-sm text-muted-foreground mb-1">{stat.label}</div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Event Timeline */}
      {report.key_events && report.key_events.length > 0 && (
        <div className="glass rounded-2xl p-6 border border-border space-y-3">
          <h2 className="text-lg font-grotesk font-bold text-foreground mb-4">📋 Event-Timeline</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {report.key_events.map((evt, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg text-sm">
                <span className="font-mono text-primary min-w-12">{evt.minute}'</span>
                <span className="text-lg min-w-8">
                  {evt.type === 'goal' ? '⚽' : evt.type === 'yellow_card' ? '🟨' : evt.type === 'red_card' ? '🟥' : evt.type === 'corner' ? '📐' : '•'}
                </span>
                <span className="flex-1 text-muted-foreground">{evt.description}</span>
                <Badge variant="outline" className="text-xs">
                  {evt.team === 'home' ? '🏠' : '✈️'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals */}
      {eventsByType.goals.length > 0 && (
        <div className="glass rounded-2xl p-6 border border-primary/20 space-y-3">
          <h2 className="text-lg font-grotesk font-bold text-foreground">⚽ Tore</h2>
          {eventsByType.goals.map((g, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
              <span className="text-2xl">⚽</span>
              <div className="flex-1">
                <div className="font-medium text-foreground">{g.minute}'</div>
                <div className="text-xs text-muted-foreground">{g.description}</div>
              </div>
              <Badge className={g.team === 'home' ? 'bg-primary/15 text-primary' : 'bg-red-500/15 text-red-400'}>
                {g.team === 'home' ? '🏠 Heim' : '✈️ Gäste'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Cards */}
      {eventsByType.cards.length > 0 && (
        <div className="glass rounded-2xl p-6 border border-yellow-500/20 space-y-3">
          <h2 className="text-lg font-grotesk font-bold text-foreground">🟨 Verwarnungen & Rot</h2>
          {eventsByType.cards.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-yellow-500/5 rounded-lg">
              <span className="text-lg">{c.type === 'yellow_card' ? '🟨' : '🟥'}</span>
              <div className="flex-1">
                <div className="font-medium text-foreground">{c.minute}'</div>
              </div>
              <Badge variant="outline" className="text-xs">
                {c.team === 'home' ? '🏠' : '✈️'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground py-4 border-t border-border">
        <p>Automatisch generierter Report nach Session-Ende</p>
        <p className="mt-1">Session ID: <code className="text-[10px] bg-muted px-2 py-1 rounded">{report.session_id}</code></p>
      </div>
    </motion.div>
  );
}