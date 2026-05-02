/**
 * SessionReportCard — Zeigt einen Sitzungsbericht kompakt an
 */
import { FileText, Goal, CreditCard, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

const TYPE_CONFIG = {
  post_session: { label: 'Spielbericht', color: 'bg-primary/15 text-primary border-primary/30' },
  matchday:     { label: 'Spieltagsbericht', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  pre_match:    { label: 'Vorbericht', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
};

export default function SessionReportCard({ report }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CONFIG[report.report_type] || TYPE_CONFIG.post_session;
  const date = report.generated_at ? new Date(report.generated_at).toLocaleDateString('de', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="glass rounded-xl p-4 border border-border hover:border-primary/20 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-grotesk font-semibold text-foreground truncate">{report.match_title}</span>
              <Badge className={`text-[10px] border ${cfg.color}`}>{cfg.label}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{date}</div>
            {/* Quick stats */}
            <div className="flex items-center gap-3 mt-2 text-xs">
              {(report.goals?.length > 0) && (
                <span className="flex items-center gap-1 text-primary font-medium">⚽ {report.goals.length} Tor{report.goals.length !== 1 ? 'e' : ''}</span>
              )}
              {(report.cards?.length > 0) && (
                <span className="flex items-center gap-1 text-yellow-400 font-medium">🟨 {report.cards.length} Karte{report.cards.length !== 1 ? 'n' : ''}</span>
              )}
              {(report.substitutions?.length > 0) && (
                <span className="flex items-center gap-1 text-blue-400 font-medium">🔄 {report.substitutions.length} Wechsel</span>
              )}
              {(!report.goals?.length && !report.cards?.length && !report.substitutions?.length) && (
                <span className="text-muted-foreground">{report.event_count || 0} Ereignisse</span>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => setExpanded(s => !s)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 pt-1">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && report.summary && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{report.summary}</p>
        </div>
      )}
    </div>
  );
}