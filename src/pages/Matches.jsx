import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Video, Search, Filter, Clock, Trash2, BarChart3, Radio } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const statusConfig = {
  uploading: { label: 'Upload', class: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  processing: { label: 'KI läuft', class: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  analyzed: { label: 'Analysiert', class: 'bg-primary/15 text-primary border-primary/30' },
  live: { label: '● LIVE', class: 'bg-red-500/15 text-red-400 border-red-500/30' },
  failed: { label: 'Fehler', class: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export default function Matches() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => base44.entities.Match.list('-date', 50),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Match.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  });

  const filtered = matches.filter(m => {
    const matchesSearch = m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.home_team?.toLowerCase().includes(search.toLowerCase()) ||
      m.away_team?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || m.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 lg:p-8 min-h-screen">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <h1 className="text-3xl font-grotesk font-bold text-foreground mb-1">Spiele</h1>
        <p className="text-muted-foreground">Alle Spiele & Analysen verwalten</p>
      </motion.div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Spiel suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-muted border-border"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'analyzed', 'processing', 'live'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                filterStatus === s
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-muted text-muted-foreground border-border hover:border-primary/20'
              }`}
            >
              {s === 'all' ? 'Alle' : statusConfig[s]?.label}
            </button>
          ))}
        </div>
        <Link to="/matches/new">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 neon-glow">
            <Plus className="w-4 h-4" /> Neues Spiel
          </Button>
        </Link>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-5 h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-grotesk font-semibold text-foreground mb-2">Keine Spiele gefunden</h3>
          <p className="text-muted-foreground text-sm mb-6">Lade dein erstes Video hoch und starte die KI-Analyse.</p>
          <Link to="/matches/new">
            <Button className="bg-primary text-primary-foreground gap-2">
              <Plus className="w-4 h-4" /> Spiel hinzufügen
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((match, i) => {
            const sc = statusConfig[match.status] || statusConfig.uploading;
            return (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass rounded-xl p-5 hover:border-primary/30 transition-all duration-200 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <Badge className={`text-xs border ${sc.class}`}>{sc.label}</Badge>
                  <button
                    onClick={() => deleteMutation.mutate(match.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-grotesk font-semibold text-foreground mb-1 line-clamp-1">{match.title}</h3>
                <div className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {format(new Date(match.date), 'dd. MMM yyyy', { locale: de })}
                  {match.competition && <span className="text-xs">· {match.competition}</span>}
                </div>
                {(match.score_home !== undefined) && (
                  <div className="text-center mb-3 font-grotesk font-bold text-2xl text-foreground">
                    {match.score_home} – {match.score_away}
                  </div>
                )}
                <div className="flex gap-2 pt-3 border-t border-border">
                  {match.status === 'analyzed' && (
                    <Link to={`/tactics/${match.id}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
                        <BarChart3 className="w-3 h-3" /> Analyse
                      </Button>
                    </Link>
                  )}
                  <Link to={`/matches/${match.id}`} className="flex-1">
                    <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground hover:text-foreground">
                      Details →
                    </Button>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}