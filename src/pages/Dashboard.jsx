import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Video, TrendingUp, Activity, Zap, 
  ArrowRight, Radio, Clock, ChevronRight,
  BarChart3, Target, Bot, Search, Dumbbell, Shield, Users, Sparkles,
  FileText, Layers
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SessionReportCard from '@/components/reports/SessionReportCard';
import { SkeletonCard, SkeletonList, SkeletonChart } from '@/components/SkeletonLoader';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const statusColors = {
  uploading: 'text-yellow-400 bg-yellow-400/10',
  processing: 'text-blue-400 bg-blue-400/10',
  analyzed: 'text-primary bg-primary/10',
  live: 'text-red-400 bg-red-400/10',
  failed: 'text-destructive bg-destructive/10',
};
const statusLabels = {
  uploading: 'Upload', processing: 'Verarbeitung', analyzed: 'Analysiert', live: '● LIVE', failed: 'Fehler',
};

const StatCard = ({ label, value, sub, icon: Icon, color }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5 hover:border-primary/30 transition-all duration-300 group cursor-default">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5" />
      </div>
      <TrendingUp className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </div>
    <div className="text-2xl font-grotesk font-bold text-foreground mb-1">{value}</div>
    <div className="text-sm text-muted-foreground">{label}</div>
    {sub && <div className="text-xs text-primary mt-1 font-medium">{sub}</div>}
  </motion.div>
);

