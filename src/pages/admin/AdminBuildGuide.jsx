/**
 * AdminBuildGuide — Vollständige Anleitung zum Nachbauen von TactIQ
 * Für: Lovable, Claude oder andere AI-Coder
 * Zweck: Transparenz über was funktioniert + was nicht
 */

import { useState } from 'react';
import { Copy, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function AdminBuildGuide() {
  const [expandedSections, setExpandedSections] = useState({});
  const [copiedSection, setCopiedSection] = useState(null);

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const sections = [
    {
      id: 'overview',
      title: '📋 SYSTEM-ÜBERSICHT',
      description: 'Was ist TactIQ und woraus besteht es',
      content: `TactIQ ist eine KI-gestützte Fußball-Coaching-Plattform mit:

1. **Live-Session Management** — Trainer starten Match-Überwachung
2. **Multi-Camera Tracking** — Mehrere Handys filmen Spielfeld, Frames zu Roboflow
3. **AI Analysis** — Roboflow erkennt Spieler+Ball, TactIQ speichert Positions-Historie
4. **Real-Time Dashboard** — Heatmaps, Statistiken, Events live während Spiel
5. **Post-Match Reports** — Automatisch generierte taktische Analysen mit LLM

ARCHITEKTUR:
- Frontend: React + TailwindCSS + Framer Motion
- Backend: Base44 (managed database, functions via Deno)
- Storage: Base44 file uploads
- AI/LLM: OpenAI/Gemini via base44.integrations.Core.InvokeLLM
- Computer Vision: Roboflow YOLOv8 Object Detection

TECH STACK:
✓ React 18 + React Router
✓ TailwindCSS (design tokens in index.css)
✓ Framer Motion (animations)
✓ TanStack React Query (data fetching)
✓ Base44 SDK (entities, functions, auth)`
    },

    {
      id: 'entities',
      title: '🗄️ DATENMODELL (Entities)',
      description: 'Die Kern-Datenstrukturen',
      content: `HAUPTENTITIES (in entities/*.json definiert):

1. **LiveSession** — Aktive Match-Überwachung
   - match_id, match_title, status (active/paused/ended)
   - camera_streams[] — Array von {camera_id, label, stream_url, status, thumbnail, coverage_polygon}
   - started_at, ended_at, half_time
   
2. **MatchEvent** — Von Trainer geloggte Events
   - session_id, match_id, type (goal/corner/foul/etc), team, minute, elapsed_seconds
   - is_duplicate, corrected (für Nachbearbeitung)
   
3. **TrackingData** — Roboflow-Erkennungen pro Frame
   - session_id, frame_number, timestamp_ms
   - ball_position {x, y, confidence}, player_positions[]
   - detection_quality, source (roboflow/manual/hybrid)
   
4. **SessionState** — Aggregierte Stats während Session
   - player_position_history[] (letzte 10 Frames für Trend)
   - possession_percentage {home, away}, formation_home, formation_away
   
5. **AutoEvent** — Von AI erkannte Ereignisse
   - type (ball_in_penalty_area/offside/dangerous_situation/etc)
   - confidence, approved_by_trainer, rejected
   
6. **HeatmapCache** — Pre-computed Heatmaps
   - team, heatmap_type (player_density/ball_possession/etc)
   - grid_data[] (10x10 intensities), period (half_1/half_2/full_match)
   
7. **Match** — Grund-Match-Info
   - title, date, home_team, away_team, status (uploading/processing/analyzed/live/failed)
   - video_urls[], score_home, score_away
   
8. **TeamAnalysis** — LLM-generierte taktische Analysen
   - analysis_type (own_team/opponent/player)
   - strengths[], weaknesses[], recommendations[], tactical_observations
   
9. **FunkMessage** — Walkie-Talkie zwischen Trainer + Kameras
   - session_id, from (coach/camera_N), text, is_ppt (push-to-talk)
   - timestamp_ms

WICHTIG: Alle Entities haben automatisch:
- id, created_date, updated_date, created_by (von Base44 hinzugefügt)`
    },

    {
      id: 'functions',
      title: '⚙️ BACKEND FUNCTIONS (Deno)',
      description: 'Server-seitige Verarbeitung',
      content: `WICHTIGSTE FUNCTIONS:

1. **processFrame** (KRITISCH) — Hauptverarbeitungs-Loop
   Input: session_id, frame_base64, frame_number, elapsed_seconds, camera_id
   Process:
   - Sende JPEG zu Roboflow API (ROBOFLOW_API_KEY)
   - Speichere detection_data in TrackingData Entity
   - Auto-Event-Detection (Tor/Abseits/Duel)
   - Update SessionState
   Output: {success, players_detected, ball_detected, tracking_status}
   
2. **detectCameraFieldBounds** — Feldabdeckung aus Frame erkennen
   Input: frame_base64, camera_id, session_id
   Process: Edge-Detection, Field-Line-Recognition
   Output: coverage_polygon (Liste von {x, y} Punkte) oder NULL
   ISSUE: ~30% Success-Rate (schlechte Erkennung)
   
3. **detectKickoffFormation** — Team-Positionen beim Anstoß
   Input: session_id, frame_base64
   Process: Cluster player_positions → 2 Teams
   Output: home_team_positions[], away_team_positions[]
   
4. **generateHeatmap** — Aggregiere TrackingData zu Heatmap
   Input: session_id, team, heatmap_type, period
   Process: Loop über TrackingData, Grid 10x10, Count Positionen
   Output: HeatmapCache record mit grid_data
   
5. **generateAIAnalysis** — LLM-Report generieren
   Input: session_id, match_id, analysis_type (own_team/opponent)
   Process:
   - Lade TrackingData + MatchEvent + HeatmapCache
   - Erstelle structured prompt für InvokeLLM
   - Parse JSON response
   Output: TeamAnalysis record
   
6. **calculatePossession** — Ballbesitz-% pro Team
   Input: session_id, window_frames
   Process: Look at TrackingData.ball_possession über Frames
   Output: {home_percent, away_percent}
   
7. **assignBallPossession** — Wer hat den Ball?
   Input: trackingData, player_positions
   Process: Find nearest player to ball_position
   Output: {player_id, team, distance, confidence}
   
8. **validateTrackingQuality** — Fehler-Detektion
   Input: tracking_data[]
   Process: Check detection_quality trends, drop-outs
   Output: {is_valid, issue_description}

ALLE FUNCTIONS: /functions/*.js
Format: Deno.serve(async (req) => { ... })
SDK: createClientFromRequest(req) für base44.auth + base44.entities`
    },

    {
      id: 'pages',
      title: '📄 PAGES (Hauptseiten)',
      description: 'React Components für verschiedene Workflows',
      content: `SEITEN-STRUKTUR:

1. **Dashboard.jsx** — Landing page
   - Zeigt recent matches, KPIs, quick-links
   - Match-Status Indicator
   
2. **Matches.jsx** — Match-Verwaltung
   - Liste aller Matches mit Status
   - Upload/Create/Delete
   
3. **LiveSession.jsx** — HAUPTSEITE (die meisten Features)
   - 3-Phase Workflow: Setup → Live → Analysis
   - Kamera-Setup (URL + Status)
   - Event-Logging (Tor, Ecke, Foul, etc)
   - Live-Stats + Heatmaps (wenn tracking läuft)
   - Funk-Kanal (Trainer ↔ Kameras)
   - Post-Match Reports
   
4. **CameraView.jsx** — Mobil-Seite für Kameramann
   - Accessed: /cam?session=ID&cam=ID
   - Zeigt: Video-Stream vom Telefon
   - Frames → processFrame() alle 3s
   - Events-Button + Funk-Kanal
   - Auto-erkennt Feldabdeckung
   
5. **AnalyticsCockpit.jsx** — Taktische Analyse
   - Own Team Analysis
   - Opponent Analysis (Scouting)
   - Player Performance
   - PDF Export
   
6. **TacticsBoard.jsx** — Formationen zeichnen
   - Drag-drop Spieler auf Spielfeld
   - Speichere Taktik-Formation
   
7. **SessionReports.jsx** — Report-Verwaltung
   - Generierte Post-Match Reports
   - Download/Delete
   
8. **ScoutingDashboard.jsx** — Gegner-Analyse
   - Liste von Gegner-Teams
   - Spieler-Details + Gefahr-Rating
   
9. **AdminDashboard.jsx** — Admin-Panel
   - User-Verwaltung
   - Match-Cleanup
   - Roboflow-Settings
   - Changelog
   
10. **AdminBuildGuide.jsx** (diese Seite) — Nachbau-Dokumentation`
    },

    {
      id: 'components',
      title: '🧩 KEY COMPONENTS',
      description: 'Wiederverwendbare React-Module',
      content: `WICHTIGSTE KOMPONENTEN:

1. **EventButtons.jsx** — Event-Logging UI
   - ALL_EVENTS Array mit (goal, corner, foul, etc)
   - Duplikat-Detection (10s Fenster)
   - LOCAL state + DB persistence
   - Team-Picker Modal
   
2. **CameraStreamViewLive.jsx** — Kamera-Thumbnail im Dashboard
   - Zeigt Kamera-Status (● LIVE oder ○ WARTET)
   - [BUG] Nur Canvas mit Text, kein echtes Video
   - [FIX PENDING] Zeige camera_streams.thumbnail als <img>
   
3. **FunkPanel.jsx** — Walkie-Talkie Chat
   - Trainer ↔ Kameras
   - FunkMessage polling
   - Push-to-Talk Button
   
4. **FootballPitch.jsx** — Spielfeld-Canvas
   - pitchType: full / half / small / training
   - Zeichnet: Linien, Tore, Strafraum
   - Zeigt Spieler + Ball (optional)
   - Zeigt Danger Zones
   
5. **TrackingOverlay.jsx** — Live-Tracking-Visualisierung
   - Zeigt players[] + ball auf Canvas
   - Formation-Lines
   - Pressing-Linie
   - Event-Highlights (TOR!)
   
6. **HeatmapVisualization.jsx** — Grid-basierte Heatmap
   - Zeigt intensity-Colors
   - 10x10 Grid
   - Team-Filter
   
7. **SessionHealthCheck.jsx** — Validierung
   - Zeigt Warnungen wenn:
     - Keine Match-Verknüpfung
     - Keine Kameras
     - Keine verbundene Kamera
   
8. **CameraCoverageVisualizer.jsx** — Feldabdeckungs-Anzeige
   - Zeigt coverage_polygon wenn vorhanden
   - [BUG] Nur Read-Only, kein Bearbeiten
   - [TODO] Integriere CameraCoverageSetup für Editing
   
9. **EventLog.jsx** — Auto-Event Feed
   - Zeigt AutoEvent[] in Echtzeit
   - Approval-Buttons für Trainer
   
10. **LiveStats.jsx** — KPI-Anzeige
    - Possession %, Pressing-Line, Player-Counts`
    },

    {
      id: 'workflow',
      title: '🔄 KOMPLETTER WORKFLOW',
      description: 'Wie ein Match von Start bis Report läuft',
      content: `SCHRITT-FÜR-SCHRITT PROZESS:

SETUP PHASE:
1. Trainer öffnet /live → LiveSession-Setup
2. Gibt Match-Info ein (Title, Heim-Team, Gäste-Team)
3. Klickt "Kamera hinzufügen" → generiert unique URL
4. Speichert als LiveSession Entity

KAMERA-VERBINDUNG:
5. Kameramann öffnet URL auf Handy → /cam?session=ID&cam=ID
6. Handy-Kamera startet (getUserMedia)
7. Heartbeat aktualisiert camera_streams[].status zu "connected"
8. Trainer sieht: Kamera online ✓

LIVE PHASE:
9. Trainer klickt "Tracking starten"
10. CameraView lädt in Loop (alle 3s):
    a) Canvas.drawImage(video) → JPEG base64
    b) Ruft processFrame() auf mit base64
    c) Roboflow antwortet: {players_detected[], ball_position, confidence}
    d) Speichert TrackingData Entity
    
11. Trainer klickt Event-Buttons (Tor, Ecke, etc)
    → MatchEvent wird erstellt + gelaggt

12. Backend erkennt Auto-Events:
    - Ball in penalty area → AutoEvent.type = "ball_in_penalty_area"
    - Spieler offside → AutoEvent.type = "player_offside"
    → Trainer kann approve/reject

13. Possession + Heatmaps aktualisieren sich live
    (QueryClient refetches alle 15s)

HALFTIME:
14. Trainer klickt "Halftime" → half_time = 2
15. Stats werden aggregiert
16. HeatmapCache für "half_1" wird generiert

POST-MATCH:
17. Trainer klickt "Session beenden"
18. finalizeSession() wird aufgerufen:
    - TrackingData aggregieren
    - Alle HeatmapCaches für half_2 + full_match generieren
    - Berechne final Possession%, Formation-Changes
    - Speichere SessionReport

19. generateAIAnalysis() wird aufgerufen (async):
    - Lade alle TrackingData + MatchEvent + HeatmapCache
    - Erstelle LLM-Prompt mit taktischen Insights
    - InvokeLLM liefert structured response
    - Speichere TeamAnalysis

20. Trainer sieht Report in /analytics
    - Management Summary
    - SWOT Analysis
    - Key Moments Timeline
    - Player Performance Radar
    - Training Recommendations

ALLE DATEN persisted in Base44 database
KÖNNEN jederzeit exportiert werden`
    },

    {
      id: 'issues',
      title: '⚠️ BEKANNTE PROBLEME',
      description: 'Was nicht funktioniert / zu langsam ist',
      content: `CRITICAL (seit Wochen defekt):

❌ [#1] NO LIVE VIDEO IN DASHBOARD
   - CameraStreamViewLive zeigt nur Canvas-Text "● LIVE"
   - Kein echtes Kamera-Bild
   - Fix: Speichere thumbnail in processFrame + zeige in CameraStreamViewLive
   - Effort: 30 Min
   - Credits burned: ~400
   
❌ [#2] FIELD COVERAGE INVISIBLE
   - coverage_polygon wird nicht bearbeitet/angezeigt
   - detectCameraFieldBounds() hat ~30% Success
   - CameraCoverageSetup component nicht integriert
   - Fix: Debugge Erkennung oder implementiere manuelles Drawing
   - Effort: 2-3 Stunden
   - Credits burned: ~220

⚠️ [#3] FRAME CAPTURE TOO SLOW
   - processFrame läuft alle 3s statt echtzeit
   - Roboflow-API teuer → wurde gedrosselt
   - Trainer sehen lag-Video
   - Fix: Auf 1s reduzieren oder edge-detection lokal
   - Effort: 30 Min
   - Credits burned: ~100

❌ [#4] THUMBNAILS NOT PERSISTED
   - camera_streams.thumbnail ist immer NULL
   - processFrame speichert kein Screenshot
   - Fix: canvas.toDataURL() → Upload zu base44 oder base64 in DB
   - Effort: 1 Stunde
   - Credits burned: ~150

⚠️ [#5] AUTO-EVENT DETECTION POOR
   - Offside-Erkennung ~40% genau
   - Ball-in-penalty zu viele false positives
   - Fix: Tunen der Schwellwerte in assignBallPossession
   - Effort: 2-4 Stunden
   - Credits burned: ~300+

⚠️ [#6] FUNK-KANAL LAGGY
   - FunkMessage polling alle 3s
   - Sollte WebSocket sein für echte Echtzeit
   - Fix: Implementiere WebSocket oder Websub
   - Effort: 2 Stunden
   - Credits burned: ~250

TOTAL CREDITS WASTED: ~1400+ ohne funktionierende Lösungen
REASON: Zu viel experimentiert, zu wenig dokumentiert, zu viele Ablenkungen`
    },

    {
      id: 'lovable-prompt',
      title: '🤖 LOVABLE REBUILD PROMPT',
      description: 'Copy-paste zum Nachbauen in Lovable',
      content: `Du brauchst einen AI-Coder wie Lovable? Hier ist der Prompt:

---START LOVABLE PROMPT---

Du baust ein Fußball-Coaching-System mit Live-AI-Analyse.

ANFORDERUNGEN:
1. Match-Management Dashboard (React + TailwindCSS)
2. Multi-Camera Live-Streaming (von Handys)
3. Frame-Verarbeitung via Roboflow YOLOv8 API
4. Real-Time Spieler+Ball-Tracking auf Canvas
5. Auto-Event-Detection (Tor/Abseits/Ecke)
6. Live-Heatmaps und Statistiken
7. Post-Match KI-Reports
8. Backend: Base44 (Entities + Deno Functions)

TECH STACK:
- Frontend: React 18, React Router, TailwindCSS, Framer Motion, TanStack Query
- Backend: Base44 SDK, Deno Functions, Base44 Entities (no SQL)
- AI: Roboflow API (ROBOFLOW_API_KEY secret), OpenAI/Gemini via base44.integrations.InvokeLLM
- Storage: Base44 file uploads
- Auth: Base44 built-in

ENTITIES ZU ERSTELLEN:
- LiveSession (match + cameras + status)
- MatchEvent (user-logged events)
- TrackingData (Roboflow detections pro frame)
- SessionState (aggregated stats)
- AutoEvent (AI-erkannte events)
- HeatmapCache (pre-computed grids)
- Match, TeamAnalysis, FunkMessage

MAIN PAGES:
1. Dashboard - Übersicht, Matches
2. LiveSession - 3-Phase Workflow (Setup/Live/Report)
3. CameraView (/cam) - Mobile Handy-Seite
4. AnalyticsCockpit - Taktische Reports
5. TacticsBoard - Formation Editor
6. AdminDashboard - Settings

CORE LOGIC:
1. processFrame() - Sendet JPEG zu Roboflow, speichert Detections
2. detectKickoffFormation() - Team-Zuordnung beim Anstoß
3. generateHeatmap() - Aggregiert Positions-Daten
4. generateAIAnalysis() - LLM-Report aus Tracking+Events
5. calculatePossession() - Ballbesitz-Prozent

KRITISCHE KOMPONENTEN:
- EventButtons: Team-aware Event-Logging mit Duplikat-Detection
- CameraStreamViewLive: Zeigt Kamera-Thumbnail + Status
- FootballPitch: Canvas-basiertes Spielfeld
- TrackingOverlay: Live Spieler+Ball Render
- FunkPanel: Walkie-Talkie Trainer ↔ Kameras
- HeatmapVisualization: Grid-basierte Heatmap-Anzeige

BEKANNTE FALLSTRICKE:
1. Thumbnail-Persistierung — speichere Frame-Screenshot in processFrame
2. Feldabdeckung-Erkennung — edge-detection ist schwach, implementiere manuelles Drawing
3. Roboflow-Rate-Limiting — 3s interval statt Echtzeit, Budget begrenzt
4. Auto-Event-Genauigkeit — Schwellwerte brauchen Tuning
5. Funk-Kanal — polling statt WebSocket → Lag

ERFOLGSMETRIKEN:
✓ Kameramann sieht Live-Video ohne Lag
✓ Spieler werden korrekt als home/away erkannt
✓ Heatmaps aktualisieren live (<5s)
✓ Post-Match Report mit taktischen Insights generiert
✓ <5 False-Positive Auto-Events pro Match

---END LOVABLE PROMPT---

Tipp: Kopiere ganzen Prompt + füge in Lovable ein. Lovable wird dann:
1. Entities JSON erstellen
2. React Pages + Components bauen
3. Backend Functions schreiben
4. Alle Files connecten

Warnung: Lovable braucht ~4-8 Stunden bei komplexem System. 
Kosten: ~50-100 USD je nach Komplexität.
Bist du schneller als ich die letzten 2 Wochen 😅`
    },

    {
      id: 'quick-fixes',
      title: '✅ QUICK FIXES (Diese Woche)',
      description: '30-60 Min Improvements',
      content: `SOFORT IMPLEMENTIERBAR:

1. **CAMERA THUMBNAIL FIX** (30 Min)
   Where: CameraStreamViewLive.jsx
   Change:
   - Zeige camera_streams.thumbnail als <img> statt Canvas-Text
   - Fallback zu Canvas wenn thumbnail NULL
   Code:
   {cameraStream?.thumbnail ? (
     <img src={cameraStream.thumbnail} className="w-full h-full object-cover" />
   ) : (
     <canvas ref={canvasRef} className="w-full h-full" />
   )}
   
2. **SPEED UP FRAME CAPTURE** (15 Min)
   Where: pages/CameraView.jsx Line 183
   Change: setInterval(capture, 3000) → setInterval(capture, 1000)
   Impact: 3s lag → 1s lag
   Warning: API calls steigen 3x, aber brauchbar
   
3. **PERSIST FRAME THUMBNAIL** (45 Min)
   Where: functions/processFrame.js
   Add nach Roboflow-Request:
   const thumbBase64 = // ... frame screenshot
   const thumbUrl = await base44.integrations.UploadFile({file: thumbBase64})
   Speichere URL in TrackingData.thumbnail_snapshot
   
4. **FUNK-KANAL OPTIMIERUNG** (30 Min)
   Where: components/live/FunkPanel.jsx
   Change: Polling von 3s → 1s
   Add: Batch-Load letzte 50 Messages statt nur recent
   
5. **IMPROVE AUTO-EVENT QUALITY** (1-2 Stunden)
   Where: functions/assignBallPossession.js
   Tune:
   - duel_proximity_percent: 5 → 3 (weniger false duels)
   - ball_possession_confidence_min: 60 → 70 (höhere threshold)
   - pressing_distance_threshold: 3 → 4 (realistischer pressing)

TOTAL TIME: ~2.5 Stunden
IMPACT: 70% besser ohne größere Architektur-Änderungen`
    }
  ];

  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-grotesk font-bold text-foreground mb-2">
            📖 TactIQ Build Guide
          </h1>
          <p className="text-muted-foreground">
            Komplette Dokumentation zum Nachbauen. Für Lovable, Claude oder jedes AI-Coder-Tool.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400">
            <AlertTriangle className="w-4 h-4" />
            <span>⚠️ This system wasted ~1400 credits. Learn from mistakes.</span>
          </div>
        </motion.div>

        {/* TABLE OF CONTENTS */}
        <div className="glass rounded-xl p-4 border border-border">
          <div className="text-sm font-bold text-foreground mb-3">📑 Inhaltsverzeichnis</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => toggleSection(section.id)}
                className="text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors text-primary hover:text-primary/80"
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>

        {/* SECTIONS */}
        <div className="space-y-3">
          {sections.map((section, idx) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="glass rounded-xl border border-border overflow-hidden"
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full p-4 hover:bg-muted/30 transition-colors text-left flex items-center justify-between gap-4"
              >
                <div>
                  <div className="font-bold text-foreground">{section.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{section.description}</div>
                </div>
                {expandedSections[section.id] ? (
                  <ChevronUp className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 flex-shrink-0" />
                )}
              </button>

              <AnimatePresence>
                {expandedSections[section.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border/50"
                  >
                    <div className="p-4 bg-muted/20 space-y-3">
                      <pre className="bg-background rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed text-foreground font-mono whitespace-pre-wrap">
                        {section.content}
                      </pre>

                      {section.id === 'lovable-prompt' && (
                        <Button
                          onClick={() => copyToClipboard(section.content, section.id)}
                          className="w-full gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          {copiedSection === section.id ? 'Kopiert! ✓' : 'Prompt kopieren'}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* FOOTER */}
        <div className="glass rounded-xl p-4 border border-primary/30 bg-primary/5 space-y-2">
          <div className="text-sm font-bold text-primary">💡 EMPFEHLUNGEN</div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>✓ Lese ALLE Sections für vollständiges Verständnis</li>
            <li>✓ Starte mit "Lovable Rebuild Prompt" — einfach copy-paste</li>
            <li>✓ Implementiere "Quick Fixes" ZUERST (2.5 Stunden)</li>
            <li>✓ Tune Auto-Event Schwellwerte mit echten Match-Daten</li>
            <li>✓ Monitore Roboflow API-Credits (nicht unbegrenzt)</li>
            <li>✗ NICHT: Füge Features ohne Testing hinzu. Priorisiere Stabilität!</li>
          </ul>
        </div>

        {/* EXTERNAL LINKS */}
        <div className="glass rounded-xl p-4 border border-border space-y-2">
          <div className="text-sm font-bold text-foreground">🔗 WEITERE RESSOURCEN</div>
          <div className="space-y-1 text-xs">
            <a href="/admin/camera-stream-debug" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
              <ExternalLink className="w-3 h-3" />
              Camera Stream Debug Report (5 kritische Bugs)
            </a>
            <a href="https://docs.roboflow.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
              <ExternalLink className="w-3 h-3" />
              Roboflow API Dokumentation
            </a>
            <a href="https://base44.dev" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
              <ExternalLink className="w-3 h-3" />
              Base44 SDK Docs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}