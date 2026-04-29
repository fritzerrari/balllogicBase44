import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Video, TrendingUp, Activity, Zap, 
  ArrowRight, Radio, Clock, ChevronRight,
  BarChart3, Target
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const StatCard = ({ label, value, sub, icon: Icon, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass rounded-xl p-5 hover:border-primary/30 transition-all duration-300 group cursor-default"
  >
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

const statusColors = {
  uploading: 'text-yellow-400 bg-yellow-400/10',
  processing: 'text-blue-400 bg-blue-400/10',
  analyzed: 'text-primary bg-primary/10',
  live: 'text-red-400 bg-red-400/10',
  failed: 'text-destructive bg-destructive/10',
};

const statusLabels = {
  uploading: 'Upload',
  processing: 'Verarbeitung',
  analyzed: 'Analysiert',
  live: '● LIVE',
  failed: 'Fehler',
};

export default function Dashboard() {
  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => base44.entities.Match.list('-created_date', 10),
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date', 5),
  });

  const analyzedCount = matches.filter(m => m.status === 'analyzed').length;
  const liveCount = matches.filter(m => m.status === 'live').length;

  return (
    <div className="p-6 lg:p-8 min-h-screen">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 font-medium tracking-widest uppercase">
          <Activity className="w-3 h-3" />
          <span>KI-Spielanalyse</span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-grotesk font-bold text-foreground">
          Taktisches Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Überblick über alle Spiele und Analysen</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Gesamt Spiele" value={matches.length} icon={Video} color="bg-primary/15 text-primary" sub={`${analyzedCount} analysiert`} />
        <StatCard label="Live Sessions" value={liveCount} icon={Radio} color="bg-red-500/15 text-red-400" sub={liveCount > 0 ? 'Aktiv' : 'Keine aktiv'} />
        <StatCard label="Analyse-Reports" value={reports.length} icon={BarChart3} color="bg-blue-500/15 text-blue-400" />
        <StatCard label="KI-Insights" value={reports.length * 6} icon={Target} color="bg-purple-500/15 text-purple-400" sub="Taktik-Metriken" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Matches */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-grotesk font-semibold text-foreground">Letzte Spiele</h2>
            <Link to="/matches" className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors">
              Alle <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {matches.length === 0 && (
              <div className="glass rounded-xl p-8 text-center">
                <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Noch keine Spiele. <Link to="/matches" className="text-primary hover:underline">Erstes Spiel hinzufügen →</Link></p>
              </div>
            )}
            {matches.map((match, i) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/matches/${match.id}`}>
                  <div className="glass rounded-xl p-4 hover:border-primary/30 transition-all duration-200 group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[match.status]}`}>
                            {statusLabels[match.status]}
                          </span>
                          {match.competition && (
                            <span className="text-xs text-muted-foreground">{match.competition}</span>
                          )}
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
                          <div className="font-grotesk font-bold text-xl text-foreground">
                            {match.score_home} – {match.score_away}
                          </div>
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

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-lg font-grotesk font-semibold text-foreground">Schnellstart</h2>
          <Link to="/matches/new">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="glass rounded-xl p-5 border border-primary/20 hover:border-primary/50 hover:neon-glow transition-all duration-300 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/30 transition-colors">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <div className="font-grotesk font-semibold text-foreground mb-1">Video hochladen</div>
              <div className="text-sm text-muted-foreground">Spiel analysieren lassen</div>
            </motion.div>
          </Link>
          <Link to="/live">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="glass rounded-xl p-5 border border-red-500/20 hover:border-red-500/50 transition-all duration-300 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center mb-3">
                <Radio className="w-5 h-5 text-red-400" />
              </div>
              <div className="font-grotesk font-semibold text-foreground mb-1">Live-Session starten</div>
              <div className="text-sm text-muted-foreground">Echtzeit-Analyse</div>
            </motion.div>
          </Link>
          <Link to="/reports">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="glass rounded-xl p-5 border border-border hover:border-primary/30 transition-all duration-300 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-3">
                <BarChart3 className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="font-grotesk font-semibold text-foreground mb-1">Reports ansehen</div>
              <div className="text-sm text-muted-foreground">{reports.length} verfügbare Analysen</div>
            </motion.div>
          </Link>
        </div>
      </div>
    </div>
  );
}