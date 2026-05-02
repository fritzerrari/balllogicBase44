/**
 * EventButtons — Shared Event-Tapping Component
 * Verwendet in: CameraView (Kamera-Assistent) + LiveSession (Trainer) + CoachingCockpit
 * 
 * Deduplizierung: Events innerhalb von 10s vom gleichen Typ werden als Duplikat markiert.
 * Nachträgliche Korrektur: editierbar über den Event-Log.
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Check, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react';

export const ALL_EVENTS = [
  { key: 'goal',         label: 'TOR',         icon: '⚽', color: 'bg-primary text-primary-foreground', team: true },
  { key: 'chance',       label: 'Chance',       icon: '🎯', color: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40', team: true },
  { key: 'corner',       label: 'Ecke',         icon: '📐', color: 'bg-blue-500/20 text-blue-300 border border-blue-500/40', team: true },
  { key: 'yellow_card',  label: 'Gelb',         icon: '🟨', color: 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/40', team: true },
  { key: 'red_card',     label: 'Rot',          icon: '🟥', color: 'bg-red-500/20 text-red-300 border border-red-500/40', team: true },
  { key: 'foul',         label: 'Foul',         icon: '⛔', color: 'bg-orange-500/20 text-orange-300 border border-orange-500/40', team: true },
  { key: 'freekick',     label: 'Freistoß',     icon: '🦵', color: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40', team: true },
  { key: 'substitution', label: 'Wechsel',      icon: '🔄', color: 'bg-purple-500/20 text-purple-300 border border-purple-500/40', team: true },
  { key: 'transition',   label: 'Konter',       icon: '⚡', color: 'bg-pink-500/20 text-pink-300 border border-pink-500/40', team: true },
  { key: 'offside',      label: 'Abseits',      icon: '🚩', color: 'bg-gray-500/20 text-gray-300 border border-gray-500/40', team: true },
];

// Deduplizierungs-Fenster: 10 Sekunden
const DEDUP_WINDOW_MS = 10000;

/**
 * @param {object} props
 * @param {string} props.sessionId
 * @param {string} props.matchId - Match-ID (optional, aber wichtig für Reporting!)
 * @param {string} props.matchTitle
 * @param {string} props.source - 'coach' | 'camera_1' | 'camera_2' etc.
 * @param {number} props.elapsedSeconds - Spielzeit in Sekunden
 * @param {boolean} props.compact - kleine Version (für Mobile)
 * @param {string[]} props.visibleEvents - welche Buttons zeigen (undefined = alle)
 */
