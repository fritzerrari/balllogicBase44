/**
 * OwnTeamPanel — Eigenes Team: Tiefenanalyse mit KI
 * Schwerpunkt auf Schwachstellen, Verbesserungsanalyse, Konsequenzen
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Zap, Loader2, RefreshCw, BarChart3, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ManagementSummaryCard from './ManagementSummaryCard';
import ConsequencesPanel from './ConsequencesPanel';
import { useToast } from '@/components/ui/use-toast';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line
} from 'recharts';

export default function OwnTeamPanel({ match, analysisReport }) {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: analyses = [] } = useQuery({
    queryKey: ['team-analyses-own', match?.id],
    queryFn: () => base44.entities.TeamAnalysis.filter({ analysis_type: 'own_team', match_id: match?.id }),
    enabled: !!match?.id,
  });

  const { data: allReports = [] } = useQuery({
    queryKey: ['analysis-reports-all'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date', 10),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['match-events', match?.id],
    queryFn: () => base44.entities.MatchEvent.filter({ match_id: match?.id }),
    enabled: !!match?.id,
  });

  const analysis = analyses[0];

  const handleGenerate = async () => {
    setGenerating(true);

    const reportContext = analysisReport ? `
Ballbesitz: Heim ${analysisReport.possession_home}% / Gäste ${analysisReport.possession_away}%
Pressing-Index: Heim ${analysisReport.pressing_index_home} / Gäste ${analysisReport.pressing_index_away}
Pressing-Höhe: Heim ${analysisReport.pressing_height_home}m / Gäste ${analysisReport.pressing_height_away}m
Formation Heim: ${analysisReport.formation_home}
Formation Gäste: ${analysisReport.formation_away}
Ballgewinne: Heim ${analysisReport.ball_recoveries_home} / Gäste ${analysisReport.ball_recoveries_away}
Transitionen: Heim ${analysisReport.transitions_home} / Gäste ${analysisReport.transitions_away}
KI-Zusammenfassung: ${analysisReport.ai_summary || '–'}` : '';

    const eventsContext = events.length > 0
      ? `\nKey Events: ${events.slice(0, 20).map(e => `Min.${e.minute} ${e.type} (${e.team})`).join(', ')}`
      : '';

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Fußballanalyst. Analysiere das Spiel "${match?.title || 'Unbekannt'}" für die Heimmannschaft "${match?.home_team || 'Eigenes Team'}".

Match: ${match?.title}, Ergebnis: ${match?.score_home ?? '–'}:${match?.score_away ?? '–'}
${reportContext}
${eventsContext}

Gib PRÄGNANTE Einschätzung:
- management_summary: 2-3 klare Sätze
- strengths: 4-5 Stärken
- weaknesses: 4-5 Schwachpunkte (am wichtigsten!)
- opportunities: 3-4 Chancen
- threats: 3-4 Risiken
- tactical_observations: 1 Absatz, kernhaft
- consequences: 4-5 sofortige Maßnahmen
- recommendations: 4-5 konkrete Empfehlungen
- training_focus: 3-4 Trainingsschwerpunkte
- pressing_analysis: Kurz (1-2 Sätze)
- formation_analysis: Kurz (1-2 Sätze)
- set_pieces_analysis: Kurz (1-2 Sätze)
- performance_score: 0-100

Kurz & knapp, keine Floskeln.`,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          management_summary: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          opportunities: { type: 'array', items: { type: 'string' } },
          threats: { type: 'array', items: { type: 'string' } },
          tactical_observations: { type: 'string' },
          consequences: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
          training_focus: { type: 'array', items: { type: 'string' } },
          pressing_analysis: { type: 'string' },
          formation_analysis: { type: 'string' },
          set_pieces_analysis: { type: 'string' },
          performance_score: { type: 'number' },
        }
      }
    });

    await base44.entities.TeamAnalysis.create({
      analysis_type: 'own_team',
      match_id: match?.id,
      match_title: match?.title,
      generated_at: new Date().toISOString(),
      ...result,
    });
    queryClient.invalidateQueries({ queryKey: ['team-analyses-own', match?.id] });
    setGenerating(false);
    toast({ title: '✓ Team-Analyse generiert!' });
  };

  // Trend data from multiple reports
  const trendData = allReports.slice().reverse().map((r, i) => ({
    n: `S${i + 1}`,
    pressing: r.pressing_index_home ?? 0,
    besitz: r.possession_home ?? 0,
    kompakt: r.compactness_home ?? 0,
  }));

  const radarData = analysisReport ? [
    { m: 'Pressing', v: analysisReport.pressing_index_home ?? 0 },
    { m: 'Ballbesitz', v: analysisReport.possession_home ?? 0 },
    { m: 'Kompaktheit', v: analysisReport.compactness_home ?? 0 },
    { m: 'Ballgewinne', v: Math.min(100, (analysisReport.ball_recoveries_home ?? 0) * 3) },
    { m: 'Transitionen', v: Math.min(100, (analysisReport.transitions_home ?? 0) * 5) },
  ] : [];

  return (
    <div className="space-y-5">
      {/* Generate Button */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-grotesk font-bold text-foreground text-sm sm:text-base">Eigenes Team — Tiefenanalyse</h2>
          <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Schwachstellen, Verbesserungspotenziale, Handlungsempfehlungen</p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}
          className="bg-primary text-primary-foreground gap-2 flex-shrink-0 text-xs sm:text-sm">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : analysis ? <RefreshCw className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{generating ? 'Analysiere...' : analysis ? 'Neu analysieren' : 'KI starten'}</span>
          <span className="sm:hidden">{generating ? '...' : 'KI'}</span>
        </Button>
      </div>

      {generating && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          Claude analysiert dein Team auf höchstem Niveau... (nutzt mehr Analyse-Credits)
        </div>
      )}

      {/* Metrics Grid */}
      {analysisReport && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {[
            { label: 'Ballbesitz', value: `${analysisReport.possession_home ?? '–'}%`, color: 'text-primary', sub: `Gegner: ${analysisReport.possession_away ?? '–'}%` },
            { label: 'Pressing-Index', value: analysisReport.pressing_index_home ?? '–', color: 'text-orange-400', sub: `Höhe: ${analysisReport.pressing_height_home ?? '–'}m` },
            { label: 'Ballgewinne', value: analysisReport.ball_recoveries_home ?? '–', color: 'text-blue-400', sub: `Gegner: ${analysisReport.ball_recoveries_away ?? '–'}` },
            { label: 'Formation', value: analysisReport.formation_home || '–', color: 'text-purple-400', sub: `Gegner: ${analysisReport.formation_away || '–'}` },
          ].map(m => (
            <div key={m.label} className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">{m.label}</div>
              <div className={`text-xl font-grotesk font-bold ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row */}
      {(radarData.length > 0 || trendData.length >= 2) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {radarData.length > 0 && (
            <div className="glass rounded-xl p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" /> Team-Radar
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="m" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                  <Radar dataKey="v" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
          {trendData.length >= 2 && (
            <div className="glass rounded-xl p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-primary" /> Formkurve
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="n" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="pressing" name="Pressing" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="besitz" name="Ballbesitz" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* AI Analysis */}
      {analysis ? (
        <>
          <ManagementSummaryCard analysis={analysis} title="Management Summary — Eigenes Team" />
          <ConsequencesPanel analysis={analysis} />
        </>
      ) : (
        !generating && (
          <div className="glass rounded-2xl p-8 text-center border border-dashed border-border">
            <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <div className="font-grotesk font-semibold text-foreground mb-1">Noch keine KI-Analyse vorhanden</div>
            <p className="text-sm text-muted-foreground mb-4">Starte die KI-Analyse für tiefgehende Erkenntnisse über dein eigenes Team</p>
            <Button onClick={handleGenerate} className="bg-primary text-primary-foreground gap-2">
              <Zap className="w-4 h-4" /> Jetzt analysieren
            </Button>
          </div>
        )
      )}
    </div>
  );
}