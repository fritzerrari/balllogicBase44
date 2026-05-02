/**
 * PDFExportModal — Auswahl der PDF-Version und Export
 * Kurz / Mittel / Lang mit Grafik-Option
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, FileDown, Loader2, CheckCircle2, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PDF_VARIANTS = [
  {
    id: 'short',
    label: 'Kurzversion',
    pages: '1–2 Seiten',
    desc: 'Management Summary, Gesamtbewertung, Top-3 Empfehlungen',
    icon: '📄',
    sections: ['summary', 'score', 'top_recommendations'],
  },
  {
    id: 'medium',
    label: 'Standardversion',
    pages: '3–5 Seiten',
    desc: 'Stärken/Schwächen-Analyse, Taktik, Spieler-Übersicht, Trainingsplan',
    icon: '📋',
    sections: ['summary', 'score', 'swot', 'tactics', 'players_overview', 'recommendations'],
  },
  {
    id: 'long',
    label: 'Vollbericht',
    pages: '6–10 Seiten',
    desc: 'Komplettalyse inkl. Grafiken, Spieler-Einzelbewertungen, Gegneranalyse, Pressing, Standards',
    icon: '📚',
    sections: ['all'],
  },
];

export default function PDFExportModal({ analysis, match, playerAnalyses, onClose }) {
  const [selected, setSelected] = useState('medium');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    // Dynamically import jsPDF + html2canvas at runtime
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);

    const variant = PDF_VARIANTS.find(v => v.id === selected);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    const addText = (text, opts = {}) => {
      const { size = 10, bold = false, color = [30, 30, 30], lineH = 6, maxWidth = pageW - 2 * margin } = opts;
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text || '', maxWidth);
      lines.forEach(line => {
        if (y + lineH > pageH - margin) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += lineH;
      });
      y += 2;
    };

    const addSection = (title) => {
      if (y > pageH - 30) { doc.addPage(); y = margin; }
      y += 4;
      doc.setFillColor(34, 197, 94);
      doc.rect(margin, y - 1, 3, 7, 'F');
      addText(title, { size: 12, bold: true, color: [20, 20, 20] });
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y - 1, pageW - margin, y - 1);
      y += 2;
    };

    // ── Title Page ──────────────────────────────────────────
    doc.setFillColor(10, 15, 20);
    doc.rect(0, 0, pageW, 60, 'F');
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text('TactIQ', margin, 22);
    doc.setFontSize(11);
    doc.setTextColor(180, 180, 180);
    doc.text('KI-Analyse Cockpit · Hochprofessioneller Bericht', margin, 30);
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(match?.title || 'Gesamt-Analyse', margin, 44);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de')} · Version: ${variant.label}`, margin, 54);
    y = 70;

    // ── Management Summary ──────────────────────────────────
    if (analysis?.management_summary) {
      addSection('📊 Management Summary');
      if (analysis.performance_score !== undefined) {
        addText(`Gesamtbewertung: ${analysis.performance_score}/100`, { size: 11, bold: true, color: [34, 197, 94] });
      }
      addText(analysis.management_summary, { size: 10, lineH: 5.5 });
    }

    // ── SWOT (medium + long) ─────────────────────────────────
    if (selected !== 'short') {
      if (analysis?.strengths?.length) {
        addSection('✅ Stärken');
        analysis.strengths.forEach(s => addText(`▸ ${s}`, { size: 9.5, lineH: 5 }));
      }
      if (analysis?.weaknesses?.length) {
        addSection('⚠️ Schwachpunkte');
        analysis.weaknesses.forEach(w => addText(`▸ ${w}`, { size: 9.5, lineH: 5 }));
      }
      if (analysis?.opportunities?.length) {
        addSection('💡 Chancen');
        analysis.opportunities.forEach(o => addText(`▸ ${o}`, { size: 9.5, lineH: 5 }));
      }
      if (analysis?.threats?.length) {
        addSection('🚨 Risiken / Bedrohungen');
        analysis.threats.forEach(t => addText(`▸ ${t}`, { size: 9.5, lineH: 5 }));
      }
    }

    // ── Taktik ──────────────────────────────────────────────
    if (selected !== 'short' && analysis?.tactical_observations) {
      addSection('⚽ Taktische Beobachtungen');
      addText(analysis.tactical_observations, { size: 9.5, lineH: 5.5 });
    }

    // ── Konsequenzen ────────────────────────────────────────
    if (analysis?.consequences?.length) {
      addSection('🔄 Konsequenzen & Ableitungen');
      analysis.consequences.forEach((c, i) => addText(`${i + 1}. ${c}`, { size: 9.5, lineH: 5 }));
    }

    // ── Empfehlungen ────────────────────────────────────────
    if (analysis?.recommendations?.length) {
      addSection('🎯 Taktische Empfehlungen');
      analysis.recommendations.forEach((r, i) => addText(`${i + 1}. ${r}`, { size: 9.5, lineH: 5 }));
    }

    // ── Training ────────────────────────────────────────────
    if (selected !== 'short' && analysis?.training_focus?.length) {
      addSection('🏋️ Trainingsschwerpunkte');
      analysis.training_focus.forEach((t, i) => addText(`${i + 1}. ${t}`, { size: 9.5, lineH: 5 }));
    }

    // ── Pressing & Standards (long only) ────────────────────
    if (selected === 'long') {
      if (analysis?.pressing_analysis) {
        addSection('⚡ Pressing-Analyse');
        addText(analysis.pressing_analysis, { size: 9.5, lineH: 5.5 });
      }
      if (analysis?.formation_analysis) {
        addSection('🗂️ Formations-Analyse');
        addText(analysis.formation_analysis, { size: 9.5, lineH: 5.5 });
      }
      if (analysis?.set_pieces_analysis) {
        addSection('📐 Standardsituationen');
        addText(analysis.set_pieces_analysis, { size: 9.5, lineH: 5.5 });
      }

      // Player analyses
      if (playerAnalyses?.length) {
        doc.addPage(); y = margin;
        addSection('👤 Spieler-Einzelanalysen');
        playerAnalyses.forEach(pa => {
          if (pa.management_summary) {
            addText(`▶ ${pa.player_name}`, { size: 11, bold: true });
            addText(pa.management_summary, { size: 9, lineH: 5 });
            if (pa.recommendations?.length) {
              addText(`Empfehlungen: ${pa.recommendations.join(' · ')}`, { size: 9, color: [34, 197, 94], lineH: 5 });
            }
            y += 2;
          }
        });
      }
    }

    // ── Footer ───────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`TactIQ Analytics Cockpit · Seite ${p} von ${totalPages}`, margin, pageH - 8);
      doc.text(new Date().toLocaleDateString('de'), pageW - margin, pageH - 8, { align: 'right' });
    }

    doc.save(`TactIQ_Analyse_${match?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Bericht'}_${variant.id}.pdf`);
    setGenerating(false);
    setDone(true);
    setTimeout(() => { setDone(false); onClose(); }, 1500);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="glass rounded-2xl p-6 w-full max-w-md border border-border"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <FileDown className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-grotesk font-bold text-foreground">PDF-Report erstellen</h2>
              <div className="text-xs text-muted-foreground">Wähle den gewünschten Detailgrad</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Variant selector */}
        <div className="space-y-2 mb-5">
          {PDF_VARIANTS.map(v => (
            <button key={v.id} onClick={() => setSelected(v.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selected === v.id
                  ? 'bg-primary/10 border-primary/40 text-foreground'
                  : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:border-border/80'
              }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{v.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-grotesk font-semibold text-sm">{v.label}</span>
                    <span className="text-[10px] text-muted-foreground">({v.pages})</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{v.desc}</p>
                </div>
                {selected === v.id && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
              </div>
            </button>
          ))}
        </div>

        {/* Options */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl mb-5">
          <button onClick={() => setIncludeCharts(s => !s)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              includeCharts ? 'bg-primary border-primary' : 'border-border'
            }`}>
            {includeCharts && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
          </button>
          <div>
            <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5" /> Grafiken einbetten
            </div>
            <div className="text-xs text-muted-foreground">Charts und Visualisierungen im PDF</div>
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={generating || done}
          className="w-full bg-primary text-primary-foreground gap-2 h-11">
          {done
            ? <><CheckCircle2 className="w-4 h-4" /> Erstellt!</>
            : generating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Erstelle PDF...</>
            : <><FileDown className="w-4 h-4" /> PDF erstellen</>}
        </Button>
      </motion.div>
    </motion.div>
  );
}