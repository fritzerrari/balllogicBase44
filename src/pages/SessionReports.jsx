/**
 * SessionReports — Alle generierten Berichte (Post-Session, Spieltag, Vorbericht)
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileText, Loader2, Trash2, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SessionReportCard from '@/components/reports/SessionReportCard';
import GenerateReportButton from '@/components/reports/GenerateReportButton';
import { useToast } from '@/components/ui/use-toast';

const FILTERS = [
  { key: 'all', label: 'Alle' },
  { key: 'post_session', label: 'Spielberichte' },
  { key: 'matchday', label: 'Spieltagsberichte' },
  { key: 'pre_match', label: 'Vorberichte' },
];

export default function SessionReports() {
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['session-reports'],
    queryFn: async () => {
      const allReports = await base44.entities.SessionReport.list('-generated_at', 50);
      // Filter: nur Reports mit match_id (Rest sind inkomplett)
      return allReports.filter(r => r.match_id);
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['liveSessions-ended'],
    queryFn: () => base44.entities.LiveSession.list('-created_date', 10),
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches-all'],
    queryFn: () => base44.entities.Match.list('-date', 20),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['match-events-all'],
    queryFn: () => base44.entities.MatchEvent.list('-created_date', 200),
  });

  const deleteReport = useMutation({
    mutationFn: (id) => base44.entities.SessionReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-reports'] });
      toast({ title: 'Bericht gelöscht' });
    },
  });

  const filtered = filter === 'all' ? reports : reports.filter(r => r.report_type === filter);

  const lastSession = sessions[0];
  const lastSessionEvents = lastSession
    ? events.filter(e => e.session_id === lastSession.id)
    : [];

  return (
    <div className="p-4 lg:p-8 min-h-screen max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-grotesk font-bold text-foreground">Berichte</h1>
          <p className="text-muted-foreground text-xs mt-0.5">{reports.length} generierte Berichte</p>
        </div>
        {lastSession && (
          <GenerateReportButton
            session={lastSession}
            match={matches[0]}
            events={lastSessionEvents}
          />
        )}
      </motion.div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-muted text-muted-foreground border border-transparent hover:text-foreground'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <div className="font-grotesk font-semibold text-foreground mb-1">Noch keine Berichte</div>
          <p className="text-sm text-muted-foreground mb-4">
            Starte eine Live-Session und generiere danach einen Bericht —<br />
            oder klicke oben auf "Bericht" für die letzte Session.
          </p>
          {lastSession && (
            <GenerateReportButton
              session={lastSession}
              match={matches[0]}
              events={lastSessionEvents}
            />
          )}
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report, i) => (
            <motion.div key={report.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="relative group">
              <SessionReportCard report={report} />
              <button
                onClick={() => deleteReport.mutate(report.id)}
                className="absolute top-3 right-10 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}