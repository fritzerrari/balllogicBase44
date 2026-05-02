/**
 * EventReview — Nachträgliche Ereignis-Korrektur & Übersicht
 * Zeigt alle aufgezeichneten Match-Events mit Bearbeitungsmöglichkeit
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Edit2, Check, X, Trash2, AlertTriangle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ALL_EVENTS } from '@/components/live/EventButtons';

const TYPE_CONFIG = Object.fromEntries(ALL_EVENTS.map(e => [e.key, e]));

export default function EventReview() {
  const queryClient = useQueryClient();
  const [filterSession, setFilterSession] = useState('');
  const [filterType, setFilterType] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['match-events'],
    queryFn: () => base44.entities.MatchEvent.list('-created_date', 200),
    refetchInterval: 15000,
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MatchEvent.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['match-events'] }); setEditingId(null); },
  });

  const deleteEvent = useMutation({
    mutationFn: (id) => base44.entities.MatchEvent.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['match-events'] }),
  });

  const filtered = events.filter(e => {
    if (filterSession && !e.match_title?.toLowerCase().includes(filterSession.toLowerCase())) return false;
    if (filterType && e.type !== filterType) return false;
    return true;
  });

  const duplicates = filtered.filter(e => e.is_duplicate);
  const startEdit = (ev) => { setEditingId(ev.id); setEditData({ description: ev.description, team: ev.team, type: ev.type, correction_note: ev.correction_note || '' }); };

  return (
    <div className="p-6 lg:p-8 min-h-screen max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <h1 className="text-2xl font-grotesk font-bold text-foreground mb-1">Ereignis-Protokoll</h1>
        <p className="text-sm text-muted-foreground">Alle aufgezeichneten Events — nachträgliche Korrektur möglich</p>
      </motion.div>

      {duplicates.length > 0 && (
        <div className="glass rounded-xl p-4 mb-4 border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-yellow-400">
            <span className="font-bold">{duplicates.length} mögliche Duplikate erkannt</span> (mehrere Quellen innerhalb 10s). Bitte prüfen und bei Bedarf löschen.
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <Input value={filterSession} onChange={e => setFilterSession(e.target.value)}
            placeholder="Nach Spiel filtern..." className="bg-muted border-border text-xs h-8" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-muted border border-input rounded-md px-3 text-xs text-foreground h-8">
          <option value="">Alle Typen</option>
          {ALL_EVENTS.map(e => <option key={e.key} value={e.key}>{e.icon} {e.label}</option>)}
        </select>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{filtered.length} Events</span>
        </div>

        {isLoading && <div className="p-8 text-center text-muted-foreground text-sm">Lädt...</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">Keine Events aufgezeichnet</div>
        )}

        <div className="divide-y divide-border/40 max-h-[60vh] overflow-y-auto">
          {filtered.map(ev => {
            const typeInfo = TYPE_CONFIG[ev.type] || { icon: '📋', label: ev.type };
            return (
              <div key={ev.id} className={`px-5 py-3 ${ev.is_duplicate ? 'bg-yellow-500/5' : ''}`}>
                {editingId === ev.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <select value={editData.type} onChange={e => setEditData(p => ({ ...p, type: e.target.value }))}
                        className="bg-muted border border-input rounded-md px-2 text-xs text-foreground h-8 col-span-1">
                        {ALL_EVENTS.map(e => <option key={e.key} value={e.key}>{e.icon} {e.label}</option>)}
                      </select>
                      <select value={editData.team} onChange={e => setEditData(p => ({ ...p, team: e.target.value }))}
                        className="bg-muted border border-input rounded-md px-2 text-xs text-foreground h-8">
                        <option value="home">🏠 Heim</option>
                        <option value="away">✈️ Gäste</option>
                        <option value="unknown">Unbekannt</option>
                      </select>
                      <Input value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                        className="bg-muted border-border text-xs h-8" />
                    </div>
                    <Input value={editData.correction_note} onChange={e => setEditData(p => ({ ...p, correction_note: e.target.value }))}
                      placeholder="Korrektur-Notiz (Pflicht)" className="bg-muted border-border text-xs h-8" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateEvent.mutate({ id: ev.id, data: { ...editData, corrected: true } })}
                        disabled={!editData.correction_note || updateEvent.isPending} className="bg-primary text-primary-foreground gap-1 h-7 text-xs">
                        <Check className="w-3 h-3" /> Speichern
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-lg flex-shrink-0">{typeInfo.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{ev.description || typeInfo.label}</span>
                        {ev.team && ev.team !== 'unknown' && (
                          <Badge className="text-[10px] bg-muted text-muted-foreground border-border">
                            {ev.team === 'home' ? '🏠 Heim' : '✈️ Gäste'}
                          </Badge>
                        )}
                        {ev.is_duplicate && <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 border-yellow-500/30">DUPLIKAT</Badge>}
                        {ev.corrected && <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">KORRIGIERT</Badge>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                        <span>{ev.minute ?? 0}' · {ev.source || 'unbekannt'}</span>
                        <span>{ev.match_title}</span>
                        {ev.created_date && <span>{format(new Date(ev.created_date), 'dd.MM HH:mm', { locale: de })}</span>}
                        {ev.correction_note && <span className="text-blue-400">✏ {ev.correction_note}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(ev)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteEvent.mutate(ev.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}