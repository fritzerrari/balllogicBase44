import { motion } from 'framer-motion';
import { GitBranch } from 'lucide-react';

export default function FormationTimeline({ changes = [], homeTeam, awayTeam, homeFormation, awayFormation }) {
  const allEvents = [
    { minute: 0, team: homeTeam, from_formation: null, to_formation: homeFormation, trigger: 'Anpfiff' },
    { minute: 0, team: awayTeam, from_formation: null, to_formation: awayFormation, trigger: 'Anpfiff' },
    ...changes,
  ].sort((a, b) => a.minute - b.minute);

  if (allEvents.length === 0) {
    return <div className="text-center text-muted-foreground py-8 text-sm">Keine Formations-Änderungen erkannt</div>;
  }

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
      {allEvents.map((ev, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-start gap-3"
        >
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
              ev.team === homeTeam ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {ev.minute}'
            </div>
            {i < allEvents.length - 1 && <div className="w-px h-4 bg-border mt-1" />}
          </div>
          <div className="flex-1 pb-2">
            <div className="text-xs font-medium text-foreground">
              {ev.team}
              {ev.from_formation && (
                <span className="text-muted-foreground font-normal"> · {ev.from_formation} → </span>
              )}
              <span className={ev.team === homeTeam ? 'text-primary' : 'text-red-400'}>{ev.to_formation}</span>
            </div>
            {ev.trigger && <div className="text-[11px] text-muted-foreground mt-0.5">{ev.trigger}</div>}
          </div>
        </motion.div>
      ))}
    </div>
  );
}