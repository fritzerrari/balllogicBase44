/**
 * SessionReportTemplate – Professional Post-Match Report
 * 
 * Struktur:
 * - Summary + Score
 * - Event Timeline
 * - Stats + Analysis
 * - Coaching Notes
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, Trophy, AlertCircle, Loader2, Zap } from 'lucide-react';
import SessionReportPDFExport from './SessionReportPDFExport';

export default function SessionReportTemplate({ report }) {
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  useEffect(() => {
    if (!report?.match_id) return;
    setLoadingAnalysis(true);
    base44.entities.TeamAnalysis.filter({ match_id: report.match_id, analysis_type: 'own_team' })
      .then(results => {
        if (results.length > 0) setAnalysis(results[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingAnalysis(false));
  }, [report?.match_id]);

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
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <SessionReportPDFExport report={report} />
        </div>
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

      {/* KI-Analyse */}
      {loadingAnalysis ? (
        <div className="glass rounded-2xl p-6 border border-primary/20 flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-primary animate-spin mr-2" />
          <span className="text-muted-foreground">KI-Analyse wird generiert...</span>
        </div>
      ) : analysis ? (
        <div className="glass rounded-2xl p-6 border border-primary/20 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-grotesk font-bold text-foreground">🤖 KI-Analyse</h2>
          </div>

          {/* Score */}
          <div className="bg-primary/10 rounded-xl p-4 text-center border border-primary/20 mb-4">
            <div className="text-sm text-muted-foreground mb-1">Gesamtbewertung</div>
            <div className="text-4xl font-bold text-primary">{analysis.performance_score}/100</div>
          </div>

          {/* SWOT */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { title: 'Stärken', icon: '💪', items: analysis.strengths, color: 'bg-green-500/10 border-green-500/20 text-green-400' },
              { title: 'Schwächen', icon: '⚠️', items: analysis.weaknesses, color: 'bg-red-500/10 border-red-500/20 text-red-400' },
              { title: 'Chancen', icon: '🎯', items: analysis.opportunities, color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
              { title: 'Bedrohungen', icon: '🔴', items: analysis.threats, color: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' },
            ].map((section, idx) => (
              <div key={idx} className={`rounded-lg p-3 border ${section.color}`}>
                <div className="font-bold text-sm mb-2">{section.icon} {section.title}</div>
                <ul className="text-xs space-y-1">
                  {(section.items || []).slice(0, 2).map((item, i) => (
                    <li key={i} className="text-muted-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Tactical + Recommendations */}
          {analysis.tactical_observations && (
            <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-2">
              <div className="font-bold text-foreground">🎲 Taktik-Beobachtung</div>
              <p className="text-muted-foreground">{analysis.tactical_observations.slice(0, 200)}...</p>
            </div>
          )}

          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-2">
              <div className="font-bold text-foreground">📌 Empfehlungen</div>
              <ol className="text-muted-foreground space-y-1 list-decimal list-inside">
                {analysis.recommendations.slice(0, 3).map((rec, i) => (
                  <li key={i} className="text-xs">{rec}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <div className="glass rounded-2xl p-6 border border-border text-center text-muted-foreground">
          Analyse wird in Kürze verfügbar...
        </div>
      )}

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