/**
 * SessionArchive – Historische Sessions durchsuchen + Zeitlinie
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, Filter, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function SessionArchive() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ended');

  const { data: sessions = [] } = useQuery({
    queryKey: ['archive-sessions'],
    queryFn: () => base44.entities.LiveSession.list('-started_at', 100),
  });

  const filtered = sessions
    .filter(s => s.status === filterStatus)
    .filter(s => s.match_title?.toLowerCase().includes(search.toLowerCase()));

  const grouped = {};
  filtered.forEach(session => {
    const date = new Date(session.started_at).toLocaleDateString('de-DE');
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(session);
  });

  return (
    <div className="p-4 lg:p-8 min-h-screen max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-grotesk font-bold text-foreground mb-4">📚 Session-Archiv</h1>
        
        {/* Search + Filter */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Nach Spiel suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1.5">
            {['ended', 'active', 'paused'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === status
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground border border-transparent'
                }`}
              >
                {status === 'ended' ? '✓' : status === 'active' ? '●' : '⏸'} {status}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Timeline */}
      <div className="space-y-6">
        {Object.keys(grouped).map((date, i) => (
          <motion.div key={date} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="w-4 h-4 text-primary" />
              <h2 className="font-grotesk font-bold text-foreground">{date}</h2>
              <Badge variant="outline" className="text-xs">{grouped[date].length}</Badge>
            </div>

            <div className="space-y-2">
              {grouped[date].map(session => (
                <div
                  key={session.id}
                  className="glass rounded-xl p-4 border border-border hover:border-primary/40 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-bold text-foreground">{session.match_title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(session.started_at).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <Badge className={
                      session.status === 'ended'
                        ? 'bg-green-500/15 text-green-400'
                        : session.status === 'active'
                          ? 'bg-red-500/15 text-red-400 animate-pulse'
                          : 'bg-yellow-500/15 text-yellow-400'
                    }>
                      {session.status}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/30">
                    <div>
                      <div>Kameras</div>
                      <div className="font-bold text-foreground">{session.camera_streams?.length || 0}</div>
                    </div>
                    <div>
                      <div>Halbzeit</div>
                      <div className="font-bold text-foreground">{session.half_time || 1}</div>
                    </div>
                    <div>
                      <div>Match ID</div>
                      <div className="font-mono text-[8px]">{session.match_id?.slice(0, 6) || '—'}</div>
                    </div>
                    <div>
                      <div>Dauer</div>
                      <div className="font-bold text-foreground">
                        {session.ended_at
                          ? `${Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000)}min`
                          : 'Läuft'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-sm">Keine Sessions gefunden</div>
        </div>
      )}
    </div>
  );
}