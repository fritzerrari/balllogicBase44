import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileText, Download, BarChart3, Calendar, Loader2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

export default function Reports() {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports-all'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date', 50),
  });

  const handleExport = (report) => {
    const content = `TactIQ Report - ${report.match_title}\n\nBallbesitz: ${report.possession_home?.toFixed(0)}% / ${report.possession_away?.toFixed(0)}%\nFormation Heim: ${report.formation_home}\nFormation Auswärts: ${report.formation_away}\nPressing-Index Heim: ${report.pressing_index_home?.toFixed(0)}\nPressing-Index Auswärts: ${report.pressing_index_away?.toFixed(0)}\n\nKI-Analyse:\n${report.ai_summary}\n\nEmpfehlungen:\n${report.ai_recommendations}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.match_title}-Report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 min-h-screen">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <h1 className="text-3xl font-grotesk font-bold text-foreground mb-1">Analyse-Reports</h1>
        <p className="text-muted-foreground">Alle KI-generierten Taktik-Analysen</p>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-grotesk font-semibold text-foreground mb-2">Noch keine Reports</h3>
          <p className="text-muted-foreground text-sm mb-6">Lade ein Video hoch und starte die KI-Analyse um deinen ersten Report zu erstellen.</p>
          <Link to="/matches/new">
            <Button className="bg-primary text-primary-foreground gap-2">Ersten Analysieren</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report, i) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="glass rounded-xl p-5 hover:border-primary/30 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-grotesk font-semibold text-foreground truncate">{report.match_title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {report.generated_at ? format(new Date(report.generated_at), 'dd. MMM yyyy, HH:mm', { locale: de }) : 'Unbekannt'}
                      </span>
                      {report.formation_home && (
                        <span><span className="text-primary font-medium">{report.formation_home}</span> vs <span className="text-red-400 font-medium">{report.formation_away}</span></span>
                      )}
                      {report.possession_home && (
                        <span>Besitz: {report.possession_home?.toFixed(0)}% / {report.possession_away?.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleExport(report)}
                    className="text-muted-foreground hover:text-primary gap-1.5 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Export
                  </Button>
                  <Link to={`/tactics/${report.match_id}`}>
                    <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 gap-1.5 text-xs">
                      Ansehen <ChevronRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}