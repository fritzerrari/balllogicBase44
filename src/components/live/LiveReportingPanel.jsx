/**
 * LiveReportingPanel — Live-Statistiken + KI-Insights während des Spiels
 * Ballbesitz, Tore, Chancen, ECHTZEIT-Taktik-Analysen
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Goal, BarChart3, AlertTriangle, Zap, Lightbulb, Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function LiveReportingPanel({ sessionId, elapsedSeconds, halfTime }) {
  const [stats, setStats] = useState({
    goals_home: 0,
    goals_away: 0,
    possession_home: 50,
    possession_away: 50,
    chances_home: 0,
    chances_away: 0,
    dangerous_situations: 0,
  });
  const [insights, setInsights] = useState([]);
  const [generatingInsight, setGeneratingInsight] = useState(false);

  // Subscribe to SessionState für Live-Updates
  useEffect(() => {
    if (!sessionId) return;
    try {
      const unsubscribe = base44.entities.SessionState.subscribe((event) => {
        if (event.type === 'update' && event.data?.session_id === sessionId) {
          const pct = event.data.possession_percentage || { home: 50, away: 50 };
          setStats(prev => ({
            ...prev,
            possession_home: pct.home ?? 50,
            possession_away: pct.away ?? 50,
          }));
        }
      });
      return () => unsubscribe?.();
    } catch (err) {
      console.warn('[LiveReportingPanel] Subscribe failed:', err.message);
    }
  }, [sessionId]);

  // Events abrufen (Goals, Chances, etc)
  const { data: events = [] } = useQuery({
    queryKey: ['match-events-live', sessionId],
    queryFn: () => base44.entities.MatchEvent.filter({ session_id: sessionId }),
    refetchInterval: 5000, // Poll alle 5s
  });

  // AutoEvents abrufen (Chancen, Dangerous Situations)
  const { data: autoEvents = [] } = useQuery({
    queryKey: ['auto-events-live', sessionId],
    queryFn: () => base44.entities.AutoEvent.filter({ session_id: sessionId }),
    refetchInterval: 5000,
  });

  // Stats kalkulieren
  useEffect(() => {
    const goals_home = events.filter(e => e.type === 'goal' && e.team === 'home').length;
    const goals_away = events.filter(e => e.type === 'goal' && e.team === 'away').length;
    const chances_home = autoEvents.filter(e => e.type === 'ball_in_penalty_area' && e.team === 'home').length;
    const chances_away = autoEvents.filter(e => e.type === 'ball_in_penalty_area' && e.team === 'away').length;
    const dangerous = autoEvents.filter(e => e.type === 'dangerous_situation').length;

    setStats(prev => ({
      ...prev,
      goals_home,
      goals_away,
      chances_home,
      chances_away,
      dangerous_situations: dangerous,
    }));

    // Trigger KI-Insight bei neuen Events (max alle 3 min)
    if ((goals_home + goals_away > (insights.filter(i => i.type === 'goal').length || 0)) || 
        (Math.floor(elapsedSeconds / 180) > Math.floor((elapsedSeconds - 60) / 180))) {
      generateLiveInsight(goals_home, goals_away, chances_home, chances_away);
    }
  }, [events, autoEvents, elapsedSeconds]);

  // Echtzeit-KI-Analysen generieren
  const generateLiveInsight = async (g_home, g_away, c_home, c_away) => {
    if (generatingInsight) return;
    setGeneratingInsight(true);

    try {
      const minute = Math.floor(elapsedSeconds / 60);
      const prompt = `
Analysiere diese LIVE-Spielsituation (${minute}. Minute, ${halfTime}. HZ):
- Score: ${g_home}:${g_away}
- Ballbesitz: ${stats.possession_home.toFixed(0)}% Heim vs ${stats.possession_away.toFixed(0)}% Gäste
- Chancen: ${c_home} Heim | ${c_away} Gäste
- Kritische Momente: ${stats.dangerous_situations}

Gib 1-2 konkrete, kurze TAKTIK-TIPPS für den nächsten Moment (maximal 50 Wörter pro Tipp):
Format: ["Tipp 1", "Tipp 2"]
      `;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            tips: { type: 'array', items: { type: 'string' } },
          },
        },
      }).catch(() => ({ tips: [] }));

      if (result.tips && result.tips.length > 0) {
        const newInsight = {
          id: `insight-${Date.now()}`,
          type: 'tactic',
          minute,
          content: result.tips[0],
          createdAt: Date.now(),
        };
        setInsights(prev => [newInsight, ...prev].slice(0, 5)); // Behalte max 5
      }
    } catch (err) {
      console.warn('[LiveReportingPanel] Insight generation failed:', err);
    } finally {
      setGeneratingInsight(false);
    }
  };

  const minute = Math.floor(elapsedSeconds / 60);

  return (
    <div className="space-y-4">
      {/* SCORE */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-4 border border-border text-center space-y-2"
      >
        <div className="text-sm text-muted-foreground font-medium">{halfTime}. Halbzeit — {minute}'</div>
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-green-400">{stats.goals_home}</div>
            <div className="text-xs text-muted-foreground mt-1">Heimteam</div>
          </div>
          <div className="text-2xl font-bold text-muted-foreground">—</div>
          <div className="text-center">
            <div className="text-4xl font-bold text-red-400">{stats.goals_away}</div>
            <div className="text-xs text-muted-foreground mt-1">Gäste</div>
          </div>
        </div>
      </motion.div>

      {/* POSSESSION BAR */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-4 border border-border space-y-2"
      >
        <div className="flex justify-between text-xs font-bold text-muted-foreground">
          <span>Heimteam {stats.possession_home.toFixed(0)}%</span>
          <span>Ballbesitz</span>
          <span>{stats.possession_away.toFixed(0)}% Gäste</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted/40">
          <div
            className="bg-green-500 transition-all duration-500"
            style={{ width: `${stats.possession_home}%` }}
          />
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${stats.possession_away}%` }}
          />
        </div>
      </motion.div>

      {/* CHANCES */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="glass rounded-xl p-3 border border-green-500/20 bg-green-500/5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-green-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Chancen Heim
          </div>
          <div className="text-2xl font-bold text-green-400">{stats.chances_home}</div>
          <div className="text-[10px] text-muted-foreground">Ball im Strafraum</div>
        </div>

        <div className="glass rounded-xl p-3 border border-red-500/20 bg-red-500/5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Chancen Gäste
          </div>
          <div className="text-2xl font-bold text-red-400">{stats.chances_away}</div>
          <div className="text-[10px] text-muted-foreground">Ball im Strafraum</div>
        </div>
      </motion.div>

      {/* DANGEROUS SITUATIONS */}
      {stats.dangerous_situations > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-3 border border-yellow-500/20 bg-yellow-500/5"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-yellow-400">⚠️ Kritische Momente</div>
              <div className="text-2xl font-bold text-yellow-400 mt-1">{stats.dangerous_situations}</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* KI-ECHTZEIT-INSIGHTS */}
       <AnimatePresence>
         {insights.length > 0 && (
           <motion.div
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             transition={{ delay: 0.3 }}
             className="glass rounded-xl p-3 border border-primary/20 bg-primary/5 space-y-2"
           >
             <div className="flex items-center gap-2">
               <Brain className="w-4 h-4 text-primary flex-shrink-0 animate-pulse" />
               <div className="text-xs font-bold text-primary">💡 KI-Taktik-Analyse</div>
             </div>
             <div className="space-y-2">
               {insights.slice(0, 2).map((insight) => (
                 <motion.div
                   key={insight.id}
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="bg-muted/60 rounded-lg p-2.5 text-xs text-foreground border border-primary/15"
                 >
                   <div className="flex items-start gap-2">
                     <Lightbulb className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                     <div>
                       <p className="text-muted-foreground leading-tight">{insight.content}</p>
                       <div className="text-[9px] text-muted-foreground/60 mt-1">Min {insight.minute}'</div>
                     </div>
                   </div>
                 </motion.div>
               ))}
             </div>
           </motion.div>
         )}
       </AnimatePresence>

      {/* EVENTS TIMELINE */}
       {events.length > 0 && (
         <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.4 }}
           className="glass rounded-xl p-3 border border-border space-y-2"
         >
           <div className="text-xs font-bold text-muted-foreground flex items-center gap-2 mb-2">
             <BarChart3 className="w-3.5 h-3.5" />
             Event-Chronologie
           </div>
           <div className="space-y-1 max-h-48 overflow-y-auto">
             {[...events].reverse().slice(0, 10).map((evt, idx) => (
               <div key={idx} className="flex items-center justify-between text-[10px] py-1 border-b border-border/30 last:border-0">
                 <div className="flex items-center gap-2 flex-1">
                   {evt.type === 'goal' && <Goal className="w-3 h-3 text-yellow-400" />}
                   <span className={evt.team === 'home' ? 'text-green-400' : 'text-red-400'}>
                     {evt.type === 'goal' ? '⚽ TOR' : evt.type === 'yellow_card' ? '🟨 Gelb' : evt.type === 'red_card' ? '🟥 Rot' : '📝 ' + evt.type}
                   </span>
                   {evt.description && <span className="text-muted-foreground text-[9px]">{evt.description.slice(0, 30)}</span>}
                 </div>
                 <span className="text-muted-foreground">{evt.minute}'</span>
               </div>
             ))}
           </div>
         </motion.div>
       )}

      {/* INFO */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-[10px] text-blue-300 text-center">
        Live-Statistiken werden automatisch aktualisiert vom Tracking-System
      </div>
    </div>
  );
}