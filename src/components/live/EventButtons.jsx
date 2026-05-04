/**
 * EventButtons — Event-Logger mit korrektem MatchEvent-Speichern
 * KRITIK: Vorher wurde nur lokales Array aktualisiert, MatchEvent NICHT gespeichert!
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronDown, Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EVENT_TYPES = {
  goal: { emoji: '⚽', label: 'Tor', color: 'text-yellow-400', icon: '⚽', needsTeam: true },
  chance: { emoji: '🎯', label: 'Chance', color: 'text-blue-400', icon: '🎯', needsTeam: true },
  corner: { emoji: '🚩', label: 'Ecke', color: 'text-purple-400', icon: '🚩', needsTeam: true },
  yellow_card: { emoji: '🟨', label: 'Gelbe Karte', color: 'text-yellow-500', icon: '🟨', needsTeam: true },
  red_card: { emoji: '🟥', label: 'Rote Karte', color: 'text-red-500', icon: '🟥', needsTeam: true },
  foul: { emoji: '⚔️', label: 'Foul', color: 'text-red-400', icon: '⚔️', needsTeam: true },
  freekick: { emoji: '🎪', label: 'Freistoß', color: 'text-orange-400', icon: '🎪', needsTeam: true },
  substitution: { emoji: '🔄', label: 'Wechsel', color: 'text-green-400', icon: '🔄', needsTeam: true },
  offside: { emoji: '📍', label: 'Abseits', color: 'text-blue-300', icon: '📍', needsTeam: true },
  note: { emoji: '📝', label: 'Notiz', color: 'text-gray-400', icon: '📝', needsTeam: false },
};

export const ALL_EVENTS = Object.entries(EVENT_TYPES).map(([key, cfg]) => ({ key, ...cfg }));

export default function EventButtons({
  sessionId,
  matchId,
  matchTitle,
  source = 'coach',
  elapsedSeconds = 0,
  compact = false,
  onEventLogged = null,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState([]);
  const [saving, setSaving] = useState(false);

  const minute = Math.floor(elapsedSeconds / 60);

  // Sichere Event in DB
  const saveEvent = async (type, team, desc) => {
    if (!sessionId) {
      console.warn('[EventButtons] No sessionId');
      return;
    }

    setSaving(true);
    try {
      console.log(`[EventButtons] 📝 Saving event: type=${type}, team=${team}, minute=${minute}`);

      const event = await base44.entities.MatchEvent.create({
        session_id: sessionId,
        match_id: matchId || '',
        match_title: matchTitle || 'Unknown',
        type,
        team: team || 'unknown',
        minute,
        elapsed_seconds: elapsedSeconds,
        description: desc,
        source,
        timestamp_ms: Date.now(),
        is_duplicate: false,
        corrected: false,
      });

      console.log(`✅ Event saved: id=${event.id}`);

      // Add to local list
      setEvents(prev => [event, ...prev]);

      // Callback
      if (onEventLogged) onEventLogged(event);

      // Reset
      setShowTeamModal(false);
      setDescription('');
    } catch (err) {
      console.error('[EventButtons] Save failed:', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEventClick = async (type) => {
    setSelectedEventType(type);
    const cfg = EVENT_TYPES[type];

    if (!cfg.needsTeam) {
      // Direct save für Notes
      await saveEvent(type, 'unknown', description);
    } else {
      // Show team selector
      setShowTeamModal(true);
    }
  };

  const handleTeamSelect = async (team) => {
    if (selectedEventType) {
      await saveEvent(selectedEventType, team, description);
    }
  };

  return (
    <div className="space-y-3">
      {/* Grid von Event-Buttons */}
      <div className={`grid ${compact ? 'grid-cols-3 gap-2' : 'grid-cols-2 gap-3'}`}>
        {Object.entries(EVENT_TYPES).map(([type, cfg]) => (
          <button
            key={type}
            onClick={() => handleEventClick(type)}
            disabled={saving}
            className={`p-3 rounded-lg border transition-all active:scale-95 ${
              compact
                ? 'text-xs border-border hover:border-primary/50'
                : 'text-sm border-border hover:border-primary/50'
            } ${cfg.color} bg-muted/30 hover:bg-muted/50`}
          >
            <div className={compact ? 'text-lg' : 'text-2xl mb-1'}>{cfg.emoji}</div>
            <div className="font-bold text-xs">{cfg.label}</div>
          </button>
        ))}
      </div>

      {/* Team-Modal */}
      <AnimatePresence>
        {showTeamModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-card rounded-xl p-6 max-w-sm w-full space-y-4">
              <h3 className="font-bold text-lg">Welches Team?</h3>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleTeamSelect('home')}
                  disabled={saving}
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700 font-bold"
                >
                  🏠 Heimteam
                </Button>
                <Button
                  onClick={() => handleTeamSelect('away')}
                  disabled={saving}
                  className="flex-1 h-12 bg-red-600 hover:bg-red-700 font-bold"
                >
                  ✈️ Gäste
                </Button>
              </div>
              <Button
                onClick={() => setShowTeamModal(false)}
                variant="outline"
                className="w-full"
              >
                Abbrechen
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event-Log */}
      {events.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          <div className="text-xs font-bold text-muted-foreground">Protokoll ({events.length})</div>
          {events.map((evt, idx) => {
            const cfg = EVENT_TYPES[evt.type];
            return (
              <motion.div
                key={evt.id || idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-xs bg-muted/40 rounded p-2"
              >
                <span className="font-bold">{cfg.emoji}</span>
                <span className="flex-1 text-muted-foreground">
                  {evt.minute}' | {evt.type} | {evt.team}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}