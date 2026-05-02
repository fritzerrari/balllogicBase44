import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Download, Activity, Target, Zap, Users, TrendingUp, AlertTriangle, FileText, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend, BarChart, Bar } from 'recharts';
import FootballPitch from '@/components/pitch/FootballPitch';
import FormationTimeline from '@/components/analysis/FormationTimeline';
import KeyMoments from '@/components/analysis/KeyMoments';
import MetricCard from '@/components/analysis/MetricCard';

export default function TacticsAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: match } = useQuery({
    queryKey: ['match', id],
    queryFn: () => base44.entities.Match.filter({ id }),
    select: d => d?.[0],
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => base44.entities.AnalysisReport.filter({ match_id: id }),
    select: d => d?.[0],
    enabled: !!id,
  });

  const [selectedZone, setSelectedZone] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExportReport = async () => {
    if (!report || !match) return;
    setExportLoading(true);

    // Automatisch vollständigen Bericht per KI generieren
    const aiReport = await base44.integrations.Core.InvokeLLM({
      prompt: `Erstelle einen professionellen, vollständigen Spielanalyse-Bericht für folgendes Spiel:

Spiel: ${match.title}
Datum: ${match.date}
Ergebnis: ${match.score_home ?? '?'} – ${match.score_away ?? '?'}
Formation Heim: ${report.formation_home} | Gäste: ${report.formation_away}
Ballbesitz Heim: ${report.possession_home?.toFixed(1)}% | Gäste: ${report.possession_away?.toFixed(1)}%
Pressing-Index Heim: ${report.pressing_index_home?.toFixed(0)}/100 | Gäste: ${report.pressing_index_away?.toFixed(0)}/100
Pressing-Höhe Heim: ${report.pressing_height_home?.toFixed(0)}m | Gäste: ${report.pressing_height_away?.toFixed(0)}m
Ballgewinne Heim: ${report.ball_recoveries_home} | Gäste: ${report.ball_recoveries_away}
Umschaltsituationen Heim: ${report.transitions_home} | Gäste: ${report.transitions_away}
Kompaktheit Heim: ${report.compactness_home} | Gäste: ${report.compactness_away}

KI-Zusammenfassung: ${report.ai_summary}
KI-Empfehlungen: ${report.ai_recommendations}

Schlüsselmomente: ${(report.key_moments || []).map(m => `${m.minute}' ${m.type}: ${m.description}`).join(', ')}

Schreibe einen strukturierten Bericht mit: 1) Spielzusammenfassung, 2) Taktische Analyse Heim, 3) Taktische Analyse Gäste, 4) Pressing & Kompaktheit, 5) Entscheidende Szenen, 6) Trainer-Empfehlungen für das nächste Spiel. Professionell, konkret, ca. 400 Wörter.`,
    });

    const content = `TactIQ – Automatisierter Spielanalyse-Bericht
================================================
Spiel: ${match.title}
Datum: ${match.date}
Ergebnis: ${match.score_home ?? '?'} – ${match.score_away ?? '?'}
Formation: ${report.formation_home} vs ${report.formation_away}
================================================

${aiReport}

------------------------------------------------
ROHDATEN
------------------------------------------------
Ballbesitz: ${match.home_team} ${report.possession_home?.toFixed(1)}% | ${match.away_team} ${report.possession_away?.toFixed(1)}%
Pressing-Index: ${report.pressing_index_home?.toFixed(0)} vs ${report.pressing_index_away?.toFixed(0)}
Pressing-Höhe: ${report.pressing_height_home?.toFixed(0)}m vs ${report.pressing_height_away?.toFixed(0)}m
Ballgewinne: ${report.ball_recoveries_home} vs ${report.ball_recoveries_away}
Umschaltsituationen: ${report.transitions_home} vs ${report.transitions_away}

