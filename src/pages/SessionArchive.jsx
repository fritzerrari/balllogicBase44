/**
 * SessionArchive – Admin: Alle Sessions anzeigen, bearbeiten, löschen (einzeln + alles)
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Filter, Search, Trash2, Trash, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function SessionArchive() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ended');
  const [selected, setSelected] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['archive-sessions'],
    queryFn: () => base44.entities.LiveSession.list('-started_at', 200),
  });

  // Check if user is admin
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });
  const isAdmin = user?.role === 'admin';

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LiveSession.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['archive-sessions'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LiveSession.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['archive-sessions'] }),
  });

  const filtered = sessions
    .filter(s => filterStatus === 'all' || s.status === filterStatus)
    .filter(s => s.match_title?.toLowerCase().includes(search.toLowerCase()));

  const grouped = {};
  filtered.forEach(session => {
    const dateStr = session.started_at
      ? new Date(session.started_at).toLocaleDateString('de-DE')
      : 'Unbekannt';
    if (!grouped[dateStr]) grouped[dateStr] = [];
    grouped[dateStr].push(session);
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(s => s.id)));
    }
  };

  const handleDeleteSelected = async () => {
    const ids = confirmDeleteIds || [...selected];
    for (const id of ids) {
      await deleteMutation.mutateAsync(id);
    }
    setSelected(new Set());
    setConfirmDeleteIds(null);
    setConfirmDeleteAll(false);
    toast({ title: `${ids.length} Session(s) gelöscht` });
  };

  const handleDeleteOne = (id) => {
    setConfirmDeleteIds([id]);
  };

  const handleDeleteAll = () => {
    setConfirmDeleteIds(filtered.map(s => s.id));
    setConfirmDeleteAll(true);
  };

  const startEdit = (session) => {
    setEditingId(session.id);
    setEditTitle(session.match_title || '');
  };

  const saveEdit = async () => {
    await updateMutation.mutateAsync({ id: editingId, data: { match_title: editTitle } });
    setEditingId(null);
    toast({ title: 'Gespeichert' });
  };

  return (
    <div className="p-4 lg:p-8 min-h-screen max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-2xl font-grotesk font-bold text-foreground">📚 Session-Archiv</h1>
          {isAdmin && filtered.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="text-xs border-border text-muted-foreground"
              >
                {selected.size === filtered.length ? 'Auswahl aufheben' : 'Alle auswählen'}
              </Button>
              {selected.size > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmDeleteIds([...selected])}
                  className="text-xs gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {selected.size} löschen
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteAll}
                className="text-xs gap-1 opacity-80"
              >
                <Trash className="w-3.5 h-3.5" /> Alle löschen
              </Button>
            </div>
          )}
        </div>

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
            {[
              { key: 'all', label: 'Alle' },
              { key: 'ended', label: '✓ ended' },
              { key: 'active', label: '● active' },
              { key: 'paused', label: '⏸ paused' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === key
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {confirmDeleteIds && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => { setConfirmDeleteIds(null); setConfirmDeleteAll(false); }}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="glass rounded-2xl p-6 max-w-sm w-full border border-destructive/30"
            >
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-6 h-6 text-destructive" />
                <div className="font-grotesk font-bold text-foreground">
                  {confirmDeleteIds.length === 1 ? 'Session löschen?' : `${confirmDeleteIds.length} Sessions löschen?`}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex gap-3">
                <Button variant="destructive" className="flex-1" onClick={handleDeleteSelected}>
                  <Trash2 className="w-4 h-4 mr-2" /> Löschen
                </Button>
                <Button variant="outline" onClick={() => { setConfirmDeleteIds(null); setConfirmDeleteAll(false); }}>
                  Abbrechen
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  className={`glass rounded-xl p-4 border transition-all ${
                    selected.has(session.id)
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Checkbox (admin only) */}
                      {isAdmin && (
                        <button
                          onClick={() => toggleSelect(session.id)}
                          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            selected.has(session.id)
                              ? 'bg-primary border-primary'
                              : 'border-border bg-transparent hover:border-primary/50'
                          }`}
                        >
                          {selected.has(session.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        {editingId === session.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveEdit()}
                              className="flex-1 bg-background border border-primary/40 rounded px-2 py-1 text-sm text-foreground focus:outline-none"
                              autoFocus
                            />
                            <button onClick={saveEdit} className="text-primary hover:text-primary/80">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="font-bold text-foreground truncate">{session.match_title}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {session.started_at
                            ? new Date(session.started_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={
                        session.status === 'ended'
                          ? 'bg-green-500/15 text-green-400'
                          : session.status === 'active'
                            ? 'bg-red-500/15 text-red-400 animate-pulse'
                            : 'bg-yellow-500/15 text-yellow-400'
                      }>
                        {session.status}
                      </Badge>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(session)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                            title="Bearbeiten"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteOne(session.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            title="Löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
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
                        {session.ended_at && session.started_at
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

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-sm">Keine Sessions gefunden</div>
        </div>
      )}
    </div>
  );
}