export default function EventButtons({ sessionId, matchId, matchTitle, source = 'coach', elapsedSeconds = 0, compact = false, visibleEvents, onEventLogged }) {
  const [localEvents, setLocalEvents] = useState([]);
  const [flash, setFlash] = useState(null);
  const [showTeamPicker, setShowTeamPicker] = useState(null); // { evt, resolve }
  const [showLog, setShowLog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [correctionNote, setCorrectionNote] = useState('');
  const recentRef = useRef({}); // key: eventType, value: timestamp

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const checkDuplicate = (type, team = 'unknown', minute = 0) => {
    // Key: type + team + minute (robust gegen false positives)
    const key = `${type}_${team}_${minute}`;
    const now = Date.now();
    const last = recentRef.current[key];
    if (last && now - last < DEDUP_WINDOW_MS) return true;
    recentRef.current[key] = now;
    return false;
  };

  const tapEvent = async (evt, team = 'unknown') => {
    // VALIDATION: Session erforderlich
    if (!sessionId) {
      setFlash({ key: evt.key, isDuplicate: false, message: '❌ Keine aktive Session' });
      setTimeout(() => setFlash(null), 1200);
      return;
    }

    const gameMinute = Math.floor(elapsedSeconds / 60);
    const isDuplicate = checkDuplicate(evt.key, team, gameMinute);
    const now = Date.now();

    const eventData = {
      session_id: sessionId,
      match_id: matchId || null,
      match_title: matchTitle || '',
      type: evt.key,
      team,
      minute: gameMinute,
      elapsed_seconds: elapsedSeconds,
      description: `${evt.icon} ${evt.label}${team !== 'unknown' ? ` (${team === 'home' ? 'Heim' : 'Gäste'})` : ''}`,
      source,
      timestamp_ms: now,
      is_duplicate: isDuplicate,
      corrected: false,
    };

    // Lokal speichern für sofortiges UI-Feedback
    const localId = `local-${now}`;
    const localEntry = { ...eventData, id: localId, time: formatTime(elapsedSeconds) };
    setLocalEvents(prev => [localEntry, ...prev].slice(0, 50));

    // Flash zeigt Duplikat-Warnung an
    setFlash({ key: evt.key, isDuplicate, message: isDuplicate ? '⚠️ Duplikat erkannt' : '✓ Gespeichert' });
    setTimeout(() => setFlash(null), isDuplicate ? 1200 : 800);

    // In DB speichern (non-blocking)
    base44.entities.MatchEvent.create(eventData).catch(() => {});
    if (onEventLogged) onEventLogged();
  };

  const handleEventClick = (evt) => {
    if (evt.team) {
      setShowTeamPicker(evt);
    } else {
      tapEvent(evt, 'unknown');
    }
  };

  const handleTeamSelect = (team) => {
    if (showTeamPicker) {
      tapEvent(showTeamPicker, team);
      setShowTeamPicker(null);
    }
  };

  const handleCorrection = async (ev) => {
    if (!correctionNote.trim()) return;
    // Update lokal
    setLocalEvents(prev => prev.map(e => e.id === ev.id
      ? { ...e, corrected: true, correction_note: correctionNote }
      : e
    ));
    // Update DB falls echte ID
    if (ev.id && !ev.id.startsWith('local-')) {
      await base44.entities.MatchEvent.update(ev.id, { corrected: true, correction_note: correctionNote });
    }
    setEditingEvent(null);
    setCorrectionNote('');
  };

  const visibleBtns = visibleEvents
    ? ALL_EVENTS.filter(e => visibleEvents.includes(e.key))
    : ALL_EVENTS;

  return (
    <div className="space-y-3">
      {/* Team Picker Overlay */}
      <AnimatePresence>
        {showTeamPicker && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowTeamPicker(null)}
          >
            <div className="glass rounded-2xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-4">
                <div className="text-3xl mb-1">{showTeamPicker?.icon || '⚽'}</div>
                <div className="font-grotesk font-bold text-foreground">{showTeamPicker?.label || 'Event'}</div>
                <div className="text-xs text-muted-foreground mt-1">Für welches Team?</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleTeamSelect('home')}
                  className="py-4 rounded-xl bg-primary/15 border border-primary/30 text-primary font-bold text-sm hover:bg-primary/25 transition-all active:scale-95">
                  🏠 Heim
                </button>
                <button onClick={() => handleTeamSelect('away')}
                  className="py-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-sm hover:bg-red-500/25 transition-all active:scale-95">
                  ✈️ Gäste
                </button>
              </div>
              <button onClick={() => { tapEvent(showTeamPicker, 'unknown'); setShowTeamPicker(null); }}
                className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                Überspringen
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Flash */}
      <AnimatePresence>
        {flash && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`rounded-xl p-2.5 text-center text-sm font-bold flex items-center justify-center gap-2 ${
              flash.isDuplicate
                ? 'bg-yellow-500/15 border border-yellow-500/30 text-yellow-400'
                : 'bg-primary/15 border border-primary/30 text-primary'
            }`}>
            {flash.isDuplicate ? (
              <>⚠️ {flash.message}</>
            ) : (
              <><Check className="w-4 h-4" /> {flash.message}</>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buttons Grid */}
      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
        {visibleBtns.map(evt => (
          <button
            key={evt.key}
            onClick={() => handleEventClick(evt)}
            disabled={!sessionId}
            className={`${compact ? 'py-3 text-xs' : 'py-4 text-sm'} rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-95 select-none touch-manipulation ${evt.color} ${!sessionId ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={!sessionId ? 'Starten Sie zuerst eine Live-Session' : ''}
          >
            <span className={compact ? 'text-xl' : 'text-2xl'}>{evt.icon}</span>
            <span>{evt.label}</span>
          </button>
        ))}
      </div>

      {/* Event Log Toggle */}
      {localEvents.length > 0 && (
        <div>
          <button onClick={() => setShowLog(s => !s)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors">
            <span>📋 {localEvents.length} Events aufgezeichnet</span>
            {showLog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <AnimatePresence>
            {showLog && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="bg-muted/50 rounded-xl mt-1 max-h-64 overflow-y-auto divide-y divide-border/30">
                  {localEvents.map(ev => (
                    <div key={ev.id} className="px-3 py-2">
                      {editingEvent?.id === ev.id ? (
                        <div className="space-y-2">
                          <div className="text-xs text-foreground font-medium">Korrektur für: {ev.description}</div>
                          <input
                            value={correctionNote}
                            onChange={e => setCorrectionNote(e.target.value)}
                            placeholder="Was war falsch? (z.B. Tor zurückgenommen)"
                            className="w-full bg-background border border-input rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleCorrection(ev)}
                              className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                              Speichern
                            </button>
                            <button onClick={() => setEditingEvent(null)}
                              className="px-3 py-1.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-primary flex-shrink-0">{ev.time}</span>
                          <span className="text-sm">{ev.icon || ''}</span>
                          <span className="text-xs text-foreground flex-1">{ev.description}</span>
                          {ev.is_duplicate && (
                            <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">DUPL</span>
                          )}
                          {ev.corrected && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded" title={ev.correction_note}>KORR</span>
                          )}
                          <span className="text-[9px] text-muted-foreground flex-shrink-0">{ev.source}</span>
                          <button onClick={() => { setEditingEvent(ev); setCorrectionNote(''); }}
                            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}