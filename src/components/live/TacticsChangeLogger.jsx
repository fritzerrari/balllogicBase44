/**
 * TacticsChangeLogger — Dokumentiere Taktik-Änderungen während Spiel
 * Formation, Spielerauswechslungen, taktische Anpassungen
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Edit3, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TacticsChangeLogger({ sessionId, elapsedSeconds }) {
  const [changes, setChanges] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newChange, setNewChange] = useState('');
  const [saving, setSaving] = useState(false);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleAddChange = async () => {
    if (!newChange.trim()) return;

    setSaving(true);
    try {
      // Speichere als TacticsBoard oder als Note
      const change = {
        session_id: sessionId,
        minute: Math.floor(elapsedSeconds / 60),
        timestamp_ms: Date.now(),
        description: newChange,
        type: 'tactical_change',
      };

      // Erstelle als MatchEvent für Tracking
      await base44.entities.MatchEvent.create({
        session_id: sessionId,
        type: 'note',
        description: `[TAKTIK] ${newChange}`,
        timestamp_ms: Date.now(),
        minute: change.minute,
        elapsed_seconds: elapsedSeconds,
        source: 'coach',
      });

      setChanges(prev => [{ ...change, id: Date.now() }, ...prev]);
      setNewChange('');
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save tactic change:', e);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    setChanges(prev => prev.filter(c => c.id !== id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-3 border border-border space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-muted-foreground uppercase">Taktik-Log</span>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          size="sm"
          className="h-6 px-2 text-[10px] gap-1 bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20"
        >
          <Plus className="w-3 h-3" />
          Notiz
        </Button>
      </div>

      {/* Input Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 pt-2 border-t border-border/30"
          >
            <Input
              value={newChange}
              onChange={(e) => setNewChange(e.target.value)}
              placeholder="z.B. '4-3-3 zu 5-3-2', 'Wechsel: Stürmer verletzt'"
              className="text-xs h-8"
              onKeyDown={(e) => e.key === 'Enter' && handleAddChange()}
            />
            <div className="flex gap-1">
              <Button
                onClick={handleAddChange}
                disabled={saving || !newChange.trim()}
                size="sm"
                className="flex-1 h-7 text-[10px] bg-green-600 hover:bg-green-700"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓ Speichern'}
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-[10px]"
              >
                Abbrechen
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {changes.length === 0 ? (
          <div className="text-[10px] text-muted-foreground text-center py-2">
            Keine Taktik-Änderungen dokumentiert
          </div>
        ) : (
          changes.map((change) => (
            <motion.div
              key={change.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-muted/30 hover:bg-muted/50 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground truncate">{change.description}</div>
                <div className="text-[9px] text-muted-foreground">{formatTime(change.minute * 60)}'</div>
              </div>
              <Button
                onClick={() => handleDelete(change.id)}
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-muted-foreground hover:text-red-400"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </motion.div>
          ))
        )}
      </div>

      <div className="text-[8px] text-muted-foreground/60 text-center">
        Alle Änderungen werden im Match-Report gespeichert
      </div>
    </motion.div>
  );
}