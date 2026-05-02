/**
 * SessionReportPDFExport – Export Report als PDF
 * 
 * Nutzt jsPDF + html2canvas
 */
import { useRef } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';

export default function SessionReportPDFExport({ report }) {
  const contentRef = useRef(null);
  const isExporting = useRef(false);

  const handleExport = async () => {
    if (isExporting.current || !contentRef.current) return;
    isExporting.current = true;

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = margin;

      // Title
      doc.setFontSize(20);
      doc.text(report.match_title || 'Match Report', margin, yPos);
      yPos += 10;

      // Metadata
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Datum: ${new Date(report.generated_at).toLocaleDateString('de-DE')}`, margin, yPos);
      yPos += 5;
      doc.text(`Events: ${report.event_count || 0}`, margin, yPos);
      yPos += 10;

      // Summary
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.text('Zusammenfassung:', margin, yPos);
      yPos += 6;
      doc.setFontSize(10);
      const summaryLines = doc.splitTextToSize(report.summary || '', pageWidth - 2 * margin);
      doc.text(summaryLines, margin, yPos);
      yPos += summaryLines.length * 4 + 5;

      // Stats
      doc.setFontSize(12);
      doc.text('Statistik:', margin, yPos);
      yPos += 6;
      doc.setFontSize(10);
      doc.text(`Tore: ${report.goals?.length || 0}`, margin, yPos);
      yPos += 4;
      doc.text(`Karten: ${report.cards?.length || 0}`, margin, yPos);
      yPos += 4;
      doc.text(`Wechsel: ${report.substitutions?.length || 0}`, margin, yPos);
      yPos += 8;

      // Events
      if (report.key_events?.length > 0) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = margin;
        }
        doc.setFontSize(12);
        doc.text('Ereignisse:', margin, yPos);
        yPos += 6;
        doc.setFontSize(9);

        report.key_events.slice(0, 20).forEach(evt => {
          if (yPos > pageHeight - 15) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(`${evt.minute || 0}' - ${evt.description || evt.type}`, margin + 5, yPos);
          yPos += 4;
        });
      }

      // Save
      doc.save(`${report.match_title || 'report'}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      isExporting.current = false;
    }
  };

  return (
    <div ref={contentRef}>
      <Button
        onClick={handleExport}
        disabled={isExporting.current}
        className="gap-2 bg-primary text-primary-foreground"
      >
        {isExporting.current ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileDown className="w-4 h-4" />
        )}
        Als PDF
      </Button>
    </div>
  );
}