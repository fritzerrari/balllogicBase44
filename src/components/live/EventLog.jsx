/**
 * EventLog — Live-Event-Feed mit automatisch erkannten Events
 * Tor, Ecke, Foul, Konter — von footballTracker.js detektiert
 */
import { motion, AnimatePresence } from 'framer-motion';

const EVENT_ICONS = {
  goal:       { icon: '⚽', label: 'TOR',    color: 'text-primary border-primary/30 bg-primary/10' },
  corner:     { icon: '📐', label: 'Ecke',   color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  foul:       { icon: '🟥', label: 'Foul',   color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  transition: { icon: '⚡', label: 'Konter', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  chance:     { icon: '🎯', label: 'Chance', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
};

export default function EventLog({ events = [] }) {
  const recent = events.slice(0, 12);

  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center justify-between">
        <span>🔴 Auto-Events</span>
        <span className="text-primary font-mono">{events.length}</span>
      </div>

      {recent.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">
          Events werden automatisch erkannt...
        </div>
      ) : (
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {recent.map((ev, i) => {
              const cfg = EVENT_ICONS[ev.type] || { icon: '📝', label: ev.type, color: 'text-muted-foreground border-border bg-muted' };
              return (
                <motion.div
                  key={ev.id || i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 border text-xs ${cfg.color}`}
                >
                  <span className="flex-shrink-0 text-sm">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{cfg.label}{ev.team ? ` · ${ev.team === 'home' ? 'Heim' : 'Gäste'}` : ''}</div>
                    <div className="opacity-70 truncate">{ev.description}</div>
                  </div>
                  <div className="flex-shrink-0 font-mono opacity-60">{ev.time}</div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}