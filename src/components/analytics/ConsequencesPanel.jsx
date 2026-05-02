/**
 * ConsequencesPanel — Konsequenzen, Fazit-Ableitungen und Empfehlungen
 * Das Herzstück der KI-Analyse für Trainer
 */
import { motion } from 'framer-motion';
import { ChevronRight, Lightbulb, Target, Dumbbell, AlertOctagon, ArrowRight } from 'lucide-react';

const Section = ({ icon: Icon, title, items, color, bg, delay = 0 }) => {
  if (!items?.length) return null;
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}
      className={`rounded-xl border p-4 ${bg}`}>
      <div className={`flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-widest ${color}`}>
        <Icon className="w-3.5 h-3.5" /> {title}
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5 group">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${color} bg-current/10`}>
              {i + 1}
            </div>
            <p className="text-sm text-foreground/85 leading-relaxed flex-1">{item}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default function ConsequencesPanel({ analysis }) {
  if (!analysis) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-5 bg-primary rounded-full" />
        <h3 className="font-grotesk font-bold text-foreground text-sm uppercase tracking-wide">Fazit & Handlungsempfehlungen</h3>
      </div>

      {analysis.tactical_observations && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-xl p-4 border-l-2 border-primary">
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Taktische Beobachtungen
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">{analysis.tactical_observations}</p>
        </motion.div>
      )}

      <Section
        icon={AlertOctagon}
        title="Konsequenzen & Ableitungen"
        items={analysis.consequences}
        color="text-orange-400"
        bg="bg-orange-500/5 border border-orange-500/20"
        delay={0.1}
      />
      <Section
        icon={Lightbulb}
        title="Taktische Empfehlungen"
        items={analysis.recommendations}
        color="text-primary"
        bg="bg-primary/5 border border-primary/20"
        delay={0.15}
      />
      <Section
        icon={Dumbbell}
        title="Trainingsschwerpunkte"
        items={analysis.training_focus}
        color="text-blue-400"
        bg="bg-blue-500/5 border border-blue-500/20"
        delay={0.2}
      />

      {analysis.pressing_analysis && (
        <div className="glass rounded-xl p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Pressing-Analyse</div>
          <p className="text-sm text-foreground/80 leading-relaxed">{analysis.pressing_analysis}</p>
        </div>
      )}
      {analysis.set_pieces_analysis && (
        <div className="glass rounded-xl p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Standardsituationen</div>
          <p className="text-sm text-foreground/80 leading-relaxed">{analysis.set_pieces_analysis}</p>
        </div>
      )}
    </div>
  );
}