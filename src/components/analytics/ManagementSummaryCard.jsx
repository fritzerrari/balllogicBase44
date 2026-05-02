/**
 * ManagementSummaryCard — KI-generierte Führungszusammenfassung
 * Kompaktes, hochwertiges Card-Design für das Cockpit
 */
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target } from 'lucide-react';

const ScoreRing = ({ score, size = 80 }) => {
  const radius = (size - 12) / 2;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-grotesk font-bold text-foreground leading-none">{score}</div>
        <div className="text-[9px] text-muted-foreground leading-none mt-0.5">Score</div>
      </div>
    </div>
  );
};

export default function ManagementSummaryCard({ analysis, title = "Management Summary", showScore = true }) {
  if (!analysis) return null;

  const score = analysis.performance_score ?? 0;
  const scoreColor = score >= 70 ? 'text-primary' : score >= 50 ? 'text-yellow-400' : 'text-destructive';
  const scoreBg = score >= 70 ? 'bg-primary/10 border-primary/30' : score >= 50 ? 'bg-yellow-400/10 border-yellow-400/30' : 'bg-destructive/10 border-destructive/30';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 border border-border">
      
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-grotesk font-bold text-foreground text-sm">{title}</h3>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">KI-Analyse · TactIQ</div>
          </div>
        </div>
        {showScore && <ScoreRing score={score} />}
      </div>

      {/* Summary Text */}
      {analysis.management_summary && (
        <div className={`rounded-xl p-4 border mb-4 ${scoreBg}`}>
          <p className="text-sm text-foreground leading-relaxed">{analysis.management_summary}</p>
        </div>
      )}

      {/* SWOT Grid */}
      <div className="grid grid-cols-2 gap-3">
        {analysis.strengths?.length > 0 && (
          <SwotBox icon={CheckCircle2} label="Stärken" items={analysis.strengths} color="text-primary" bg="bg-primary/5 border-primary/20" />
        )}
        {analysis.weaknesses?.length > 0 && (
          <SwotBox icon={TrendingDown} label="Schwachpunkte" items={analysis.weaknesses} color="text-destructive" bg="bg-destructive/5 border-destructive/20" />
        )}
        {analysis.opportunities?.length > 0 && (
          <SwotBox icon={TrendingUp} label="Chancen" items={analysis.opportunities} color="text-blue-400" bg="bg-blue-500/5 border-blue-500/20" />
        )}
        {analysis.threats?.length > 0 && (
          <SwotBox icon={AlertTriangle} label="Risiken" items={analysis.threats} color="text-yellow-400" bg="bg-yellow-500/5 border-yellow-500/20" />
        )}
      </div>
    </motion.div>
  );
}

function SwotBox({ icon: Icon, label, items, color, bg }) {
  return (
    <div className={`rounded-xl p-3 border ${bg}`}>
      <div className={`flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wide ${color}`}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <ul className="space-y-1">
        {items.slice(0, 3).map((item, i) => (
          <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
            <span className={`${color} mt-0.5 flex-shrink-0`}>▸</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}