Generiert von TactIQ – ${new Date().toLocaleString('de')}`.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${match.title}-TactIQ-Report.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Kein Report gefunden.</p>
        <Button onClick={() => navigate(`/matches/${id}`)} variant="outline" className="mt-4">Zurück zum Spiel</Button>
      </div>
    );
  }

  const radarData = [
    { metric: 'Pressing', home: report.pressing_index_home, away: report.pressing_index_away },
    { metric: 'Kompaktheit', home: report.compactness_home, away: report.compactness_away },
    { metric: 'Ballgewinn', home: report.ball_recoveries_home, away: report.ball_recoveries_away },
    { metric: 'Umschalt.', home: report.transitions_home, away: report.transitions_away },
    { metric: 'Besitz', home: report.possession_home, away: report.possession_away },
  ];

  return (
    <div className="p-6 lg:p-8 min-h-screen">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <button onClick={() => navigate(`/matches/${id}`)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl lg:text-3xl font-grotesk font-bold text-foreground">{match?.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              <span className="text-primary font-medium">{report.formation_home}</span>
              {' '}vs{' '}
              <span className="text-red-400 font-medium">{report.formation_away}</span>
            </p>
          </div>
          <Button onClick={handleExportReport} disabled={exportLoading} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
            {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {exportLoading ? 'KI generiert Bericht...' : 'KI-Bericht exportieren'}
          </Button>
        </div>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Ballbesitz" homeVal={`${report.possession_home?.toFixed(0)}%`} awayVal={`${report.possession_away?.toFixed(0)}%`} homeTeam={match?.home_team} awayTeam={match?.away_team} icon={Activity} />
        <MetricCard label="Pressing-Index" homeVal={report.pressing_index_home?.toFixed(0)} awayVal={report.pressing_index_away?.toFixed(0)} homeTeam={match?.home_team} awayTeam={match?.away_team} icon={Zap} suffix="/100" />
        <MetricCard label="Ballgewinne" homeVal={report.ball_recoveries_home} awayVal={report.ball_recoveries_away} homeTeam={match?.home_team} awayTeam={match?.away_team} icon={Target} />
        <MetricCard label="Umschaltsituationen" homeVal={report.transitions_home} awayVal={report.transitions_away} homeTeam={match?.home_team} awayTeam={match?.away_team} icon={TrendingUp} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted border border-border mb-6 flex-wrap h-auto gap-1 p-1">
          {['overview', 'pitch', 'pressing', 'fatigue', 'moments', 'ai'].map(t => (
            <TabsTrigger key={t} value={t} className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md">
              {t === 'overview' && 'Übersicht'}
              {t === 'pitch' && '🗺 Interaktiv'}
              {t === 'pressing' && 'Pressing'}
              {t === 'fatigue' && 'Ermüdung'}
              {t === 'moments' && 'Schlüsselszenen'}
              {t === 'ai' && 'KI-Analyse'}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-5">
              <h3 className="font-grotesk font-semibold text-foreground mb-4">Taktisches Radar</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Radar name={match?.home_team} dataKey="home" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                  <Radar name={match?.away_team} dataKey="away" stroke="#f87171" fill="#f87171" fillOpacity={0.2} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass rounded-xl p-5">
              <h3 className="font-grotesk font-semibold text-foreground mb-4">Formations-Timeline</h3>
              <FormationTimeline changes={report.formation_changes || []} homeTeam={match?.home_team} awayTeam={match?.away_team} homeFormation={report.formation_home} awayFormation={report.formation_away} />
            </div>
          </div>
        </TabsContent>

        {/* Interactive Pitch */}
        <TabsContent value="pitch">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 glass rounded-xl p-5">
              <h3 className="font-grotesk font-semibold text-foreground mb-2 flex items-center gap-2">
                🗺 Interaktive Taktik-Visualisierung
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Klicke auf eine Gefahrenzone um Details zu sehen ·
                <span className="text-primary font-medium"> ■ {match?.home_team}</span> &nbsp;
                <span className="text-red-400 font-medium">■ {match?.away_team}</span>
              </p>
              <div className="aspect-[3/2] max-h-[420px] relative cursor-pointer"
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  // Find nearest danger zone
                  const nearest = (report.danger_zones || []).reduce((best, z) => {
                    const dist = Math.hypot(z.x - x, z.y - y);
                    return (!best || dist < best.dist) ? { ...z, dist } : best;
                  }, null);
                  if (nearest && nearest.dist < 12) setSelectedZone(nearest);
                  else setSelectedZone(null);
                }}>
                <FootballPitch dangerZones={report.danger_zones || []} showGrid />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
                {[
                  { label: 'Gefahrenzonen', value: report.danger_zones?.length || 0, color: 'text-primary' },
                  { label: 'Umschaltsituationen', value: report.transitions_home + report.transitions_away, color: 'text-yellow-400' },
                  { label: 'Ballgewinne gesamt', value: report.ball_recoveries_home + report.ball_recoveries_away, color: 'text-blue-400' },
                ].map(s => (
                  <div key={s.label} className="bg-muted rounded-lg py-2 px-3">
                    <div className={`text-lg font-grotesk font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {/* Zone Detail */}
              <div className="glass rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  {selectedZone ? '📍 Zone Details' : '📍 Zone auswählen'}
                </h4>
                {selectedZone ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${selectedZone.team === 'home' ? 'bg-primary' : 'bg-red-400'}`} />
                      <span className="text-sm font-medium text-foreground">{selectedZone.team === 'home' ? match?.home_team : match?.away_team}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Gefahr-Intensität</span>
                        <span className="text-foreground font-bold">{(selectedZone.intensity * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${selectedZone.intensity * 100}%` }} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Position X</span>
                        <span className="font-mono text-primary">{selectedZone.x?.toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Position Y</span>
                        <span className="font-mono text-primary">{selectedZone.y?.toFixed(0)}%</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 bg-muted rounded-lg p-2 leading-relaxed">
                        {selectedZone.intensity > 0.7
                          ? '🔴 Hochgefährliche Zone — häufige Chancen aus diesem Bereich'
                          : selectedZone.intensity > 0.4
                          ? '🟡 Mittlere Gefahr — regelmäßige Aktionen im Strafraum-Nähe'
                          : '🟢 Niedrige Gefahr — vereinzelte Aktionen'}
                      </div>
                    </div>
                    <button onClick={() => setSelectedZone(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">× Schließen</button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Klicke auf eine farbige Zone im Spielfeld um Details anzuzeigen.<br /><br />
                    Intensivere Farben = höhere Gefahr in diesem Bereich.
                  </div>
                )}
              </div>

              {/* Formation vs Formation */}
              <div className="glass rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Formation Vergleich</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">{match?.home_team}</div>
                      <div className="text-lg font-grotesk font-bold text-foreground">{report.formation_home}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">{match?.away_team}</div>
                      <div className="text-lg font-grotesk font-bold text-foreground">{report.formation_away}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pressing Height visual */}
              <div className="glass rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Pressing-Linien</h4>
                <div className="space-y-2">
                  {[
                    { team: match?.home_team, val: report.pressing_height_home, color: 'bg-primary' },
                    { team: match?.away_team, val: report.pressing_height_away, color: 'bg-red-400' },
                  ].map(({ team, val, color }) => (
                    <div key={team}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{team}</span>
                        <span className="text-foreground font-bold">{val?.toFixed(0)}m</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (val / 80) * 100)}%` }} transition={{ duration: 1 }} className={`h-full ${color} rounded-full`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Pressing */}
        <TabsContent value="pressing">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-5">
              <h3 className="font-grotesk font-semibold text-foreground mb-4">Pressing-Höhe (Meter)</h3>
              <div className="space-y-6 mt-4">
                {[
                  { team: match?.home_team, val: report.pressing_height_home, color: 'bg-primary', max: 80 },
                  { team: match?.away_team, val: report.pressing_height_away, color: 'bg-red-400', max: 80 },
                ].map(({ team, val, color, max }) => (
                  <div key={team}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-foreground font-medium">{team}</span>
                      <span className="text-muted-foreground">{val?.toFixed(0)}m</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (val / max) * 100)}%` }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className={`h-full ${color} rounded-full`}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-border text-xs text-muted-foreground">
                  Höher = aggressiveres Pressing weiter vom eigenen Tor
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-5">
              <h3 className="font-grotesk font-semibold text-foreground mb-4">Kompaktheit im Verlauf</h3>
              <div className="space-y-4 mt-4">
                {[
                  { label: 'Kompaktheit', home: report.compactness_home, away: report.compactness_away },
                  { label: 'Ballgewinne', home: report.ball_recoveries_home, away: report.ball_recoveries_away },
                ].map(({ label, home, away }) => (
                  <div key={label} className="glass rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-2">{label}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-primary font-bold text-lg w-12 text-right">{Number(home)?.toFixed(0)}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full relative overflow-hidden">
                        <div className="absolute left-0 h-full bg-primary rounded-full" style={{ width: `${(home / (home + away)) * 100}%` }} />
                      </div>
                      <span className="text-red-400 font-bold text-lg w-12">{Number(away)?.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Fatigue */}
        <TabsContent value="fatigue">
          <div className="glass rounded-xl p-5">
            <h3 className="font-grotesk font-semibold text-foreground mb-1">Sprint-Intensität pro 15-Min-Intervall</h3>
            <p className="text-sm text-muted-foreground mb-6">Erkennt Ermüdungsmomente im Spielverlauf</p>
            {report.sprint_data?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={report.sprint_data}>
                  <defs>
                    <linearGradient id="homeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="awayGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="interval" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="home_intensity" name={match?.home_team} stroke="hsl(var(--primary))" fill="url(#homeGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="away_intensity" name={match?.away_team} stroke="#f87171" fill="url(#awayGrad)" strokeWidth={2} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="text-center text-muted-foreground py-12">Keine Sprint-Daten verfügbar</div>}
          </div>
        </TabsContent>

        {/* Key Moments */}
        <TabsContent value="moments">
          <KeyMoments moments={report.key_moments || []} homeTeam={match?.home_team} awayTeam={match?.away_team} />
        </TabsContent>

        {/* AI Summary */}
        <TabsContent value="ai">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-grotesk font-semibold text-foreground">Taktische Analyse</h3>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{report.ai_summary}</p>
            </div>
            <div className="glass rounded-xl p-6 border border-primary/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                </div>
                <h3 className="font-grotesk font-semibold text-foreground">Trainer-Empfehlungen</h3>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{report.ai_recommendations}</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}