const ToolCard = ({ label, desc, icon: Icon, path, color, iconBg }) => (
  <Link to={path}>
    <motion.div whileHover={{ scale: 1.02 }} className={`glass rounded-xl p-4 border hover:border-opacity-60 transition-all duration-200 cursor-pointer group ${color}`}>
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center mb-2.5`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="font-grotesk font-semibold text-foreground text-sm mb-0.5">{label}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </motion.div>
  </Link>
);

export default function Dashboard() {
  const [matchPage, setMatchPage] = useState(1);
  
  const { data: matches = [], isLoading: matchesLoading, error: matchesError } = useQuery({
    queryKey: ['matches', matchPage],
    queryFn: () => base44.entities.Match.list('-created_date', 5), // Pagination: 5 per page
  });
  
  const { data: reports = [], isLoading: reportsLoading, error: reportsError } = useQuery({
    queryKey: ['reports'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date', 8),
  });
  
  const { data: sessionReports = [], isLoading: sessionReportsLoading } = useQuery({
    queryKey: ['session-reports'],
    queryFn: () => base44.entities.SessionReport.list('-generated_at', 3),
    retry: 1, // Reduce retry for faster fallback
  });

  const analyzedCount = matches.filter(m => m.status === 'analyzed').length;
  const liveCount = matches.filter(m => m.status === 'live').length;

  // Trend: pressing over last reports
  const trendData = reports.slice().reverse().map((r, i) => ({
    name: `S${i + 1}`,
    pressing: r.pressing_index_home ?? 0,
    besitz: r.possession_home ?? 0,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative p-6 lg:p-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl">
            <div className="flex items-center gap-2 text-xs text-primary mb-3 font-bold tracking-widest uppercase">
              <Activity className="w-4 h-4" /><span>🎯 KI-Echtzeit-Analyse</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-grotesk font-black bg-clip-text text-transparent bg-gradient-to-r from-foreground to-primary mb-2">TactIQ</h1>
            <p className="text-lg text-muted-foreground mb-4">Echtzeit-Fußball-Analyse mit KI-gestütztem Tracking, Formation-Erkennung und Live-Coaching</p>
            <div className="flex flex-wrap gap-2">
              {['⚡ Live-Tracking', '📊 Echtzeit-KPIs', '🎯 Auto-Events', '👥 Spieler-Stats'].map(f => (
                <span key={f} className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-semibold border border-primary/40">{f}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="p-6 lg:p-8">

      {/* Demo-Banner für neue Nutzer */}
      {matches.length === 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5 mb-6 border border-primary/30 bg-primary/5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-grotesk font-semibold text-foreground mb-1">Willkommen bei TactIQ 👋</div>
            <p className="text-sm text-muted-foreground mb-3">Lade dein erstes Spielvideo hoch oder starte eine Live-Session — TactIQ analysiert Formation, Pressing, Tore und vieles mehr automatisch mit KI.</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {['⚽ KI-Taktikanalyse', '📹 Multi-Kamera-Live', '🧠 KI-Co-Trainer', '👤 Spieler-Performance', '📋 Halbzeit-Ansprache'].map(f => (
                <span key={f} className="bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">{f}</span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Spiele" value={matches.length} icon={Video} color="bg-primary/15 text-primary" sub={`${analyzedCount} ✓`} />
        <StatCard label="Live" value={liveCount} icon={Radio} color="bg-red-500/15 text-red-500" sub={liveCount > 0 ? '🔴 AKTIV' : '○ Inaktiv'} />
        <StatCard label="Reports" value={reports.length} icon={BarChart3} color="bg-blue-500/15 text-blue-400" sub={`${(reports.length * 6)} Metriken`} />
        <StatCard label="Performance" value={`${(analyzedCount / (matches.length || 1) * 100).toFixed(0)}%`} icon={Zap} color="bg-yellow-500/15 text-yellow-400" sub="Erkannt" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: recent matches + trend */}
        <div className="lg:col-span-2 space-y-6">
          {/* Featured Activity */}
          {matches.length > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-6 border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-primary uppercase tracking-widest">⭐ Highlight</span>
                <Badge className="bg-primary/30 text-primary text-[10px]">Aktuell</Badge>
              </div>
              <div className="font-grotesk text-xl font-bold text-foreground mb-1">{matches[0]?.title}</div>
              <div className="text-sm text-muted-foreground mb-4">{format(new Date(matches[0]?.date), 'dd. MMM yyyy • HH:mm', { locale: de })}</div>
              <div className="flex items-center gap-3">
                {matches[0]?.score_home !== undefined && (
                  <div className="text-3xl font-grotesk font-bold text-foreground">{matches[0].score_home} — {matches[0].score_away}</div>
                )}
                <Badge className={`${statusColors[matches[0]?.status]} text-xs px-3 py-1`}>{statusLabels[matches[0]?.status]}</Badge>
              </div>
            </motion.div>
          )}
          {/* Trend chart */}
          {reportsLoading ? (
            <SkeletonChart />
          ) : trendData.length >= 2 ? (
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-grotesk font-semibold text-foreground text-sm">Formkurve — Letzte Spiele</h2>
                <Link to="/reports" className="text-xs text-primary hover:text-primary/80">Alle Reports →</Link>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="pressing" name="Pressing" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="besitz" name="Ballbesitz %" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block" /> Pressing</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> Ballbesitz %</span>
              </div>
            </div>
          ) : null}

          {/* Recent Matches */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-grotesk font-semibold text-foreground">Letzte Spiele</h2>
              <Link to="/matches" className="flex items-center gap-1 text-sm text-primary hover:text-primary/80">
                Alle <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {matchesLoading ? (
                <SkeletonList />
              ) : matchesError ? (
                <div className="glass rounded-xl p-4 text-center text-xs text-muted-foreground">
                  Fehler beim Laden der Spiele. Versuchen Sie später erneut.
                </div>
              ) : matches.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center">
                  <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Noch keine Spiele. <Link to="/matches" className="text-primary hover:underline">Erstes Spiel hinzufügen →</Link></p>
                </div>
              ) : null}
              {matches.slice(0, 5).map((match, i) => (
                <motion.div key={match.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link to={`/matches/${match.id}`}>
                    <div className="glass rounded-xl p-4 hover:border-primary/30 transition-all duration-200 group">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[match.status]}`}>{statusLabels[match.status]}</span>
                            {match.competition && <span className="text-xs text-muted-foreground">{match.competition}</span>}
                          </div>
                          <div className="font-grotesk font-semibold text-foreground text-sm truncate">{match.title}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{format(new Date(match.date), 'dd. MMM yyyy', { locale: de })}</span>
                            {match.camera_count > 1 && <span className="text-primary">• {match.camera_count} Kameras</span>}
                          </div>
                        </div>
                        {(match.score_home !== undefined && match.score_away !== undefined) && (
                          <div className="text-center mx-4">
                            <div className="font-grotesk font-bold text-xl text-foreground">{match.score_home} – {match.score_away}</div>
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Quick tools */}
        <div className="space-y-4">
          <h2 className="text-lg font-grotesk font-semibold text-foreground">Schnellstart</h2>
          <Link to="/matches/new">
            <motion.div whileHover={{ scale: 1.02 }} className="glass rounded-xl p-5 border border-primary/20 hover:border-primary/50 hover:neon-glow transition-all duration-300 cursor-pointer group mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/30">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <div className="font-grotesk font-semibold text-foreground mb-1">Video hochladen</div>
              <div className="text-sm text-muted-foreground">Spiel analysieren lassen</div>
            </motion.div>
          </Link>
          <Link to="/live">
            <motion.div whileHover={{ scale: 1.02 }} className="glass rounded-xl p-5 border border-red-500/20 hover:border-red-500/50 transition-all duration-300 cursor-pointer group mb-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center mb-3">
                <Radio className="w-5 h-5 text-red-400" />
              </div>
              <div className="font-grotesk font-semibold text-foreground mb-1">Live-Session</div>
              <div className="text-sm text-muted-foreground">Echtzeit-Analyse</div>
            </motion.div>
          </Link>

          <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold px-1 pt-1">KI-Tools</div>
          <div className="grid grid-cols-2 gap-2">
            <ToolCard label="KI-Assistent" desc="Co-Trainer Chat" icon={Bot} path="/assistant" color="border-primary/20 hover:border-primary/40" iconBg="bg-primary/15 text-primary" />
            <ToolCard label="Scouting" desc="Gegner-Profil" icon={Search} path="/scouting" color="border-blue-500/20 hover:border-blue-500/40" iconBg="bg-blue-500/15 text-blue-400" />
            <ToolCard label="Trainingsplan" desc="KI-generiert" icon={Dumbbell} path="/training" color="border-orange-500/20 hover:border-orange-500/40" iconBg="bg-orange-500/15 text-orange-400" />
            <ToolCard label="Matchplan" desc="Vorbereitung" icon={Shield} path="/matchprep" color="border-purple-500/20 hover:border-purple-500/40" iconBg="bg-purple-500/15 text-purple-400" />
            <ToolCard label="Kader" desc="Spieler-Profile" icon={Users} path="/players" color="border-teal-500/20 hover:border-teal-500/40" iconBg="bg-teal-500/15 text-teal-400" />
            <ToolCard label="Taktik-Board" desc="Aufstellungen" icon={Layers} path="/tactics-board" color="border-yellow-500/20 hover:border-yellow-500/40" iconBg="bg-yellow-500/15 text-yellow-400" />
          </div>

          {/* Recent session reports */}
          {sessionReportsLoading ? (
            <div className="mt-4">
              <SkeletonList />
            </div>
          ) : sessionReports.length > 0 ? (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" /> Letzte Berichte
                </div>
                <Link to="/session-reports" className="text-xs text-primary hover:text-primary/80">Alle →</Link>
              </div>
              <div className="space-y-2">
                {sessionReports.map(r => (
                  <SessionReportCard key={r.id} report={r} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}