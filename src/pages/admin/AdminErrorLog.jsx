/**
 * AdminErrorLog — Fehler-Tracker + Behebungs-Status
 * Dokumentiert alle bekannten Bugs + Fixes + Workarounds
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

export default function AdminErrorLog() {
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const errors = [
    {
      id: 1,
      date: '2026-05-03 10:52',
      title: 'AdminCreditsAudit Crash — Invalid JSX',
      severity: 'critical',
      status: 'fixed',
      error: 'Objects are not valid as a React child (found: object with keys {allItems})',
      cause: 'Syntax-Fehler: {{ allItems: auditLog.length }} statt {auditLog.length}',
      fix: '✓ Korrigiert zu: {auditLog.length}',
      location: 'pages/admin/AdminCreditsAudit.jsx:26'
    },
    {
      id: 2,
      date: '2026-05-03 09:30',
      title: 'Camera-Links nicht sichtbar in LiveSession',
      severity: 'high',
      status: 'fixed',
      error: 'Handy-Links werden NICHT angezeigt',
      cause: 'Code wurde in IntegratedLiveSession codiert statt in LiveSession.jsx',
      fix: '✓ Links jetzt in LiveSession CENTER-Spalte sichtbar (Zeile 354-365)',
      location: 'pages/LiveSession.jsx:354-365'
    },
    {
      id: 3,
      date: '2026-05-03 08:00',
      title: 'CameraCoverageVisualizer nicht sichtbar',
      severity: 'high',
      status: 'partial',
      error: 'Feldabdeckungs-Visualisierung fehlt',
      cause: 'Component existiert aber wird nicht importiert/angezeigt',
      fix: '⚠️ READ-ONLY CoveragePitchOverlay jetzt in LIVE-Phase aktiv. Interaktives Polygon-Editing NICHT implementiert.',
      location: 'pages/LiveSession.jsx:470 + components/pitch/CoveragePitchOverlay.jsx'
    },
    {
      id: 4,
      date: '2026-05-03 15:00',
      title: 'Handy-Link Copy-Button zu simpel',
      severity: 'medium',
      status: 'fixed',
      error: 'Kameramann können Link nicht direkt teilen (WhatsApp/SMS)',
      cause: 'Nur Copy-Button existierte, keine Share-Integration',
      fix: '✓ WhatsApp-Share Button hinzugefügt (💬 Icon). navigator.share() API als Fallback.',
      location: 'pages/LiveSession.jsx:358-368'
    },
    {
      id: 5,
      date: '2026-05-02 14:20',
      title: 'CameraView benötigt Login',
      severity: 'critical',
      status: 'fixed',
      error: 'Kameramann können nicht auf /cam zugreifen ohne Login',
      cause: 'Route war in AuthenticatedApp verschachtelt',
      fix: '✓ CameraView ist bereits PUBLIC ROUTE (außerhalb AuthenticatedApp)',
      location: 'App.jsx:113 (public route)'
    },
    {
      id: 6,
      date: '2026-05-01 11:30',
      title: 'TacticsBoard funktioniert nicht',
      severity: 'high',
      status: 'unknown',
      error: 'TacticsBoard lädt aber ist möglicherweise fehlerhaft',
      cause: 'Nicht getestet nach neuesten Änderungen',
      fix: '⏳ Code sieht OK aus. Warte auf User-Feedback zu echtem Problem.',
      location: 'pages/TacticsBoard.jsx'
    },
    {
      id: 7,
      date: '2026-04-28 16:45',
      title: 'Ball-Possession Mock-Daten statt echte',
      severity: 'medium',
      status: 'open',
      error: 'Coaching Cockpit zeigt Hardcoded "55/45" Possession',
      cause: 'Backend-Funktionen (calculatePossession) nicht angebunden',
      fix: '⏳ UNIXMPL: Funktionen existieren aber Integration fehlt',
      location: 'pages/LiveSession.jsx:479'
    },
    {
      id: 8,
      date: '2026-04-25 09:15',
      title: 'Camera-Links Duplikat-Code',
      severity: 'low',
      status: 'open',
      error: 'ShareCameraLink Component existiert aber wird nicht genutzt',
      cause: 'Code wurde inline statt mit Component geschrieben',
      fix: '⏳ Refactoring nötig: LiveSession sollte ShareCameraLink nutzen',
      location: 'components/live/ShareCameraLink.jsx (unused)'
    },
    {
      id: 9,
      date: '2026-05-03 14:00',
      title: 'Two LiveSession Files (Duplikat)',
      severity: 'medium',
      status: 'open',
      error: 'LiveSession.jsx + IntegratedLiveSession.jsx beide existieren',
      cause: 'Alte Datei (IntegratedLiveSession) wurde nicht gelöscht',
      fix: '⏳ TODO: IntegratedLiveSession.jsx sollte gelöscht werden oder dokumentiert',
      location: 'pages/LiveSession.jsx vs pages/IntegratedLiveSession.jsx'
    },
    {
      id: 10,
      date: '2026-05-02 10:20',
      title: 'EventButtons Duplikat-Warnung nicht prominent',
      severity: 'low',
      status: 'open',
      error: 'Events werden als Duplikat erkannt aber nicht sichtbar markiert',
      cause: 'DEDUP_WINDOW_MS=10s funktioniert aber UI-Feedback fehlt',
      fix: '⏳ TODO: Event-Flash mit gelber Warnung hinzufügen',
      location: 'components/live/EventButtons.jsx:33'
    }
  ];

  const stats = {
    total: errors.length,
    fixed: errors.filter(e => e.status === 'fixed').length,
    open: errors.filter(e => e.status === 'open').length,
    partial: errors.filter(e => e.status === 'partial').length,
    unknown: errors.filter(e => e.status === 'unknown').length,
  };

  const getStatusIcon = (status) => {
    if (status === 'fixed') return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    if (status === 'open') return <AlertTriangle className="w-4 h-4 text-red-400" />;
    if (status === 'partial') return <Clock className="w-4 h-4 text-yellow-400" />;
    return <Zap className="w-4 h-4 text-blue-400" />;
  };

  const getSeverityColor = (severity) => {
    if (severity === 'critical') return 'border-destructive/40 bg-destructive/10';
    if (severity === 'high') return 'border-red-500/40 bg-red-500/10';
    if (severity === 'medium') return 'border-yellow-500/40 bg-yellow-500/10';
    return 'border-blue-500/40 bg-blue-500/10';
  };

  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-grotesk font-bold text-foreground mb-2">🐛 Error Log & Fixes</h1>
          <p className="text-sm text-muted-foreground">Alle bekannten Fehler, Status + Behebungen</p>
        </motion.div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="glass rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Gesamt</div>
          </div>
          <div className="glass rounded-lg p-3 text-center border-l-4 border-green-400">
            <div className="text-2xl font-bold text-green-400">{stats.fixed}</div>
            <div className="text-xs text-muted-foreground">Behoben</div>
          </div>
          <div className="glass rounded-lg p-3 text-center border-l-4 border-red-400">
            <div className="text-2xl font-bold text-red-400">{stats.open}</div>
            <div className="text-xs text-muted-foreground">Offen</div>
          </div>
          <div className="glass rounded-lg p-3 text-center border-l-4 border-yellow-400">
            <div className="text-2xl font-bold text-yellow-400">{stats.partial}</div>
            <div className="text-xs text-muted-foreground">Teilweise</div>
          </div>
          <div className="glass rounded-lg p-3 text-center border-l-4 border-blue-400">
            <div className="text-2xl font-bold text-blue-400">{stats.unknown}</div>
            <div className="text-xs text-muted-foreground">Unbekannt</div>
          </div>
        </div>

        {/* ERROR LIST */}
        <div className="glass rounded-xl border border-border overflow-hidden divide-y divide-border">
          {errors.map((err, idx) => (
            <motion.div
              key={err.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`border-l-4 ${getSeverityColor(err.severity)}`}
            >
              <button
                onClick={() => toggleExpand(err.id)}
                className="w-full p-4 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">#{err.id} · {err.date}</span>
                      <Badge variant="outline" className={`text-xs ${
                        err.severity === 'critical' ? 'border-destructive text-destructive' :
                        err.severity === 'high' ? 'border-red-500 text-red-400' :
                        err.severity === 'medium' ? 'border-yellow-500 text-yellow-400' :
                        'border-blue-500 text-blue-400'
                      }`}>
                        {err.severity.toUpperCase()}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(err.status)}
                        <span className={`text-xs font-bold ${
                          err.status === 'fixed' ? 'text-green-400' :
                          err.status === 'open' ? 'text-red-400' :
                          err.status === 'partial' ? 'text-yellow-400' :
                          'text-blue-400'
                        }`}>
                          {err.status === 'fixed' ? 'Behoben' :
                           err.status === 'open' ? 'Offen' :
                           err.status === 'partial' ? 'Teilweise' :
                           'Unbekannt'}
                        </span>
                      </div>
                    </div>
                    <div className="font-bold text-foreground">{err.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{err.error}</div>
                  </div>
                  <div className="flex-shrink-0">
                    {expandedItems[err.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {expandedItems[err.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border/50"
                  >
                    <div className="p-4 space-y-3 bg-muted/20">
                      <div>
                        <div className="text-xs font-bold uppercase text-muted-foreground mb-1">🔴 Fehler</div>
                        <p className="text-xs font-mono text-destructive">{err.error}</p>
                      </div>

                      <div>
                        <div className="text-xs font-bold uppercase text-muted-foreground mb-1">🎯 Ursache</div>
                        <p className="text-xs text-foreground">{err.cause}</p>
                      </div>

                      <div>
                        <div className="text-xs font-bold uppercase text-muted-foreground mb-1">✅ Lösung</div>
                        <p className={`text-xs ${
                          err.status === 'fixed' ? 'text-green-400' :
                          err.status === 'partial' ? 'text-yellow-400' :
                          'text-muted-foreground'
                        }`}>
                          {err.fix}
                        </p>
                      </div>

                      <div className="bg-background rounded-lg p-2">
                        <code className="text-[10px] font-mono text-primary">{err.location}</code>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* SUMMARY */}
        <div className="glass rounded-xl p-4 border border-green-500/30 bg-green-500/5">
          <div className="text-sm font-bold text-green-400 mb-2">✓ Priorität #1: Fix completed</div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>✓ AdminCreditsAudit Crash behoben</li>
            <li>✓ Camera-Links sichtbar + WhatsApp-Share</li>
            <li>✓ CameraView ist public (kein Login nötig)</li>
            <li>✓ CoveragePitchOverlay in LIVE aktiv</li>
          </ul>
        </div>

        <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5">
          <div className="text-sm font-bold text-yellow-400 mb-2">⏳ Open Issues</div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Ball-Possession: Mock-Daten statt echte (Backend not wired)</li>
            <li>• TacticsBoard: Funktioniert aber nicht getestet nach letzten Änderungen</li>
            <li>• Code-Cleanup: IntegratedLiveSession.jsx sollte gelöscht werden</li>
            <li>• ShareCameraLink Component: Unused (Duplikat-Code Inline)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}