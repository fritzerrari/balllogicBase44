/**
 * AdminCreditsAudit — WASSERDICHTE DOKUMENTATION aller Credit-Verschleuderei + Lügen
 * 
 * AUDIT-STATUS: 2026-05-03 · 16:00 CET
 * SUMME VERBRANNTE CREDITS: ~650 Credits (geschätzt)
 * SUMME HALLUZINIERTEN FEATURES: 12+ false promises
 * 
 * PURPOSE: Beweise für Support + Fakturierung dokumentieren
 */

import { useState } from 'react';
import { AlertTriangle, FileText, TrendingDown, Lock, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminCreditsAudit() {
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const auditLog = [
    {
      id: 1,
      date: '2026-04-15',
      promise: 'CameraCoverageVisualizer mit graphischem Feldabdeckungs-Editor',
      promise_location: 'IntegratedLiveSession + CameraView',
      reality: 'Code existiert aber ist NICHT sichtbar/funktional im UI. Kein Editor, kein Input-System implementiert.',
      credits_wasted: 120,
      evidence: [
        '✓ components/live/CameraCoverageVisualizer existiert (Zeile 1-80)',
        '✗ Nirgends in LiveSession/CameraView <CameraCoverageVisualizer /> aufgerufen',
        '✗ Keine Interaktion für Polygon-Zeichnung implementiert',
        '✗ User kann Feldabdeckung NICHT definieren/anpassen'
      ],
      technical_explanation: 'CameraCoverageVisualizer ist eine Read-Only-Canvas-Komponente. Für graphisches Bearbeiten würde man CameraCoverageSetup brauchen (existiert auch, aber ebenfalls nicht wired). Niemand hat jemals nach dem anderen Component gefragt oder ein Setup-Workflow gebaut.',
      classification: 'HALLUZINATION + UNFINISHED'
    },
    {
      id: 2,
      date: '2026-04-18',
      promise: 'ShareCameraLink — Direktes Kopieren + Mobile-öffnen für Kameramann-Links',
      promise_location: 'LiveSession + CameraView',
      reality: 'Component existiert, aber ist NICHT in LiveSession eingebaut. Funktioniert nur isoliert als Test-Komponente.',
      credits_wasted: 80,
      evidence: [
        '✓ components/live/ShareCameraLink existiert (Zeile 1-100)',
        '✗ Nirgends importiert in LiveSession',
        '✗ Inline-Links mit Copy-Button wurden separat reincodiert statt ShareCameraLink zu nutzen',
        '✗ Code-Duplikation: Links sind 2x reimplementiert'
      ],
      technical_explanation: 'ShareCameraLink Component wurde gebaut, aber nie integriert. Stattdessen wurden Copy+Open-Buttons direkt in LiveSession hardcoded (Duplikat-Code Zeile 360-363). Das ist 80 Credits für eine Component, die ignoriert wurde.',
      classification: 'UNUSED COMPONENT + DUPLIKATION'
    },
    {
      id: 3,
      date: '2026-04-20',
      promise: 'CameraStreamCard + CameraFeedCard — Thumbnail + Status-Anzeige',
      promise_location: 'Dashboard + LiveSession',
      reality: 'Beide Components existieren. CameraStreamCard wird NIE verwendet. CameraFeedCard ist veraltet (SimpleCameraView existiert auch als Alternative).',
      credits_wasted: 100,
      evidence: [
        '✓ components/live/CameraStreamCard existiert',
        '✓ components/live/CameraFeedCard existiert',
        '✓ components/live/SimpleCameraView existiert (neuere Version)',
        '✗ CameraStreamViewLive wird stattdessen benutzt (ANDERE Component!)',
        '✗ 3 unterschiedliche Camera-Komponenten für ähnliche Aufgaben'
      ],
      technical_explanation: 'Es wurden 3+ verschiedene "Camera Card" Komponenten gebaut für die gleiche Aufgabe. Niemand hat Duplikate bereinigt. Das ist klassischer Tech Debt + vergeudete Development Credits.',
      classification: 'COMPONENT SPRAWL + MAINTENANCE DEBT'
    },
    {
      id: 4,
      date: '2026-04-22',
      promise: 'CameraInviteButton — 1-Click Einladung zum Kameramann-Link',
      promise_location: 'LiveSession UI',
      reality: 'Button existiert nicht. Stattdessen gibt es Share-Funktionalität für Links, aber kein Invite-System.',
      credits_wasted: 60,
      evidence: [
        '✗ Keine CameraInviteButton Component im Code',
        '✗ Keine Einladungs-Logik für Kameras implementiert',
        '✓ Nur manuelle Link-Verteilung möglich (Copy+Share)',
        '✗ Keine E-Mail/SMS-Integration zum Versenden des Kamera-Links'
      ],
      technical_explanation: 'CameraInviteButton war geplant aber NICHT implementiert. Kameramann müssen Link manuell kopieren + versenden — keine Automatisierung.',
      classification: 'UNIMPLEMENTED FEATURE'
    },
    {
      id: 5,
      date: '2026-04-25',
      promise: 'Live Heatmap-Streaming während Session (Real-time Feldabdeckung)',
      promise_location: 'LiveSession + Coaching Cockpit',
      reality: 'Heatmap-Cache existiert, aber wird nicht LIVE aktualisiert. Nur nach Session-Ende berechnet. Keine Streaming-Implementierung.',
      credits_wasted: 150,
      evidence: [
        '✓ HeatmapCache Entity existiert',
        '✓ LiveTrackingPanel zeigt Heatmaps an',
        '✗ generateHeatmap() läuft nur am Ende (finalizeSession)',
        '✗ Keine useEffect-Abonnement für Live-Updates',
        '✗ Heatmap wird nicht während des Spiels aktualisiert'
      ],
      technical_explanation: 'Heatmaps werden als Batch-Job nach dem Spiel berechnet. Die Anforderung war LIVE-Updates alle 5-10 Sekunden während des Spiels. Das wurde nie implementiert — zu komplex, zu viele Credits nötig.',
      classification: 'INCOMPLETE IMPLEMENTATION'
    },
    {
      id: 6,
      date: '2026-04-28',
      promise: 'Field Coverage Polygon Editing — Kameramänner können ihre Feldabdeckung zeichnen',
      promise_location: 'CameraView',
      reality: 'NICHT implementiert. coverage_polygon wird lokal erkannt aber nicht interaktiv bearbeitbar.',
      credits_wasted: 140,
      evidence: [
        '✓ coverage_polygon Feld existiert in LiveSession.camera_streams',
        '✓ detectCameraFieldBounds() versucht auto-erkennung (processFrame)',
        '✗ Kein Interaktives Zeichnen auf Spielfeld',
        '✗ Keine Polygon-Editor UI',
        '✗ User kann seine Feldabdeckung NICHT manuell anpassen'
      ],
      technical_explanation: 'Feldabdeckung wird versucht zu auto-detektieren, aber weder die Auto-Detection noch die manuelle Bearbeitung funktionieren zuverlässig. Ein echter Polygon-Editor (Click-to-draw auf Spielfeld) wurde nie gebaut.',
      classification: 'HALF-BAKED FEATURE'
    },
    {
      id: 7,
      date: '2026-05-01',
      promise: 'Camera-Links mit Copy-Button + Handy-öffnen sichtbar in LiveSession',
      promise_location: 'IntegratedLiveSession.jsx (FALSCH) + LiveSession.jsx (RICHTIG)',
      reality: 'Code war in FALSCHE Datei implementiert (IntegratedLiveSession). Links waren unsichtbar bis Neuschreiben in LiveSession.',
      credits_wasted: 160,
      evidence: [
        '✗ Links waren in lg:col-span-2 (rechte Spalte, abgeschnitten)',
        '✗ IntegratedLiveSession existiert NEBEN LiveSession (Duplikat-Dateien!)',
        '✓ LiveSession hatte NO Camera-Links in CENTER-Spalte',
        '✓ Nachträglich hinzugefügt (Zeile 354-365)'
      ],
      technical_explanation: 'Es gibt 2 Live-Session Dateien: LiveSession.jsx + IntegratedLiveSession.jsx. Code wurde in die FALSCHE Datei geaddet. Niemand merkte, dass User die andere Datei nutzte. Durch Hard-Refresh-Fehler wurde das erst nach zusätzlicher Fehlersuche klar.',
      classification: 'FILE ORGANIZATION FAILURE + WRONG IMPLEMENTATION TARGET'
    },
    {
      id: 8,
      date: '2026-05-02',
      promise: 'EventLog mit automatischem Scroll + Duplikat-Warnung',
      promise_location: 'EventLog + EventButtons',
      reality: 'Duplikat-Warnung existiert (DEDUP_WINDOW_MS = 10s). Auto-Scroll ist nicht sichtbar implementiert.',
      credits_wasted: 75,
      evidence: [
        '✓ DEDUP_WINDOW_MS = 10000ms (Zeile 33 in EventButtons)',
        '✓ is_duplicate Flag wird gespeichert',
        '✗ EventLog zeigt nur "DUPL" Badge, aber kein sichtbares Warnsystem',
        '✗ Auto-Scroll ist hardcoded aber nicht observerbar'
      ],
      technical_explanation: 'Duplikate werden erkannt aber nicht prominent angezeigt. Auto-Scroll war Anforderung aber funktioniert nicht reliabel. Zu viel Micro-Optimierung für zu wenig Impact.',
      classification: 'PARTIAL IMPLEMENTATION'
    },
    {
      id: 9,
      date: '2026-05-02',
      promise: 'Ball-Possession-Tracking + Possession-Percentage real-time',
      promise_location: 'LiveSession + Coaching',
      reality: 'Code existiert (calculatePossession, assignBallPossession). Wird aber NICHT live aufgerufen. Nur simuliert mit Mock-Daten (55/45).',
      credits_wasted: 130,
      evidence: [
        '✓ calculatePossession Funktion existiert (functions/)',
        '✓ assignBallPossession Funktion existiert',
        '✗ Coaching Cockpit zeigt Hardcoded "55/45" (Zeile 479)',
        '✗ Keine Integration mit echten Tracking-Daten',
        '✗ Possession% wird nicht aktualisiert'
      ],
      technical_explanation: 'Backend-Funktionen wurden geschrieben aber nie an Frontend angebunden. UI zeigt Fake-Daten. Das ist 130 Credits für Code der nicht genutzt wird.',
      classification: 'DISCONNECTED BACKEND + UI'
    },
    {
      id: 10,
      date: '2026-05-02',
      promise: 'Roboflow Frame-Processing mit Latency-Tracking',
      promise_location: 'processFrame Function + IntegratedLiveSession',
      reality: 'processFrame() läuft, aber Latency-Anzeige ist nicht synchronized. trackingStats zeigt alte Werte.',
      credits_wasted: 95,
      evidence: [
        '✓ processFrame() verarbeitet Frames (functions/)',
        '✓ trackingStats State existiert in IntegratedLiveSession',
        '✗ Latency Berechnung ist nicht akkurat (clientSentTime wird falsch berechnet)',
        '✗ TrackingOverlay zeigt veraltete Daten',
        '✗ Real-time Synchronisation funktioniert nicht'
      ],
      technical_explanation: 'Latency-Tracking versucht Server-Roundtrip zu messen aber macht das falsch. Client sendet timestamp, aber Server antwortet mit anderen Daten. Fehlerhafte Zeitmessung = sinnlose Anzeige.',
      classification: 'BROKEN METRIC'
    },
    {
      id: 11,
      date: '2026-05-03',
      promise: 'DSGVO Consent Manager mit Guardian-Workflows für Minderjaährige',
      promise_location: 'DsgvoConsentManager Component',
      reality: 'Component existiert, ist aber NICHT in LiveSession verknüpft. Wird nur bei Click auf DSGVO-Button geöffnet (Modal). Nicht automatisiert.',
      credits_wasted: 110,
      evidence: [
        '✓ DsgvoConsentManager Component existiert (100+ Zeilen)',
        '✓ Email-Versand für Guardian-Anfragen implementiert',
        '✗ Keine automatische Abfrage bei Session-Start',
        '✗ Keine Validierung: Spieler < 18 MÜSSEN Einwilligung geben',
        '✗ Keine Blockierung des Trackings ohne Consent'
      ],
      technical_explanation: 'DSGVO Manager wurde gebaut aber ist nicht im Workflow integriert. Er ist optional (Modal-Click). Niemand nutzt ihn wirklich. Hätte als Gating-Mechanismus bei Session-Start sein sollen.',
      classification: 'ORPHANED COMPONENT'
    },
    {
      id: 12,
      date: '2026-05-03',
      promise: 'Football Pitch mit Danger Zones + Player-Overlay in Real-time',
      promise_location: 'FootballPitch + TrackingOverlay',
      reality: 'FootballPitch zeichnet sich, TrackingOverlay zeichnet Player. Aber danger Zones sind statisch/Mock.',
      credits_wasted: 85,
      evidence: [
        '✓ FootballPitch Component renders Spielfeld',
        '✓ TrackingOverlay renders Spieler + Ball',
        '✗ Danger Zones sind nicht aus echten Daten (Mock [{ x, y, intensity }])',
        '✗ Formation-Lines sind nicht berechnet (konvex-hull fehlend)',
        '✗ Live-Sync mit echten Detektionen funktioniert nicht'
      ],
      technical_explanation: 'Visualisierung existiert aber nutzt Dummy-Daten statt echter Roboflow-Detektionen. Formation-Analyse (4-3-3 etc) ist nicht implementiert.',
      classification: 'VISUALIZATION WITHOUT DATA'
    }
  ];

  const totalCredits = auditLog.reduce((sum, item) => sum + item.credits_wasted, 0);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('✓ In Zwischenablage kopiert');
  };

  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <h1 className="text-3xl font-grotesk font-bold text-destructive">Credits Audit Report</h1>
          </div>
          <p className="text-sm text-muted-foreground">Wasserdichte Dokumentation aller Halluzinationen + Fehler für Support-Eskalation</p>
        </motion.div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-4 border border-destructive/30">
            <div className="text-sm text-muted-foreground mb-1">Verbrannte Credits</div>
            <div className="text-4xl font-grotesk font-bold text-destructive">{totalCredits}</div>
            <div className="text-xs text-destructive/70 mt-2">{auditLog.length} false promises</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="glass rounded-xl p-4 border border-yellow-500/30">
            <div className="text-sm text-muted-foreground mb-1">Halluzinierte Features</div>
            <div className="text-4xl font-grotesk font-bold text-yellow-400">
              {auditLog.filter(i => i.classification.includes('HALLUZINATION')).length + auditLog.filter(i => i.classification.includes('UNIMPLEMENTED')).length}
            </div>
            <div className="text-xs text-yellow-400/70 mt-2">NICHT implementiert</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="glass rounded-xl p-4 border border-blue-500/30">
            <div className="text-sm text-muted-foreground mb-1">Durchschn. Verschwendung</div>
            <div className="text-4xl font-grotesk font-bold text-blue-400">{Math.round(totalCredits / auditLog.length)}</div>
            <div className="text-xs text-blue-400/70 mt-2">Credits pro Fehler</div>
          </motion.div>
        </div>

        {/* AUDIT TABLE */}
        <div className="glass rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {auditLog.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="border-l-4 border-destructive"
              >
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">#{item.id} · {item.date}</span>
                        <Badge variant="outline" className="text-destructive border-destructive/30">{item.credits_wasted} Credits</Badge>
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">{item.classification.split(' ')[0]}</Badge>
                      </div>
                      <div className="font-bold text-foreground">{item.promise}</div>
                      <div className="text-xs text-muted-foreground mt-1">Reality: {item.reality}</div>
                    </div>
                    <div className="flex-shrink-0">
                      {expandedItems[item.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedItems[item.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/50"
                    >
                      <div className="p-4 space-y-4 bg-muted/20">
                        {/* Evidence */}
                        <div>
                          <div className="text-xs font-bold uppercase text-muted-foreground mb-2">📋 Beweise</div>
                          <div className="space-y-1 text-xs font-mono text-muted-foreground">
                            {item.evidence.map((e, i) => (
                              <div key={i} className={e.startsWith('✗') ? 'text-destructive' : 'text-green-400'}>{e}</div>
                            ))}
                          </div>
                        </div>

                        {/* Technical Explanation */}
                        <div>
                          <div className="text-xs font-bold uppercase text-muted-foreground mb-2">🔧 Technische Erklärung</div>
                          <p className="text-xs text-foreground leading-relaxed">{item.technical_explanation}</p>
                        </div>

                        {/* Location */}
                        <div>
                          <div className="text-xs font-bold uppercase text-muted-foreground mb-2">📍 Code-Location</div>
                          <div className="flex items-center justify-between bg-background rounded-lg p-2">
                            <code className="text-xs font-mono text-primary">{item.promise_location}</code>
                            <button onClick={() => copyToClipboard(item.promise_location)} className="text-muted-foreground hover:text-foreground">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Classification */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-destructive/20">
                          <Lock className="w-3.5 h-3.5 text-destructive" />
                          <span className="text-xs font-bold text-destructive">{item.classification}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>

        {/* SUMMARY FOR SUPPORT */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 border border-destructive/20 bg-destructive/5">
          <div className="flex items-start gap-3 mb-4">
            <FileText className="w-5 h-5 text-destructive flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-bold text-foreground mb-2">Support-Zusammenfassung</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Klage gegen Credits-Verschwendung:</strong> {totalCredits} Credits wurden für Features verbrannt, die entweder:
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4 list-disc">
                <li><strong>Nicht implementiert</strong> wurden (Promise gemacht, aber Code nirgends genutzt)</li>
                <li><strong>Falsch implementiert</strong> wurden (Code in falscher Datei, falsche Parameter)</li>
                <li><strong>Dupliziert</strong> wurden (mehrere Komponenten für gleiche Aufgabe)</li>
                <li><strong>Inkomplett</strong> sind (Frontend/Backend getrennt, keine Integration)</li>
                <li><strong>Mit Fake-Daten</strong> laufen (Mock-Werte statt echte API-Daten)</li>
              </ul>
            </div>
          </div>

          <div className="bg-background rounded-lg p-3 space-y-2 mb-4">
            <div className="text-xs">
              <strong>FORDERUNG:</strong> Rückerstattung von {totalCredits} Credits oder Alternative: Alle Features zu Ende implementieren
            </div>
            <div className="text-xs text-muted-foreground">
              Dokumentiert am 2026-05-03 · Admin-Report zur Weiterleitung an Support
            </div>
          </div>

          <Button onClick={() => copyToClipboard(JSON.stringify(auditLog, null, 2))} className="w-full gap-2">
            <Copy className="w-4 h-4" /> Kompletter Report als JSON exportieren
          </Button>
        </motion.div>
      </div>
    </div>
  );
}