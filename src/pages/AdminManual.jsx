import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Code, Workflow, Settings, Shield, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Database, Radio, Network, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SECTIONS = [
  {
    id: 'architektur',
    title: 'Systemarchitektur',
    icon: Code,
    subsections: [
      {
        heading: '🏗️ Überblick',
        content: `TactIQ ist eine vollständig serverlose React-Anwendung mit Base44 als Backend-as-a-Service.

Frontend: React 18 + React Router für SPAs
Styling: Tailwind CSS + shadcn/ui Komponenten
State Management: React Query (@tanstack/react-query) für Daten-Caching
Echtzeit: WebRTC für Video-Streaming, Polling für Sync
Backend: Base44 Entities als normalisierte Datenbank
AI: LLM-Integration für automatische Match-Analysen`,
      },
      {
        heading: '📊 Datenschicht & Entities',
        content: `Kritische Entities und ihre Beziehungen:

1. LiveSession
   - status: active | paused | ended
   - camera_streams: [ { code, label, status, thumbnail, last_seen } ]
   - match_id: Externe Referenz zu Match
   - half_time: 1 | 2

2. MatchEvent
   - session_id: MUSS befüllt sein (blockiert sonst)
   - match_id: Für Reporting erforderlich
   - type: goal | chance | corner | yellow_card | red_card | foul | freekick | substitution | transition | offside | note
   - team: home | away | unknown
   - minute: Spielminute (auto berechnet)
   - is_duplicate: Boolean (Deduplizierung 10s Fenster)
   - corrected: Boolean (nachträgliche Korrektur)

3. FunkMessage
   - session_id: Für Walkie-Talkie
   - from: coach | camera_[label]
   - is_ppt: Boolean (Push-to-Talk Signal)
   - ppt_active: Boolean (Sprecher aktiv)
   - timestamp_ms: Für Ordering

4. SessionReport
   - session_id: Referenz zur abgelaufenen Session
   - match_id: Muss gesetzt sein (verhindert orphaned reports)
   - report_type: post_session | matchday | pre_match
   - summary: KI-generiert
   - event_count: Statistik
   - goals/cards/substitutions: Arrays von Events`,
      },
      {
        heading: '🔄 Datenfluss',
        content: `Session Start → Event Tracking → Session Ende → Report

1. SESSION START
   - Trainer öffnet /live, gibt Spieltitel + Kameraanzahl
   - System erstellt LiveSession { match_title, camera_streams: [ { code, label, status } ] }
   - Codes werden geteilt (Link oder manuell)

2. KAMERA VERBINDUNG
   - Kameramann öffnet /cam?code=XXXXXX
   - CameraView initiiert getUserMedia (3 Fallback-Versuche)
   - Heartbeat: alle 2s UPDATE camera_streams[].status = connected, last_seen = now
   - Thumbnail-Push: 1s delay, dann alle 3s (Canvas drawImage → Base64)

3. LIVE MONITORING
   - EventButtons nur enabled wenn sessionId != null
   - Event TAP → MatchEvent.create({ session_id, match_id, type, team, minute, timestamp_ms })
   - Deduplizierung: Event mit selben (type, team, minute) in <10s = Duplikat
   - Funk-Kanal: bidirektional, 4s Poll-Intervall

4. SESSION ENDE
   - Trainer klickt "Beenden"
   - Status-Kaskade:
     * LiveSession.status = ended
     * Match.status = analyzed
     * FunkMessages gelöscht (cleanup)
     * SessionReport AUTO-erstellt aus MatchEvents
   - Redirect zu /session-reports`,
      },
      {
        heading: '⚡ Performance & Rate-Limits',
        content: `Polling-Optimierungen (Base44 hat Rate-Limits):

- CameraView Heartbeat: 20s (erhöht von 3s)
- CameraView Poll: 8s (erhöht von 2s)
- CameraView Thumbnail: 3s (alle 3s nach initial 1s)
- FunkPanel Poll: 4s (erhöht von 2s)
- LiveSession Kamera-Poll: 1,5s (nur Setup-Phase)
- CoachingCockpit Tracking: 2s Frames

Verhindert API-Throttling und Überlast. Canvas-Fehler abgefangen (CORS-safe).
Audio-Detection deaktiviert (verursacht Instabilität + zu viele API-Calls).`,
      },
    ],
  },
  {
    id: 'features',
    title: 'Features im Detail',
    icon: Settings,
    subsections: [
      {
        heading: '⚽ Event-System',
        content: `Vollständiger Event-Katalog mit Deduplizierung:

VERFÜGBARE EVENTS:
- ⚽ TOR (goal) — Team + Minute
- 🎯 CHANCE (chance) — gefährliche Gelegenheit
- 📐 ECKE (corner) — Eckball zugeteilt
- 🟨 GELB (yellow_card) — Verwarnung
- 🟥 ROT (red_card) — Rote Karte
- ⛔ FOUL (foul) — Regelverstoß
- 🦵 FREISTOS (freekick) — Freistoß
- 🔄 WECHSEL (substitution) — Spielerwechsel
- ⚡ KONTER (transition) — schneller Ballverlust
- 🚩 ABSEITS (offside) — Abseits-Entscheidung
- 📝 NOTIZ (note) — Freitext-Notiz

DEDUPLIZIERUNG:
Event mit (type + team + minute) innerhalb 10s = Duplikat markiert.
Verhindert mehrfaches Tapping.

NACHTRÄGLICHE KORREKTUR:
Events können korrigiert werden (EventLog → Edit).
correction_note wird dokumentiert, corrected=true gespeichert.`,
      },
      {
        heading: '📻 Funk-Kanal (Walkie-Talkie)',
        content: `Echtzeit-Kommunikation zwischen Trainer und Kameras:

FLOW:
1. Trainer öffnet FunkPanel in LiveSession
2. Kameramann öffnet CameraFunkPanel in CameraView
3. Bi-direktionale Text-Messages über FunkMessage Entity
4. PTT (Push-to-Talk): halten = spricht, loslassen = fertig
5. PTT-Signal wird als is_ppt=true + ppt_active=true gespeichert

POLLING:
- Beide Seiten: 4s Intervall für neue Messages
- Aktiver Sprecher: Banner mit "Name spricht" wenn ppt_active=true vor <5s
- Waveform: AudioWaveform-Component zeigt Live-Frequenz während PTT

MESSAGE-STRUKTUR:
{
  session_id: "xxx",
  from: "coach" | "camera_1",
  from_label: "Trainer" | "Kamera Weitwinkel",
  text: "Nachricht oder 📻 PTT-Status",
  is_ppt: false | true,
  ppt_active: false | true,
  timestamp_ms: Date.now()
}`,
      },
      {
        heading: '🤖 AI-Analysen',
        content: `Automatische KI-generierte Match-Analysen:

REPORT-TYPEN:
1. Post-Session (automatisch nach Session)
   - Summary aus Events
   - Management Summary
   - Event Statistiken (Goals, Cards, Subs)

2. Matchday Report (optional)
   - Team Performance
   - Gegner-Analyse
   - Spieler-Rankings

3. Pre-Match (Vorbericht)
   - Gegner-Scouting
   - Taktische Empfehlungen
   - Formation-Tipps

DATEN-QUELLEN:
- MatchEvents (alle registrierten Ereignisse)
- Match-Metadaten (Teams, Wettbewerb)
- Spieler-Stats (optional)
- Gegner-Database (optional)

LLM-PROMPT KONSTRUKTION:
base44.integrations.Core.InvokeLLM({
  prompt: "Analysiere Spiel [Titel] mit [N] Events...",
  response_json_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      weaknesses: { type: "array" },
      recommendations: { type: "array" }
    }
  }
})`,
      },
      {
        heading: '👥 Player Management',
        content: `DSGVO-konformes Spieler-Tracking mit Consent:

TRACKING-CONSENT (erforderlich):
- granted: ✓ Spieler akzeptiert KI-Tracking
- denied: ✗ Spieler lehnt ab, wird anonymisiert
- pending: ? Noch nicht entschieden
- guardian_required: 👤 Minderj. warten auf Erziehungsberechtigte

MINDERJ. (<18 JAHREN):
- Kann nicht selbst zustimmen
- guardian_email erforderlich
- Status bleibt guardian_required bis Erziehungsberechtigte zustimmt

ANONYMISIERUNG:
- tracking_anonymize=true: Kein Name im Video-Tracking
- Zufällige ID statt Namen
- Ermöglicht Tracking ohne Consent

PLAYER-FELDER:
- name, number, position, team
- age, dominant_foot
- avatar_url (optional)
- tracking_consent, tracking_consent_date
- tracking_anonymize
- guardian_email (bei Minderj.)`,
      },
    ],
  },
  {
    id: 'workflow',
    title: 'Workflow & Prozesse',
    icon: Workflow,
    subsections: [
      {
        heading: '🎬 Kompletter Session-Workflow',
        content: `SCHRITT 1: SESSION KONFIGURIEREN
- Trainer öffnet /live
- Titel wird auto-befüllt (letztes Spiel oder "Spiel DD.MM.YYYY")
- Kameraanzahl wählen (default 1)
- System generiert 6-stelligen Code pro Kamera
- Bei 1 Kamera: Setup überspringen, direkt zu "Weiter"

SCHRITT 2: SETUP ABSCHLIESSEN
- Mit Camanzahl > 1 oder mehreren Kameras: Setup-Modal
- Zeigt Live-Bilder von verbundenen Kameras
- Trainer kann Label editieren
- Kamera hinzufügen/löschen während Live
- "Live starten" Button enabled wenn ≥1 Kamera connected

SCHRITT 3: LIVE STARTEN
- Session.status wechselt zu "active"
- Match.status wechselt zu "live"
- Uptime-Timer startet (0:00)
- EventButtons enabled
- Funk-Channel öffnet

SCHRITT 4: LIVE MONITORING
- Timer läuft (Spielminute berechnet: HZ1=0-44, HZ2=46+)
- Trainer tapped Events (mit Team-Picker für tore/karten)
- Kameramann sieht Funk-Nachrichten
- Nach 45 Min: Auto-Alert "Halbzeit?"

SCHRITT 5: HALBZEIT (optional)
- Trainer klickt "Ja, 2. HZ starten"
- half_time=2, Spielminute springt zu 46
- Kameras zeigen "Seitenwechsel" Banner
- Spieler-Positionen kehren um (taktisch relevant)

SCHRITT 6: BEENDIGUNG
- Trainer klickt "Beenden & Report erstellen"
- Session.status = ended
- Match.status = analyzed
- FunkMessages gelöscht
- SessionReport AUTO-erstellt
- Redirect zu /session-reports`,
      },
      {
        heading: '🔗 Kamera-Verbindungsprozess',
        content: `TECHNISCHER FLOW:

1. LINK-GENERIERUNG
   URL: /cam?code=XXXXXX&pos=KameraLabel
   Share via: WhatsApp, SMS, native Share, Zwischenablage

2. KAMERAMANN ÖFFNET LINK
   - CameraView Layout lädt (kein Login erforderlich)
   - Code-Input oder automatisch aus URL
   - Klick "Verbinden" → startPolling()

3. POLLING (Alle 8 Sekunden)
   const allSessions = await LiveSession.list()
   const matched = allSessions.find(s => 
     s.camera_streams.some(c => c.code === eingabeCode)
   )
   Wenn gefunden:
   - clearInterval(pollRef)
   - setSessionInfo(matched)
   - startHeartbeat() → 20s Intervall
   - startThumbnailPush() → 3s Intervall

4. HEARTBEAT (Alle 20 Sekunden)
   - Session neu laden
   - camera_streams mit matching code updaten
   - status = "connected"
   - last_seen = now()

5. THUMBNAIL-PUSH (Alle 3 Sekunden)
   - Canvas.drawImage(video) → JPEG Base64
   - UPDATE camera_streams[camIndex].thumbnail
   - Trainer sieht sofort Live-Vorschau

6. ANZEIGE IM TRAINER-VIEW
   - Camera-Grid zeigt Thumbnail
   - Status-Badge: "LIVE" (grün) oder "WARTET" (grau)
   - Zuletzt gesehen Timestamp`,
      },
      {
        heading: '📋 Event-Registrierung & Dedup',
        content: `EVENT-REGISTRIERUNG (5-Schritte):

1. BUTTON TAPPEN
   - Button deaktiviert wenn sessionId=null (UI zeigt "Keine Session")
   - Trainer klickt z.B. "⚽ TOR"
   - Team-Picker fragt "Heim oder Gäste?"

2. DATEN SAMMELN
   const eventData = {
     session_id: sessionId,
     match_id: (auto oder leer),
     type: evt.key,
     team: "home" | "away" | "unknown",
     minute: Math.floor(elapsedTime / 60),
     elapsed_seconds: elapsedTime,
     source: "coach" | "camera_1",
     timestamp_ms: Date.now(),
     is_duplicate: checkDuplicate(type, team, minute),
     corrected: false
   }

3. DEDUPLIZIERUNG (10s-Fenster)
   const key = \`\${type}_\${team}_\${minute}\`
   const last = recentRef.current[key]
   const isDuplicate = (now - last) < 10000
   Verhindert: rapid clicking desselben Events

4. LOKAL SPEICHERN (UI-Feedback)
   setLocalEvents(prev => [eventData, ...prev].slice(0, 50))
   setFlash({ isDuplicate, message })
   Flash verschwindet nach 800-1200ms

5. DB SPEICHERN
   if (sessionId) {
     base44.entities.MatchEvent.create(eventData)
   }
   Asynchron, blockiert UI nicht`,
      },
    ],
  },
  {
    id: 'technical-stack',
    title: 'Technischer Stack',
    icon: Network,
    subsections: [
      {
        heading: '📦 Dependencies',
        content: `FRONTEND:
- react ^18.2.0 — UI-Framework
- react-router-dom ^6.26.0 — Routing + Links
- @tanstack/react-query ^5.84.1 — Server State Management
- framer-motion ^11.16.4 — Animationen (motion.div, AnimatePresence)
- tailwindcss ^3.x — CSS-Utility-Framework
- tailwindcss-animate ^1.0.7 — Animation-Utilities
- shadcn/ui — Komponenten-Bibliothek (Button, Input, Badge, etc.)
- lucide-react ^0.475.0 — Icon-Bibliothek
- date-fns ^3.6.0 — Datum-Formatierung
- recharts ^2.15.4 — Charts für Analytics
- react-quill ^2.0.0 — Rich-Text Editor
- jspdf + html2canvas — PDF-Export
- react-hook-form ^7.54.2 — Form-Handling
- zod ^3.24.2 — Schema-Validierung
- three.js — 3D-Grafiken (optional)
- react-leaflet + leaflet — Karten (optional)
- @hello-pangea/dnd — Drag-and-Drop

BACKEND:
- @base44/sdk ^0.8.27 — Base44 Client SDK
- base44.entities.* — Daten CRUD
- base44.auth.* — Authentication
- base44.integrations.Core.InvokeLLM — LLM-Integration
- base44.integrations.Core.UploadFile — Datei-Upload`,
      },
      {
        heading: '🎥 WebRTC & Media',
        content: `CAMERA API:

getUserMedia() mit Fallbacks:
1. Versuch: { video: { facingMode: "environment", width: 1920, height: 1080 } }
2. Versuch: { video: { facingMode: "environment", width: 1280, height: 720 } }
3. Versuch: { video: { facingMode: "environment" } }
4. Fallback: { video: true }

applyConstraints für Zoom (non-blocking):
const track = stream.getVideoTracks()[0]
const caps = track.getCapabilities?.()
if (caps?.zoom) track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] })

STREAM CLEANUP:
streamRef.current.getTracks().forEach(t => t.stop())
videoRef.current.srcObject = null
videoRef.current.pause()

CANVAS RENDERING:
- requestAnimationFrame Loop für kontinuierliche Frames
- Canvas.drawImage(video) für Thumbnail-Erfassung
- CORS-Fehler abgefangen (schwarzes Fallback-Bild akzeptabel)

WAKELOCK (Mobile):
if ('wakeLock' in navigator) {
  navigator.wakeLock.request('screen').then(lock => wl = lock)
}
Verhindert Sleep während Live-Session`,
      },
      {
        heading: '💾 State Management & Caching',
        content: `REACT QUERY:
- queryKey: ['liveSessions', 'matches', 'session-reports']
- refetchInterval: 10000 (10s für Status-Updates)
- initialData: [] (verhindert undefined)
- staleTime: 5000 (5s bevor erneut fetched)
- invalidateQueries bei Mutation

REFS (für Closure-Vermeidung):
- uptimeRef, heartbeatRef, pollRef, sessionInfoRef
- Verhindert stale Closures in Intervals
- Alle Refs werden in useEffect synced

LOKALE EVENTS:
- localEvents: State für UI-Feedback
- recentRef: { eventKey: timestamp } für Dedup
- flashEvent: { key, isDuplicate, message }

SESSION PERSISTENCE:
- sessionStorage: cam_code, cam_pos (Kameramann)
- localStorage: User Preferences (optional)
- Bei Refresh: Auto-reconnect wenn Code in SessionStorage`,
      },
      {
        heading: '🔐 Sicherheit & Validierung',
        content: `ENTITY-LEVEL:
- LiveSession.camera_streams ist Array (mutable)
- MatchEvent benötigt session_id (obligatorisch)
- SessionReport.match_id (optional, aber für Reports erforderlich)

KOMPONENT-LEVEL:
- EventButtons disabled wenn sessionId=null
- handlePTT nur wenn sessionId vorhanden
- Validierung vor DB.create()

UI-VALIDIERUNG:
- Team-Picker verhindert unknown-Events für wichtige Typen
- Code-Input: nur Ziffern, max 6 Zeichen
- Label-Input: Trimmed + max 50 Zeichen

API-VALIDIERUNG:
- Base44 enforces required fields
- Client-side Fehler werden geloggt (catch blocks)
- Stille Fallbacks für nicht-kritische Fehler

DSGVO:
- tracking_consent obligatorisch für Spieler
- Minderj. blocken automatisch (guardian_required)
- tracking_anonymize aktivierbar ohne Consent`,
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: AlertTriangle,
    subsections: [
      {
        heading: '🚨 Häufige Probleme',
        content: `KAMERA VERBINDET NICHT
✓ Lösung: (1) Code 6-stellig? (2) Browser-Permission erteilt? (3) HTTPS? (4) Mobile nicht im Hintergrund?

EVENTS OHNE SESSION
✓ BLOCKIERT: EventButtons.disabled = !sessionId. Ui zeigt "❌ Keine aktive Session"

FUNK FUNKTIONIERT NICHT
✓ Check: Session.id korrekt? Expanded? Poll-Interval zu hoch?

THUMBNAILS ALT/SCHWARZ
✓ Canvas.drawImage CORS-Fehler → schwarzes Fallback. Normal bei Cross-Origin.

REPORT GENERATION FEHLT
✓ Check: Match.id + Session.id beide gesetzt? Events vorhanden? LLM-Credits?

MEMORY LEAK
✓ Culprits: Streams nicht gekleaned, Intervals nicht cleared.
✓ DevTools → Memory Profiler. EventLog max 50, Messages max 30 pro Session.`,
      },
    ],
  },
];

function SectionCard({ section, isOpen, onClick }) {
  const Icon = section.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden border border-border cursor-pointer hover:border-primary/40 transition-all"
      onClick={onClick}
    >
      <div className="p-5 flex items-center justify-between hover:bg-primary/5 transition-colors">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary flex-shrink-0" />
          <h2 className="font-grotesk font-bold text-lg text-foreground">{section.title}</h2>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </div>

      {isOpen && (
        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-border/50">
          <div className="p-5 space-y-6">
            {section.subsections.map((subsection, i) => (
              <div key={i} className="border-l-2 border-primary/30 pl-4">
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">{subsection.heading}</h3>
                <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto text-muted-foreground whitespace-pre-wrap break-words leading-relaxed font-mono">
                  {subsection.content}
                </pre>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function AdminManual() {
  const [openSections, setOpenSections] = useState({});

  const toggleSection = (id) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-grotesk font-bold text-foreground">TactIQ Admin-Handbuch</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Vollständige technische Dokumentation: Architektur, Datenfluss, alle Features, Workflows und Troubleshooting.
          </p>
        </motion.div>

        {/* Inhaltsverzeichnis */}
        <div className="glass rounded-2xl p-6 mb-8 border border-primary/20 bg-primary/5">
          <h2 className="font-grotesk font-bold text-foreground mb-3">Inhaltsverzeichnis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => toggleSection(section.id)}
                className="text-left text-sm px-3 py-2 rounded-lg hover:bg-primary/20 text-primary transition-colors"
              >
                • {section.title}
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {SECTIONS.map(section => (
            <SectionCard
              key={section.id}
              section={section}
              isOpen={openSections[section.id]}
              onClick={() => toggleSection(section.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-12 p-6 bg-muted/30 rounded-2xl border border-border text-center text-sm text-muted-foreground">
          <p className="mb-2">📖 <strong>Detailliertes Admin-Handbuch</strong> — Technische Referenz für Entwickler + Administratoren</p>
          <p>Siehe auch: <strong>Admin-Demo</strong> (visueller Workflow) + <strong>Example Report</strong> (Sample Report)</p>
        </motion.div>
      </div>
    </div>
  );
}