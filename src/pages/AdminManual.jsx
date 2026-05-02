import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Code, Workflow, Settings, Shield, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

const SECTIONS = [
  {
    id: 'architektur',
    title: 'Systemarchitektur',
    icon: Code,
    content: [
      {
        heading: 'Überblick',
        text: 'TactIQ ist eine React-basierte Coaching-Plattform mit Base44-Backend. Die Architektur gliedert sich in: Frontend (React, Tailwind), Backend-as-a-Service (Base44 Entities), Live-Streaming (WebRTC via CameraView), und AI-Integration (LLM für Analysen).',
      },
      {
        heading: 'Datenschicht',
        text: 'Alle Daten werden in Base44 Entities gespeichert. Kritische Entities: LiveSession (aktive Spiele), MatchEvent (registrierte Events), FunkMessage (Chat zwischen Trainer und Kameras), SessionReport (generierte Analysen). Jede Entity hat Validierungen: z.B. MatchEvent benötigt session_id, sonst wird es orphaned.',
      },
      {
        heading: 'Live-System',
        text: 'CameraView lädt als öffentliche Seite (/cam?code=XXXXXX), kein Login nötig. Heartbeat alle 2s an LiveSession.camera_streams. Polling des Trainers: 1,5s für Live-Status, 8s für Thumbnails. Funk: 4s Poll-Intervall (reduziert von 2s um Rate-Limits zu vermeiden).',
      },
      {
        heading: 'Event-Deduplizierung',
        text: 'Events innerhalb von 10s mit gleichem Typ+Team+Minute werden als Duplikate markiert. Nachträgliche Korrektur möglich über EventLog. Verhindert mehrfaches Tapping des gleichen Events.',
      },
    ],
  },
  {
    id: 'workflow',
    title: 'Workflow & Prozesse',
    icon: Workflow,
    content: [
      {
        heading: '1. Session Starten',
        text: 'Trainer öffnet LiveSession, gibt Spieltitel ein (auto-befüllt aus letztem Match). Wählt Kamerazahl (default: 1). System generiert 6-stelligen Code pro Kamera. Mit 1 Kamera: Setup überspringen, direkt zu Live-Start.',
      },
      {
        heading: '2. Kamera Verbinden',
        text: 'Kameramann öffnet /cam?code=XXXXX auf Handy, gibt Code ein oder klickt Link. CameraView startet Camera-API mit 3 Fallback-Versuche (4K → 720p → auto). Nach 1s: erstes Thumbnail zu Session. Dann alle 3s Update.',
      },
      {
        heading: '3. Live Monitoring',
        text: 'Trainer sieht Live-Bilder in Kamera-Grid. Status-Icons zeigen: LIVE (grün), WARTET (grau), AUS (rot). Kann Kamera während Live hinzufügen/löschen. Funk-Kanal für Voice-über-Funk (PTT). Event-Tapping mit Team-Picker für automatische Kategorisierung.',
      },
      {
        heading: '4. Halbzeit-Management',
        text: 'Nach 45 Min: Auto-Alert zur Halbzeit. Trainer klickt "2. HZ starten" → half_time wechselt zu 2, Kameras zeigen Seitenwechsel-Banner. Spielminute berechnet: HZ1=0-44min, HZ2=46+min.',
      },
      {
        heading: '5. Session Beenden',
        text: 'Trainer klickt "Beenden & Report erstellen". System: (1) Session → status=ended, (2) Match → status=analyzed, (3) Funk-Messages löschen, (4) SessionReport AUTO-generieren aus Events, (5) User zu SessionReports navigieren.',
      },
      {
        heading: '6. Bericht-Generierung',
        text: 'SessionReport erstellen mit: Ereignisanzahl, Tore, Karten, Wechsel, Summary (KI-generiert). Reports filtern nach Typ: post_session, matchday, pre_match. PDFs exportierbar (jsPDF).',
      },
    ],
  },
  {
    id: 'features',
    title: 'Features & Funktionalität',
    icon: Settings,
    content: [
      {
        heading: 'Event-System',
        text: 'Verfügbare Events: TOR, Chance, Ecke, Gelb/Rot, Foul, Freistoß, Wechsel, Konter, Abseits. Jedes Event: Type + Team (Heim/Gäste/unbekannt) + Minute + Spieler-Source. Deduplizierung + nachträgliche Korrektur möglich.',
      },
      {
        heading: 'Funk-Kanal (Walkie-Talkie)',
        text: 'Bi-direktionale Text-Kommunikation. PTT-Status wird in real-time als Banner angezeigt. Trainer+Kameras sehen sich gegenseitig. Nachrichten-History: max 30 pro Session. Waveform-Visualisierung wenn PTT aktiv.',
      },
      {
        heading: 'AI-Analysen',
        text: 'Nach Session: KI generiert Management-Summary, SWOT-Analyse, taktische Beobachtungen. Optional: Team-Analysen (Gegner-Analyse), Player-Stats, Formation-Timeline. Alle Analysen persistent gespeichert in TeamAnalysis, AnalysisReport.',
      },
      {
        heading: 'Dashboard & Cockpit',
        text: 'Dashboard: Schneller Überblick (letzte Matches, Live-Sessions, Trends). CoachingCockpit: Erweitert — realtime Tactical-Overlay, Player-Tracking (optional AI-Vision), LiveStats (Possession, Pressing-Index). AnalyticsCockpit: Deep-Dive Analyse (vs Gegner, Player-Performance).',
      },
      {
        heading: 'Taktikboard',
        text: 'Formation-Editor: Spieler auf Feld positionieren (x/y % von Feldgröße). Mit Spielerdaten verbunden. Speicherbar pro Match. Visuelle Formation-Analyse für Trainer-Briefing.',
      },
      {
        heading: 'Player-Management',
        text: 'Spieler-Verwaltung mit DSGVO-Tracking-Consent. Minderj. (<18): guardian_required bis Erziehungsberechtigte zustimmen. Tracking_anonymize: ja → kein Name im Tracking. Avatar-Support.',
      },
    ],
  },
  {
    id: 'idealzustand',
    title: 'Idealzustand & Best Practices',
    icon: CheckCircle2,
    content: [
      {
        heading: '✓ Session mit Match verknüpft',
        text: 'MUSS: Session.match_id gefüllt + Match.status="live" während Session. Nach Ende: Match.status="analyzed". Verhindert orphaned Events. System auto-erstellt Match wenn nicht vorhanden.',
      },
      {
        heading: '✓ Kameras stabil verbunden',
        text: 'Alle Kameras zeigen GREEN (connected). Heartbeat alle 2s läuft. Thumbnails aktuell (<5s alt). Kamera-Label eindeutig (z.B. "Weitwinkel", "Torausgang"). Keine AUS-Kameras während Live.',
      },
      {
        heading: '✓ Events strukturiert',
        text: 'Jedes Event: eindeutiger Type + Team + Minute. Keine Events ohne session_id (werden blockiert). Dedup-Fenster 10s — verhindert Mehrfach-Taps. Nachträgliche Korrektionen dokumentiert.',
      },
      {
        heading: '✓ Reporte konsistent',
        text: 'SessionReport nach jeder Live-Session. Match-ID stets gesetzt. Summary + Event-Count + Goals/Cards/Subs listet. Keine orphaned Reports ohne match_id. PDFs exportierbar.',
      },
      {
        heading: '✓ DSGVO & Datenschutz',
        text: 'Alle Spieler: tracking_consent geprüft. Minderj.: nur mit Guardian-Consent aktivierbar. Tracking_anonymize für Consent-verweigerer. Keine Klarnamen im Video-Tracking ohne explizite Zustimmung.',
      },
      {
        heading: '✓ Performance & Rate-Limits',
        text: 'Polling-Intervalle optimiert: Kamera-Poll 8s, Funk 4s, Heartbeat 20s. Verhindert API-Throttling. Canvas-Fehler abgefangen (CORS-safe). Streams cleanup auf unmount. Audio-Detection deaktiviert (zu instabil).',
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting & Admin-Tipps',
    icon: AlertTriangle,
    content: [
      {
        heading: 'Kamera verbindet nicht',
        text: 'Checklist: (1) Code korrekt 6-stellig? (2) Browser-Permission erteilt (Kamera)? (3) HTTPS-Verbindung (lokale Tests können http sein)? (4) Mobile: nicht im Hintergrund? Fallback: manueller Code-Eingabe auf /cam.',
      },
      {
        heading: 'Events werden registriert ohne Session',
        text: 'BLOCKIERT seit Fix: EventButtons disabled wenn sessionId=null. Ui zeigt "❌ Keine aktive Session". Alte orphaned Events: AdminDashboard → Event Recovery Tool um zu löschen.',
      },
      {
        heading: 'Funk funktioniert nicht',
        text: '(1) Session.id korrekt? (2) FunkPanel expended? (3) Poll-Interval zu hoch? Manuell: SessionReports → Funk-Messages per AdminDashboard löschen & neu starten.',
      },
      {
        heading: 'Thumbnails alt/schwarz',
        text: 'Canvas.drawImage kann bei CORS fehlschlagen → schwarzes Fallback-Bild. Normal. Lösung: Video über CORS-freien Proxy oder Data-URL als Base64. Für mobile: Verbindung checken (Bandwidth).',
      },
      {
        heading: 'Report generierung schlägt fehl',
        text: 'Check: (1) Session.id + Match.id beide gesetzt? (2) Events vorhanden (event_count > 0)? (3) LLM-Credits verfügbar? AdminDashboard: manuell SessionReport erstellen oder Events nachträglich hinzufügen.',
      },
      {
        heading: 'Memory-Leak / App verlangsamt sich',
        text: 'Culprits: Offene WebRTC-Streams nicht cleaned up. Solution: unmount-Cleanup, Intervals löschen. DevTools → Memory Profile. EventLog max 50 Einträge, Messages max 30 pro Session.',
      },
    ],
  },
  {
    id: 'admin-tools',
    title: 'Admin-Tools & Wartung',
    icon: Shield,
    content: [
      {
        heading: 'AdminDashboard',
        text: '/admin: Matches anzeigen/löschen, SessionReports verwalten, Events löschen, Changelog pflegen. "Event Recovery" Tool um orphaned Events zu fixen + verwaiste Sessions bereinigen.',
      },
      {
        heading: 'Changelog Management',
        text: 'Alle Releases dokumentieren: Version, Datum, Type (added/improved/fixed/removed), Titel, Beschreibung. Changelog-Seite zeigt Historie. Hilfreich für Change-Tracking + User-Kommunikation.',
      },
      {
        heading: 'User Management',
        text: 'Admin invites per Email + Role (admin/user). Nur Admins können Admins einladen. Admins sehen alle Sessions + Reports. Users sehen nur eigene Daten. DSGVO: Tracking-Consent obligatorisch.',
      },
      {
        heading: 'Monitoring',
        text: 'Browser DevTools: Network-Tab für API-Calls. Console für JS-Fehler. React Query DevTools (browser extension) um Caching-State zu sehen. Runtime-Logs: Backend-Fehler automatisch erfasst.',
      },
      {
        heading: 'Datenbank-Bereinigung',
        text: 'Regelmäßig: (1) Orphaned MatchEvents löschen (ohne session_id), (2) Alte Sessions archivieren (status=ended, älter als 90 Tage), (3) Funk-Messages von beendeten Sessions löschen. AdminDashboard bietet Cleanup-Buttons.',
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
            {section.content.map((item, i) => (
              <div key={i} className="border-l-2 border-primary/30 pl-4">
                <h3 className="font-bold text-foreground mb-2">{item.heading}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-grotesk font-bold text-foreground">Admin-Handbuch TactIQ</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Technische Dokumentation, Workflows, Features und Best Practices für Administratoren und Entwickler.
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
          <p className="mb-2">📖 <strong>Admin-Handbuch</strong> — Letzte Aktualisierung: 2026-05-02</p>
          <p>Für Fragen oder Updates: siehe Admin-Dashboard oder kontaktiere das Development-Team.</p>
        </motion.div>
      </div>
    </div>
  );
}