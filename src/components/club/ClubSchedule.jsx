/**
 * ClubSchedule — Spielplan-Anzeige mit editierbaren Einträgen
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Edit2, Check, X, ChevronRight, Trophy, Clock } from 'lucide-react';
import { format, isPast, isFuture, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const statusColors = {
  scheduled: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  live: 'text-red-400 bg-red-400/10 border-red-400/20 animate-pulse',
  finished: 'text-muted-foreground bg-muted border-border',
  postponed: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
};
const statusLabels = { scheduled: 'Geplant', live: '● LIVE', finished: 'Abgeschlossen', postponed: 'Verlegt' };

export default function ClubSchedule({ clubId, clubName }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState('all'); // all, upcoming, past
  const queryClient = useQueryClient();

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['club-matches', clubId],
    queryFn: () => base44.entities.ClubMatch.filter({ club_id: clubId }, 'date', 100),
    enabled: !!clubId,
  });

  const updateMatch = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ClubMatch.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-matches', clubId] });
      setEditingId(null);
    },
  });

  const filtered = matches.filter(m => {
    const d = new Date(m.date);
    if (filter === 'upcoming') return isFuture(d) || isToday(d);
    if (filter === 'past') return isPast(d) && !isToday(d);
    return true;
  });

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditForm({
      home_score: m.home_score ?? '',
      away_score: m.away_score ?? '',
      notes: m.notes || '',
      status: m.status,
    });
  };

  if (isLoading) return (
    <div className="text-center py-8 text-muted-foreground text-sm">Lade Spielplan...</div>
  );

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {[['all', 'Alle'], ['upcoming', 'Kommend'], ['past', 'Vergangen']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${filter === v ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <div className="text-sm">Keine Spiele gefunden</div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((m) => {
          const matchDate = new Date(m.date);
          const isEditing = editingId === m.id;
          const isUpcoming = isFuture(matchDate) && !isToday(matchDate);
          const isFinished = m.status === 'finished' || (isPast(matchDate) && m.home_score != null);

          return (
            <motion.div key={m.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`glass rounded-xl p-4 border transition-all ${isUpcoming ? 'border-primary/20' : 'border-border'}`}>
              {isEditing ? (
                // EDIT MODE
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted-foreground">{m.home_team} vs {m.away_team}</div>
                  <div className="flex gap-2 items-center">
                    <Input type="number" value={editForm.home_score} placeholder="Heim"
                      onChange={e => setEditForm(f => ({ ...f, home_score: e.target.value }))}
                      className="w-16 text-center bg-muted border-border h-8 text-sm" />
                    <span className="text-muted-foreground font-bold">:</span>
                    <Input type="number" value={editForm.away_score} placeholder="Gast"
                      onChange={e => setEditForm(f => ({ ...f, away_score: e.target.value }))}
                      className="w-16 text-center bg-muted border-border h-8 text-sm" />
                    <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      className="flex-1 h-8 bg-muted border border-input rounded-md px-2 text-xs text-foreground">
                      {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <Input value={editForm.notes} placeholder="Notizen..."
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    className="bg-muted border-border text-sm h-8" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateMatch.mutate({ id: m.id, data: { ...editForm, home_score: editForm.home_score !== '' ? parseInt(editForm.home_score) : null, away_score: editForm.away_score !== '' ? parseInt(editForm.away_score) : null, manual_override: true } })}
                      className="flex-1 bg-primary text-primary-foreground h-7 text-xs gap-1">
                      <Check className="w-3 h-3" /> Speichern
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="border-border h-7 text-xs">
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                // VIEW MODE
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 text-center w-12">
                    <div className="text-[10px] text-muted-foreground">{format(matchDate, 'dd. MMM', { locale: de })}</div>
                    <div className="text-[9px] text-muted-foreground">{format(matchDate, 'HH:mm', { locale: de })}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {m.home_team} <span className="text-muted-foreground text-xs">vs</span> {m.away_team}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`text-[9px] border ${statusColors[m.status]}`}>{statusLabels[m.status]}</Badge>
                      {m.competition && <span className="text-[10px] text-muted-foreground">{m.competition}</span>}
                      {m.matchday && <span className="text-[10px] text-muted-foreground">· {m.matchday}. Spieltag</span>}
                    </div>
                    {m.notes && <div className="text-[10px] text-muted-foreground/70 mt-1 italic">{m.notes}</div>}
                  </div>
                  {isFinished && m.home_score != null ? (
                    <div className="text-lg font-grotesk font-bold text-foreground flex-shrink-0">
                      {m.home_score} – {m.away_score}
                    </div>
                  ) : isUpcoming ? (
                    <div className="flex-shrink-0 text-[10px] text-primary font-bold bg-primary/10 px-2 py-1 rounded-lg">
                      {isToday(matchDate) ? 'Heute!' : `in ${Math.ceil((matchDate - new Date()) / 86400000)}d`}
                    </div>
                  ) : null}
                  <button onClick={() => startEdit(m)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all flex-shrink-0">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}