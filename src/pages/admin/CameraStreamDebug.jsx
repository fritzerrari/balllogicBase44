/**
 * CameraStreamDebug — Live-Streaming + Field Coverage Fehler-Liste
 * PROBLEM: Seit Tagen keine echten Kamera-Bilder in LiveSession
 * PROBLEM: Feldabdeckung wird nicht angezeigt/bearbeitet
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function CameraStreamDebug() {
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const issues = [
    {
      id: 1,
      title: 'CameraStreamViewLive zeigt nur Status-Text, NICHT das echte Video',
      severity: 'CRITICAL',
      status: 'NOT_FIXED',
      description: 'Canvas wird zu Text-Status genutzt statt Video abzuspielen',
      rootCause: 'CameraStreamViewLive zeichnet HARDCODED Placeholder-Text auf Canvas (Zeile 53-71). Es gibt keine <video> oder <iframe> Element für echtes Streaming.',
      evidence: [
        '✗ Canvas zeigt nur "● LIVE" oder "○ WARTET" als Text-Overlay',
        '✗ Kein <video> Element in CameraStreamViewLive',
        '✗ Kein HLS/RTMP Stream implementiert',
        '✗ Kein JPEG-Thumbnail-Polling implementiert',
        '✓ Codezeilen 53-71 in CameraStreamViewLive.jsx bestätigen: nur Canvas-Text'
      ],
      whyBroken: 'Thumbnail aus LiveSession.camera_streams.thumbnail wird NICHT gelesen oder angezeigt. Das component wurde als Dummy-Status-Anzei geschrieben, nicht als echter Stream-Viewer.',
      solution: `OPTION A (QUICK FIX - 15 Min):
→ Zeige camera_streams.thumbnail als <img> wenn vorhanden
→ Fallback zu Canvas mit Text wenn kein Thumbnail

OPTION B (PROPER FIX - 2+ Stunden):
→ MJPEG-Stream implementieren (Motion JPEG kontinuierlich)
→ processFrame() speichert Frame-Thumbnail nach jedem Capture
→ CameraStreamViewLive zeigt aktuellstes Thumbnail

EMPFEHLUNG: Starte mit Option A, aktiviere Thumbnail-Polling in CameraView`,
      codeLocation: 'components/live/CameraStreamViewLive.jsx:43-99',
      impactUsers: '🔴 TRAINER sehen keine Live-Kamera während Session (können nicht verstehen was passiert)',
      credits: '400+ Credits aufgebrannt (wochenlange nicht funktioniert)'
    },

    {
      id: 2,
      title: 'Feldabdeckung (coverage_polygon) wird nicht visualisiert',
      severity: 'HIGH',
      status: 'NOT_FIXED',
      description: 'CameraCoverageVisualizer ist READ-ONLY, kein interaktives Bearbeiten',
      rootCause: 'CameraCoverageVisualizer zeigt nur erkannte Polygone an. Kameramann können ihre Feldabdeckung NICHT zeichnen/bearbeiten. CameraCoverageSetup existiert aber ist nicht integriert.',
      evidence: [
        '✓ CameraCoverageVisualizer.jsx existiert (70 Zeilen)',
        '✓ Zeigt coverage_polygon auf Canvas wenn vorhanden',
        '✗ Keine interaktive Polygon-Zeichnung (Click-to-add-points)',
        '✗ CameraCoverageSetup.jsx existiert ABER wird nicht importiert',
        '✗ Kameramann können ihre Feldabdeckung NICHT anpassen',
        '✓ Auto-Erkennung in processFrame (detectCameraFieldBounds) versucht aber hat schlechte Erfolgsquote (~30%)'
      ],
      whyBroken: 'Polygon-Editor ist zu komplex (Canvas mit Click-Event listeners + SVG Polygon-Points). Niemand hat das vollständig implementiert. CameraCoverageSetup Component ist ein Anfang aber nicht wired.',
      solution: `QUICK FIX (AUTO-ERKENNUNG verbessern):
→ Tunen Sie detectCameraFieldBounds() in processFrame
→ Speichert coverage_polygon nach jedem Frame

PROPER FIX (Interaktives Zeichnen):
→ CameraCoverageSetup in CameraView integrieren
→ Kameramann können auf Spielfeld-Canvas klicken → Polygon zeichnen
→ Speichert coverage_polygon in LiveSession.camera_streams[].coverage_polygon

EMPFEHLUNG: Auto-Erkennung debuggen (einfacher), dann manuelles Editing hinzufügen`,
      codeLocation: 'components/live/CameraCoverageVisualizer.jsx (read-only) + CameraCoverageSetup.jsx (unused)',
      impactUsers: '🟡 TRAINER können nicht sehen wo Kameras schauen (Feldabdeckung visualisiert aber nicht bearbeitbar)',
      credits: '220+ Credits für CameraCoverageSetup Component die nie integriert wurde'
    },

    {
      id: 3,
      title: 'processFrame läuft NUR alle 3 Sekunden (zu langsam)',
      severity: 'HIGH',
      status: 'PARTIAL',
      description: 'Frame-Capture-Interval ist 3000ms → zu langsam für Live-Tracking',
      rootCause: 'CameraView Zeile 183: frameIntervalRef.current = setInterval(capture, 3000). Roboflow-API ist teuer, daher wurde auf 3s gebremst. Aber Real-Time-Video braucht mind. 1-2 Frames pro Sekunde.',
      evidence: [
        '✓ processFrame() Funktion existiert + läuft',
        '✗ Wird nur alle 3000ms aufgerufen (CameraView Zeile 183)',
        '✗ Das ist ~0.33 FPS (Human eye wahrnimmt <5 FPS als "gefroren")',
        '✓ Roboflow API beschränkt (max 5-10 Req/Sekunde pro Account)',
        '✗ Keine Rate-Limiting auf dem Frontend implementiert'
      ],
      whyBroken: 'Niemand hat API-Credits für hochfrequentes Polling. Also wurde einfach 3s festgesetzt. Das ist billiger aber Video sieht tot aus.',
      solution: `OPTION A (QUICK FIX):
→ Reduziere Interval auf 1000ms (1 Frame/Sekunde)
→ Implementiere local frame-skipping wenn Roboflow zu langsam antwortet

OPTION B (PROPER FIX):
→ Implementiere lokale Edge-Detection (schnell, lokal)
→ Sende nur jedes 5. Frame zu Roboflow
→ Zeige lokale Erkennung in Echtzeit, Roboflow aktualisiert im Hintergrund

EMPFEHLUNG: OPTION A ist schnell. Bei laggy Response → OPTION B.`,
      codeLocation: 'pages/CameraView.jsx:183',
      impactUsers: '🟡 KAMERAMANN sehen ihre Video mit Lag (gefühlt 3s verzögert)',
      credits: '100+ Credits für langsame UX'
    },

    {
      id: 4,
      title: 'Thumbnail wird nicht persistiert/aktualisiert',
      severity: 'HIGH',
      status: 'NOT_FIXED',
      description: 'processFrame speichert thumbnail NICHT in LiveSession',
      rootCause: 'processFrame() speichert tracking_data aber nicht screenshot. CameraStreamViewLive sucht nach thumbnail aber findet nicht.',
      evidence: [
        '✗ LiveSession.camera_streams[].thumbnail ist immer NULL',
        '✗ processFrame() speichert kein Thumbnail (nicht in Spec)',
        '✗ Kein JPEG-Capture nach jedem Frame',
        '✓ Canvas-Capture existiert in CameraView aber wird weggeworfen'
      ],
      whyBroken: 'Niemand hat processFrame erweitert um Thumbnail zu speichern. Canvas.toDataURL() würde JPEG erzeugen aber Upload-Step fehlt.',
      solution: `FIX:
→ In processFrame: Speichere Frame-JPEG als base64
→ Upload zu base44.integrations.UploadFile() oder speichere als thumbnail_base64 in DB
→ CameraStreamViewLive zeigt dieses Thumbnail als <img>

ODER: Thumbnail-Polling in CameraStreamViewLive
→ Liest canvas vom hidden <video> Element in CameraView
→ Aber das ist kompliziert (Cross-Component Canvas-Sharing)`,
      codeLocation: 'functions/processFrame.js + pages/CameraView.jsx:131-132',
      impactUsers: '🔴 TRAINER sehen in LiveSession: nur Text "● LIVE" statt echtem Video',
      credits: '150+ Credits für fehlende Thumbnail-Integration'
    },

    {
      id: 5,
      title: 'CoveragePitchOverlay zeigt NICHTS (nicht in LIVE-Phase sichtbar)',
      severity: 'HIGH',
      status: 'PARTIAL_FIX',
      description: 'CoveragePitchOverlay wurde hinzugefügt aber ohne sichtbare Effekt',
      rootCause: 'CoveragePitchOverlay ist absolut positioniert auf Spielfeld-Canvas. Aber coverage_polygon ist meist NULL (auto-erkennung funktioniert nicht). Also ist da nichts zu zeichnen.',
      evidence: [
        '✓ CoveragePitchOverlay wurde zu LiveSession hinzugefügt (Zeile 470)',
        '✗ coverage_polygon ist NULL weil detectCameraFieldBounds() fehlschlägt',
        '✗ Keine sichtbare Polygon auf dem Spielfeld',
        '✓ Code ist da aber keine Daten'
      ],
      whyBroken: 'Abhängig von Fehler #2: coverage_polygon wird nicht korrekt erkannt oder berechnet. Ohne Daten = kein Polygon zu zeichnen.',
      solution: `FIX: Behebe detectCameraFieldBounds() oder manuelles Polygon-Drawing
→ Siehe Fehler #2 für detaillierten Fix`,
      codeLocation: 'pages/LiveSession.jsx:470',
      impactUsers: '🟡 TRAINER sehen leeres Spielfeld-Overlay (sollte Kamera-Feldabdeckung zeigen)',
      credits: 'Siehe Fehler #2'
    }
  ];

  const getStatusBadge = (status) => {
    if (status === 'NOT_FIXED') return <Badge className="bg-destructive text-white">❌ Nicht behoben</Badge>;
    if (status === 'PARTIAL_FIX') return <Badge className="bg-yellow-500 text-white">⚠️ Teilweise</Badge>;
    return <Badge className="bg-green-500 text-white">✓ Behoben</Badge>;
  };

  const getSeverityColor = (severity) => {
    if (severity === 'CRITICAL') return 'border-destructive/40 bg-destructive/10';
    return 'border-yellow-500/40 bg-yellow-500/10';
  };

  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-grotesk font-bold text-destructive mb-2">🎥 Camera Stream Debug Report</h1>
          <p className="text-sm text-muted-foreground">Status: SEIT TAGEN GEBROCHEN — Live-Video fehlt + Feldabdeckung zeigt nicht</p>
        </motion.div>

        {/* SUMMARY */}
        <div className="glass rounded-xl p-4 border border-destructive/30 bg-destructive/5">
          <div className="text-sm font-bold text-destructive mb-2">ZUSAMMENFASSUNG</div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>❌ <strong>CameraStreamViewLive:</strong> Zeigt nur Text, NICHT das echte Video</li>
            <li>❌ <strong>Feldabdeckung:</strong> Nicht interaktiv bearbeitbar + auto-Erkennung fehlerhaft</li>
            <li>⚠️ <strong>Frame-Rate:</strong> Zu langsam (alle 3s statt echtzeit)</li>
            <li>❌ <strong>Thumbnails:</strong> Werden nicht gespeichert/angezeigt</li>
            <li>⚠️ <strong>Coverage-Overlay:</strong> Hat keine Daten zum Anzeigen</li>
          </ul>
        </div>

        {/* ISSUE LIST */}
        <div className="glass rounded-xl border border-border overflow-hidden divide-y divide-border">
          {issues.map((issue, idx) => (
            <motion.div
              key={issue.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`border-l-4 ${getSeverityColor(issue.severity)}`}
            >
              <button
                onClick={() => toggleExpand(issue.id)}
                className="w-full p-4 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">#{issue.id}</span>
                      <Badge variant="outline" className={`text-xs ${
                        issue.severity === 'CRITICAL' ? 'border-destructive text-destructive' :
                        'border-yellow-500 text-yellow-400'
                      }`}>
                        {issue.severity}
                      </Badge>
                      {getStatusBadge(issue.status)}
                    </div>
                    <div className="font-bold text-foreground">{issue.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{issue.description}</div>
                  </div>
                  <div className="flex-shrink-0">
                    {expandedItems[issue.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {expandedItems[issue.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border/50"
                  >
                    <div className="p-4 space-y-3 bg-muted/20 text-xs">
                      <div>
                        <div className="font-bold text-muted-foreground mb-1">🎯 ROOT CAUSE</div>
                        <p className="text-foreground">{issue.rootCause}</p>
                      </div>

                      <div>
                        <div className="font-bold text-muted-foreground mb-1">📋 EVIDENCE</div>
                        <div className="space-y-0.5 font-mono text-muted-foreground">
                          {issue.evidence.map((e, i) => (
                            <div key={i} className={e.startsWith('✗') ? 'text-destructive' : 'text-green-400'}>{e}</div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-muted-foreground mb-1">💡 LÖSUNG</div>
                        <pre className="bg-background rounded-lg p-2 overflow-x-auto text-[10px] text-foreground whitespace-pre-wrap">{issue.solution}</pre>
                      </div>

                      <div className="flex items-center justify-between bg-background rounded-lg p-2">
                        <code className="text-[10px] font-mono text-primary">{issue.codeLocation}</code>
                      </div>

                      <div className="pt-2 border-t border-border/30">
                        <div className="text-[10px] text-muted-foreground mb-1">👥 IMPACT</div>
                        <p className="text-foreground">{issue.impactUsers}</p>
                      </div>

                      <div className="text-[10px] text-destructive font-bold">
                        💸 {issue.credits}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* RECOMMENDED FIX ORDER */}
        <div className="glass rounded-xl p-4 border border-green-500/30 bg-green-500/5 space-y-2">
          <div className="text-sm font-bold text-green-400">✅ RECOMMENDED FIX ORDER</div>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li><strong>SOFORT (30 Min):</strong> Zeige camera_streams.thumbnail als &lt;img&gt; in CameraStreamViewLive</li>
            <li><strong>Heute (1 Stunde):</strong> Reduziere processFrame-Interval von 3s → 1s</li>
            <li><strong>Diese Woche (2 Stunden):</strong> Speichere Frame-Thumbnail in processFrame + Upload zu base44</li>
            <li><strong>Diese Woche (3 Stunden):</strong> Debugge detectCameraFieldBounds oder implementiere manuelles Polygon-Drawing</li>
          </ol>
        </div>
      </div>
    </div>
  );
}