/**
 * PlayersAnalyticsPanel — Individuelle Spieleranalysen mit KI
 * Eigene Spieler, Radar, Trends, PDF-fähig
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Loader2, ChevronRight, ChevronDown, ChevronUp, Star, TrendingUp, TrendingDown, BarChart3, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ManagementSummaryCard from './ManagementSummaryCard';
import ConsequencesPanel from './ConsequencesPanel';
import PlayerRadarCard from './PlayerRadarCard';
import { useToast } from '@/components/ui/use-toast';
import PDFExportModal from './PDFExportModal';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';

export default function PlayersAnalyticsPanel({ match }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [showPDF, setShowPDF] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('-created_date', 50),
  });

  const { data: allStats = [] } = useQuery({
    queryKey: ['all-player-stats'],
    queryFn: () => base44.entities.PlayerStat.list('-created_date', 200),
  });

  const { data: playerAnalyses = [] } = useQuery({
    queryKey: ['team-analyses-player'],
    queryFn: () => base44.entities.TeamAnalysis.filter({ analysis_type: 'player' }),
  });

  const playerStats = (playerId) => allStats.filter(s => s.player_id === playerId);

  const playerAnalysis = (playerId) => playerAnalyses.find(a => a.player_id === playerId && (!match?.id || a.match_id === match?.id))
    || playerAnalyses.find(a => a.player_id === playerId);

  const handleGenerate = async (player) => {
    setGenerating(player.id);
    const stats = playerStats(player.id);
    const statText = stats.map(s =>
      `${s.match_title}: Note ${s.rating}/10, Tore ${s.goals}, Assists ${s.assists}, km ${s.distance_km}, Duelle ${s.duels_won}/${s.duels_total}, Pässe ${s.passes_completed}/${s.passes_total}, Min. ${s.minutes_played}`
    ).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Top-Spieleranalyst und Co-Trainer. Erstelle eine hochprofessionelle Spieleranalyse für:

Spieler: ${player.name}
Position: ${player.position}
Alter: ${player.age || '–'}
Dominanter Fuß: ${player.dominant_foot || '–'}
Team: ${player.team || '–'}

Performance-Statistiken (${stats.length} Spiele):
${statText || 'Noch keine Statistiken vorhanden'}

SCHWERPUNKT: Individuelle Stärken/Schwächen, konkrete Entwicklungsmaßnahmen, taktische Rolle!

Liefere:
- management_summary: Prägnante Gesamtbeurteilung (3-4 Sätze, für den Trainer)
- strengths: 4-6 individuelle Stärken (positions- und spielertyp-spezifisch)
- weaknesses: 4-6 ehrliche Schwachpunkte mit klarem Entwicklungspotenzial
- opportunities: 3-4 Chancen wie er sich weiterentwickeln / mehr einbringen kann
- threats: 2-3 Risiken (Verletzungsanfälligkeit, taktische Lücken etc.)
- tactical_observations: Fließtext über taktische Rolle, Bewegungsmuster, Pressing-Beteiligung (2 Absätze)
- consequences: 4-6 Konsequenzen die der Trainer für/mit diesem Spieler ziehen sollte
- recommendations: 5-7 individuelle Empfehlungen für das Training und Spiel
- training_focus: 4-5 spezifische Trainingsschwerpunkte für diesen Spieler
- pressing_analysis: Wie beteiligt er sich am Pressing? Stärken/Schwächen dabei
- formation_analysis: In welchen Formationen spielt er am besten? Warum?
- performance_score: Gesamtbewertung 0-100 über alle Spiele (ehrlich!)`,
      model: 'claude_sonnet_4_6',
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
          performance_score: { type: 'number' },
        }
      }
    });

    await base44.entities.TeamAnalysis.create({
      analysis_type: 'player',
      player_id: player.id,
      player_name: player.name,
      match_id: match?.id,
      match_title: match?.title,
      generated_at: new Date().toISOString(),
      ...result,
    });
    queryClient.invalidateQueries({ queryKey: ['team-analyses-player'] });
    setGenerating(null);
    toast({ title: `✓ ${player.name} analysiert!` });
  };

  const selected = players.find(p => p.id === selectedPlayer);
  const selStats = selectedPlayer ? playerStats(selectedPlayer) : [];
  const selAnalysis = selectedPlayer ? playerAnalysis(selectedPlayer) : null;

  const avgRating = selStats.length > 0
    ? (selStats.reduce((s, p) => s + (p.rating || 0), 0) / selStats.length).toFixed(1)
    : null;

  const radarData = selStats.length > 0 ? [
    { m: 'Note', v: ((avgRating / 10) * 100) },
    { m: 'Zweikampf', v: Math.min(100, (selStats.reduce((s,p)=>s+(p.duels_won||0),0)/Math.max(1,selStats.reduce((s,p)=>s+(p.duels_total||1),0)))*100) },
    { m: 'Tore', v: Math.min(100, (selStats.reduce((s,p)=>s+(p.goals||0),0)/selStats.length)*50) },
    { m: 'Assists', v: Math.min(100, (selStats.reduce((s,p)=>s+(p.assists||0),0)/selStats.length)*50) },
    { m: 'Pässe', v: Math.min(100, (selStats.reduce((s,p)=>s+(p.passes_completed||0),0)/Math.max(1,selStats.reduce((s,p)=>s+(p.passes_total||1),0)))*100) },
    { m: 'km/Spiel', v: Math.min(100, (selStats.reduce((s,p)=>s+(p.distance_km||0),0)/selStats.length/12)*100) },
  ] : [];

  if (players.length === 0) {
    return (
      <div className="glass rounded-2xl p-10 text-center border border-dashed border-border">
        <Star className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <div className="font-grotesk font-semibold text-foreground mb-1">Noch kein Kader erfasst</div>
        <p className="text-sm text-muted-foreground mb-4">Lege zuerst Spieler im Kader an</p>
        <Link to="/players" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 text-primary border border-primary/30 text-sm font-bold">
          <ChevronRight className="w-4 h-4" /> Zum Kader
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Player Grid */}
      <div>
        <h2 className="font-grotesk font-bold text-foreground mb-3">Spieler auswählen</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {players.map(p => {
            const stats = playerStats(p.id);
            const ana = playerAnalysis(p.id);
            const avg = stats.length > 0 ? (stats.reduce((s,x)=>s+(x.rating||0),0)/stats.length).toFixed(1) : null;
            const isSelected = selectedPlayer === p.id;
            return (
              <button key={p.id} onClick={() => setSelectedPlayer(isSelected ? null : p.id)}
                className={`glass rounded-xl p-3 text-left transition-all group border ${isSelected ? 'border-primary/50 bg-primary/10' : 'border-border hover:border-primary/30'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-grotesk font-bold text-primary">
                    {p.number || p.name?.[0]}
                  </div>
                  {avg && (
                    <div className={`text-sm font-grotesk font-bold ${parseFloat(avg)>=7?'text-primary':parseFloat(avg)>=5?'text-yellow-400':'text-destructive'}`}>{avg}</div>
                  )}
                  {ana && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" title="Analysiert" />}
                </div>
                <div className="text-xs font-grotesk font-semibold text-foreground truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{p.position}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Player Detail */}
      <AnimatePresence>
        {selected && (
          <motion.div key={selected.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4 border-t border-border pt-4">

            {/* Player Hero */}
            <div className="glass rounded-2xl p-5 border border-primary/20">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-2xl font-grotesk font-bold text-primary">
                    {selected.number || selected.name?.[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-grotesk font-bold text-foreground">{selected.name}</h3>
                    <div className="text-xs text-muted-foreground mt-0.5">{selected.position} · {selStats.length} Spiele erfasst</div>
                    {avgRating && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">Ø Note:</span>
                        <span className={`text-sm font-grotesk font-bold ${parseFloat(avgRating)>=7?'text-primary':parseFloat(avgRating)>=5?'text-yellow-400':'text-destructive'}`}>{avgRating}/10</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setShowPDF(true)} disabled={!selAnalysis}
                    className="bg-muted border border-border text-muted-foreground hover:text-foreground gap-2 text-xs">
                    <FileDown className="w-3.5 h-3.5" /> PDF
                  </Button>
                  <Button onClick={() => handleGenerate(selected)} disabled={generating === selected.id}
                    className="bg-primary text-primary-foreground gap-2">
                    {generating === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {generating === selected.id ? 'Analysiere...' : selAnalysis ? 'Neu analysieren' : 'KI-Analyse'}
                  </Button>
                </div>
              </div>

              {/* Stats summary */}
              {selStats.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-border">
                  {[
                    { l: 'Ø Note', v: avgRating, hi: parseFloat(avgRating)>=7 },
                    { l: 'Tore', v: selStats.reduce((s,p)=>s+(p.goals||0),0) },
                    { l: 'Assists', v: selStats.reduce((s,p)=>s+(p.assists||0),0) },
                    { l: 'Duelle', v: `${((selStats.reduce((s,p)=>s+(p.duels_won||0),0)/Math.max(1,selStats.reduce((s,p)=>s+(p.duels_total||1),0)))*100).toFixed(0)}%` },
                    { l: 'Ø km', v: (selStats.reduce((s,p)=>s+(p.distance_km||0),0)/selStats.length).toFixed(1) },
                  ].map(s => (
                    <div key={s.l} className="text-center">
                      <div className={`text-lg font-grotesk font-bold ${s.hi?'text-primary':'text-foreground'}`}>{s.v}</div>
                      <div className="text-[10px] text-muted-foreground">{s.l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Charts */}
            {(radarData.length > 0 || selStats.length >= 2) && (
              <div className="grid sm:grid-cols-2 gap-4">
                {radarData.length > 0 && (
                  <div className="glass rounded-xl p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Skill-Radar</div>
                    <ResponsiveContainer width="100%" height={170}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="m" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                        <Radar dataKey="v" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {selStats.length >= 2 && (
                  <div className="glass rounded-xl p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Noten-Verlauf</div>
                    <ResponsiveContainer width="100%" height={170}>
                      <LineChart data={[...selStats].reverse().map((s,i)=>({ n:`S${i+1}`, note:s.rating }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="n" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                        <YAxis domain={[0,10]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                        <Tooltip contentStyle={{ background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius:8, fontSize:11 }} />
                        <Line type="monotone" dataKey="note" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill:'hsl(var(--primary))', r:3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* AI Analysis */}
            {selAnalysis ? (
              <>
                <ManagementSummaryCard analysis={selAnalysis} title={`${selected.name} — KI-Spieleranalyse`} />
                <ConsequencesPanel analysis={selAnalysis} />
              </>
            ) : generating !== selected.id && (
              <div className="glass rounded-xl p-6 text-center border border-dashed border-border">
                <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Starte die KI-Analyse für detailliertes Spieler-Feedback</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Modal */}
      <AnimatePresence>
        {showPDF && selAnalysis && (
          <PDFExportModal
            analysis={selAnalysis}
            match={match}
            onClose={() => setShowPDF(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}