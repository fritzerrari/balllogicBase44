/**
 * AdminDocs — Technische Systemdokumentation für Administratoren
 * Vollständige Architektur, Komponenten, API-Integration, Datenschutz, Skalierung
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Server, Database, Wifi, Shield, Zap,
  Camera, Users, BarChart3, Code2, ChevronDown, ChevronRight,
  Globe, Lock, Cpu, GitBranch, CheckCircle2, AlertTriangle,
  ArrowRight, FileText, Settings, Radio, Bot
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const Section = ({ id, icon: Icon, title, badge, badgeColor = 'bg-primary/15 text-primary border-primary/30', children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-6 py-4 hover:bg-white/5 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-grotesk font-semibold text-foreground">{title}</span>
            {badge && <Badge className={`text-[10px] border ${badgeColor}`}>{badge}</Badge>}
          </div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-border">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CodeBlock = ({ code, lang = 'text' }) => (
  <pre className="bg-black/40 border border-border rounded-lg p-4 text-xs text-primary font-mono overflow-x-auto mt-3 leading-relaxed whitespace-pre-wrap">
    {code}
  </pre>
);

const InfoRow = ({ label, value, mono = false }) => (
  <div className="flex items-start justify-between py-2 border-b border-border/50 last:border-0 gap-4">
    <span className="text-xs text-muted-foreground flex-shrink-0 w-40">{label}</span>
    <span className={`text-xs text-foreground text-right ${mono ? 'font-mono text-primary' : ''}`}>{value}</span>
  </div>
);

const Chip = ({ label, color = 'bg-primary/10 text-primary' }) => (
  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
);

const CheckItem = ({ text, ok = true }) => (
  <div className="flex items-start gap-2 py-1">
    <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${ok ? 'text-primary' : 'text-muted-foreground'}`} />
    <span className="text-xs text-foreground/80">{text}</span>
  </div>
);

const WarnItem = ({ text }) => (
  <div className="flex items-start gap-2 py-1">
    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-yellow-400" />
    <span className="text-xs text-foreground/80">{text}</span>
  </div>
);

export default function AdminDocs() {
  const [activeTab, setActiveTab] = useState('architektur');

  const tabs = [
    { id: 'architektur', label: 'Architektur', icon: Server },
    { id: 'tracking', label: 'Tracking & KI', icon: Cpu },
    { id: 'sicherheit', label: 'Sicherheit', icon: Shield },
    { id: 'api', label: 'API & Integration', icon: Code2 },
    { id: 'skalierung', label: 'Skalierung', icon: Globe },
    { id: 'troubleshoot', label: 'Fehlersuche', icon: AlertTriangle },
  ];

  return (
    <div className="p-6 lg:p-8 min-h-screen max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 font-medium tracking-widest uppercase">
          <BookOpen className="w-3 h-3" /><span>Admin-Dokumentation</span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-grotesk font-bold text-foreground mb-2">TactIQ — Technische Dokumentation</h1>
        <p className="text-muted-foreground">Vollständige Systemreferenz für Administratoren & Entwickler</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Chip label="Version 2.0" />
          <Chip label="React 18 + Vite" color="bg-blue-500/10 text-blue-400" />
          <Chip label="Base44 Platform" color="bg-purple-500/10 text-purple-400" />
          <Chip label="Roboflow RF-DETR" color="bg-yellow-500/10 text-yellow-400" />
          <Chip label="Stand: April 2026" color="bg-muted text-muted-foreground" />
        </div>
      </motion.div>

      {/* Tab Nav */}
      <div className="flex flex-wrap gap-1 mb-6 bg-muted rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === t.id ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── ARCHITEKTUR ─────────────────────────────────────────────────────── */}
      {activeTab === 'architektur' && (
        <div>
          <Section icon={GitBranch} title="System-Übersicht" defaultOpen>
            <p className="text-sm text-muted-foreground mb-4">
              TactIQ ist eine vollständig clientseitige React-Anwendung auf der Base44-Plattform. Die gesamte Business-Logik läuft im Browser — kein eigener Applikationsserver notwendig.
            </p>
            <CodeBlock code={`┌─────────────────────────────────────────────────────────┐
│                    TactIQ Frontend                       │
│  React 18 · Vite · Tailwind CSS · TypeScript-fähig      │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  Dashboard   │  │   Matches    │  │  Live-Session │ │
│  │  Reports     │  │  TacticsAI   │  │  Cockpit      │ │
│  │  KI-Tools    │  │  HalftimeRep │  │  CameraView   │ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
└────────────────────────────┬────────────────────────────┘
                             │ base44 SDK
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌─────────────┐
│  Base44 DB   │   │  Base44 Auth     │   │  Base44     │
│  Entities    │   │  JWT Sessions    │   │  Integrat.  │
│  Match       │   │  User Mgmt       │   │  LLM / Email│
│  AnalysisRep │   │  Roles: admin,   │   │  FileUpload │
│  LiveSession │   │  user            │   └─────────────┘
└──────────────┘   └──────────────────┘
                                                   │
                                          ┌────────▼──────┐
                                          │  Roboflow API │
                                          │  RF-DETR/YOLO │
                                          │  (optional)   │
                                          └───────────────┘`} />
          </Section>

          <Section icon={Database} title="Datenmodell — Entities">
            <p className="text-sm text-muted-foreground mb-4">Alle Daten werden in der Base44-Datenbank gespeichert. Jede Entity hat automatisch: <code className="text-primary">id</code>, <code className="text-primary">created_date</code>, <code className="text-primary">updated_date</code>, <code className="text-primary">created_by</code>.</p>
            <div className="space-y-4">
              {[
                {
                  name: 'Match', color: 'text-primary', fields: [
                    ['title', 'string', 'Pflicht', 'z.B. "FC Bayern vs BVB"'],
                    ['date', 'date', 'Pflicht', 'ISO-Datum'],
                    ['home_team / away_team', 'string', 'Pflicht', 'Teamnamen'],
                    ['status', 'enum', '', 'uploading | processing | analyzed | live | failed'],
                    ['video_urls', 'string[]', '', 'URLs der hochgeladenen Videos'],
                    ['score_home / score_away', 'number', '', 'Endergebnis'],
                    ['camera_count', 'number', '', 'Anzahl Kameraperspektiven'],
                  ]
                },
                {
                  name: 'AnalysisReport', color: 'text-blue-400', fields: [
                    ['match_id', 'string', 'Pflicht', 'Referenz auf Match.id'],
                    ['formation_home/away', 'string', '', 'z.B. "4-3-3"'],
                    ['possession_home/away', 'number', '', 'Ballbesitz in %'],
                    ['pressing_index_home/away', 'number', '', '0–100 Pressing-Intensität'],
                    ['sprint_data', 'object[]', '', 'Sprint-Intensität pro 15-Min-Intervall'],
                    ['danger_zones', 'object[]', '', 'Heatmap-Punkte {x,y,intensity,team}'],
                    ['key_moments', 'object[]', '', 'Schlüsselszenen {minute,type,description}'],
                    ['ai_summary', 'string', '', 'KI-generierte taktische Zusammenfassung'],
                    ['ai_recommendations', 'string', '', 'KI-Trainer-Empfehlungen'],
                  ]
                },
                {
                  name: 'LiveSession', color: 'text-red-400', fields: [
                    ['match_title', 'string', 'Pflicht', 'Spieltitel für die Session'],
                    ['status', 'enum', '', 'active | paused | ended'],
                    ['camera_streams', 'object[]', '', '{camera_id, label, stream_url, status, code}'],
                    ['started_at / ended_at', 'datetime', '', 'ISO-Timestamps'],
                    ['notes', 'string', '', 'Event-Log als kommaseparierter String'],
                  ]
                },
              ].map(entity => (
                <div key={entity.name} className="bg-muted/50 rounded-lg p-4">
                  <div className={`font-grotesk font-bold text-sm mb-3 ${entity.color}`}>{entity.name}</div>
                  <div className="space-y-0">
                    {entity.fields.map(([f, t, req, desc]) => (
                      <div key={f} className="grid grid-cols-12 gap-2 py-1.5 border-b border-border/30 last:border-0 text-xs">
                        <div className="col-span-4 font-mono text-primary">{f}</div>
                        <div className="col-span-2 text-yellow-400">{t}</div>
                        <div className="col-span-1 text-red-400 text-[10px]">{req}</div>
                        <div className="col-span-5 text-muted-foreground">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={FileText} title="Seiten & Routen">
            <div className="space-y-1.5">
              {[
                ['/', 'Dashboard', 'Überblick, Stats, Formkurve, Schnellstart', 'auth'],
                ['/matches', 'Spiele', 'Liste aller Spiele, Filter, Suche', 'auth'],
                ['/matches/new', 'Neues Spiel', 'Multi-Video-Upload, Metadaten-Formular', 'auth'],
                ['/matches/:id', 'Spieldetail', 'Video-Links, KI-Analyse starten', 'auth'],
                ['/tactics/:id', 'Taktikanalyse', 'Radar, Heatmap, Pressing, Ermüdung, KI', 'auth'],
                ['/live', 'Live-Session', 'Session starten, Kamera-Setup, Event-Tapping', 'auth'],
                ['/cockpit', 'Coaching Cockpit', 'Multi-Cam-Grid, RF-DETR Tracking, Chat', 'auth'],
                ['/reports', 'Reports', 'Alle KI-Reports, Export-Funktion', 'auth'],
                ['/halftime/:id', 'Halbzeit-Analyse', 'KI-Kabinenansprache in 5 Sekunden', 'auth'],
                ['/assistant', 'KI-Assistent', 'Chat-Co-Trainer mit Spielkontext', 'auth'],
                ['/scouting', 'Gegner-Scouting', 'KI-Gegner-Profil, Stärken/Schwächen', 'auth'],
                ['/training', 'Trainingsplan', 'KI-5-Tage-Plan basierend auf Reports', 'auth'],
                ['/matchprep', 'Spielvorbereitung', 'KI-Matchplan, Formation, Warnings', 'auth'],
                ['/settings', 'Einstellungen', 'Vereinsdaten, KI-Features, Notifications', 'auth'],
                ['/cam', 'Kamera-Assistent', 'Öffentlich, kein Login — Kameramann-Interface', 'public'],
              ].map(([route, name, desc, access]) => (
                <div key={route} className="grid grid-cols-12 gap-2 py-2 border-b border-border/30 last:border-0 text-xs items-start">
                  <div className="col-span-3 font-mono text-primary">{route}</div>
                  <div className="col-span-2 font-medium text-foreground">{name}</div>
                  <div className="col-span-6 text-muted-foreground">{desc}</div>
                  <div className="col-span-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${access === 'public' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/15 text-primary'}`}>
                      {access}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── TRACKING & KI ───────────────────────────────────────────────────── */}
      {activeTab === 'tracking' && (
        <div>
          <Section icon={Cpu} title="Tracking-Engine (lib/footballTracker.js)" defaultOpen>
            <p className="text-sm text-muted-foreground mb-4">
              Die Tracking-Engine läuft vollständig im Browser. Sie unterstützt zwei Modi: Roboflow Hosted API (echte KI) und Simulation (Demo/Fallback).
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wifi className="w-4 h-4 text-primary" />
                  <span className="text-sm font-grotesk font-semibold text-primary">Roboflow Live-Modus</span>
                </div>
                <CheckItem text="RF-DETR / YOLOv11 — speziell auf Fußball trainiert" />
                <CheckItem text="Klassen: player, goalkeeper, referee, ball" />
                <CheckItem text="mAP@50: 72.5% — Precision 81.2% — Recall 68.7%" />
                <CheckItem text="Frame-Rate: 1 Frame / 2 Sekunden (API-Limit kostenlos)" />
                <CheckItem text="Browser-Kamera wird genutzt (getUserMedia)" />
                <WarnItem text="Roboflow API Key notwendig (kostenlos auf roboflow.com)" />
                <WarnItem text="HTTPS erforderlich für Kamera-Zugriff" />
              </div>
              <div className="bg-muted/50 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-grotesk font-semibold text-muted-foreground">Simulations-Modus</span>
                </div>
                <CheckItem text="Physik-basierte Spieler-Bewegung (trigonometrisch)" ok={false} />
                <CheckItem text="11 Heim + 11 Gäste + Schiedsrichter + Ball" ok={false} />
                <CheckItem text="500ms Tick-Rate — smooth Animation" ok={false} />
                <CheckItem text="Event-Simulation (Tor, Ecke) alle 40 Ticks" ok={false} />
                <CheckItem text="Kein API Key nötig — sofort nutzbar" ok={false} />
              </div>
            </div>

            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 mt-4">Verarbeitungs-Pipeline (Roboflow Modus)</div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {['Browser-Kamera', 'Video-Frame', 'Canvas-Capture (640×360)', 'JPEG Base64', 'Roboflow API POST', 'Bounding Boxes', 'Trikotfarben-Clustering', 'Team-Zuordnung', 'Kalman-Smoothing', 'Event-Erkennung', 'Canvas-Overlay'].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary px-2 py-1 rounded font-medium">{step}</span>
                  {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                </span>
              ))}
            </div>
          </Section>

          <Section icon={Users} title="Team-Erkennung (Trikotfarben-Clustering)">
            <p className="text-sm text-muted-foreground mb-3">
              Da das Roboflow-Modell Spieler nicht teams-spezifisch labeliert, nutzt TactIQ ein K-Means-Clustering auf Trikotfarben zur Team-Zuordnung.
            </p>
            <CodeBlock code={`Algorithmus:
1. Für jeden erkannten Spieler: Canvas-Pixel im Jersey-Bereich samplen
   → Obere 30% der Bounding Box (Trikot-Region)
   → Durchschnitts-RGB berechnen → RGB zu HSV-Hue konvertieren

2. K-Means mit k=2 auf Hue-Werte (10 Iterationen)
   → Cluster-Zentrum 1 = Team Heim
   → Cluster-Zentrum 2 = Team Gäste

3. Spieler wird dem nächsten Cluster-Zentrum zugeordnet
   → Hue-Distanz berechnen (zirkulär, 360°-Wraparound)

Bekannte Limitierungen:
- Funktioniert nicht bei ähnlichen Trikotfarben (z.B. beide dunkel)
- CORS-Einschränkungen bei externen Video-Streams blockieren Canvas.getImageData()
- Schiedsrichter werden separat erkannt (eigene Klasse im Modell)`} />
          </Section>

          <Section icon={Zap} title="Automatische Event-Erkennung">
            <div className="space-y-3">
              {[
                {
                  event: '⚽ Tor', rule: 'Ball.x < 5% UND Ball.y ∈ [35%,65%] → Tor Gäste-Seite\nBall.x > 95% UND Ball.y ∈ [35%,65%] → Tor Heim-Seite',
                  limits: 'Pixel-genaue Torlinie nicht möglich ohne Kalibrierung. Falsch-Positive bei Ecken möglich.'
                },
                {
                  event: '📐 Ecke', rule: 'Ball.x < 6% ODER Ball.x > 94%\nUND Ball.y < 6% ODER Ball.y > 94%',
                  limits: 'Funktioniert nur bei korrekter Kamera-Perspektive (von oben/schräg).'
                },
                {
                  event: '🟥 Foul', rule: 'Schiedsrichter erkannt UND ≥3 Spieler im Radius 8% um Schiedsrichter',
                  limits: 'Kein direkter Kontakt-Nachweis. Hohe Falsch-Positive-Rate bei Standardsituationen.'
                },
                {
                  event: '⚡ Konter', rule: 'Ball-Position Δ > 25% des Spielfelds zwischen zwei Frames (2 Sekunden)',
                  limits: 'Kamera-Schwenks können falsche Konter auslösen.'
                },
              ].map(({ event, rule, limits }) => (
                <div key={event} className="bg-muted/50 rounded-lg p-4">
                  <div className="font-grotesk font-semibold text-foreground mb-2">{event}</div>
                  <div className="text-xs font-mono text-primary bg-black/20 rounded p-2 mb-2 whitespace-pre">{rule}</div>
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">{limits}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={Bot} title="KI-Integration (Base44 LLM)">
            <p className="text-sm text-muted-foreground mb-3">Alle KI-Textfunktionen nutzen <code className="text-primary">base44.integrations.Core.InvokeLLM()</code> — kein direkter API-Key notwendig.</p>
            <div className="space-y-2">
              {[
                ['Taktik-Analyse', '/tactics/:id → KI-Analyse starten', 'GPT-4o-mini via Base44', 'JSON mit 15+ Metriken'],
                ['Halbzeit-Ansprache', '/halftime/:id', 'GPT-4o-mini', '3-5 Coaching-Punkte'],
                ['KI-Assistent', '/assistant', 'GPT-4o-mini + Spielkontext', 'Chat-Konversation'],
                ['Scouting', '/scouting', 'GPT-4o-mini + Internetsuche', 'Gegner-Profil'],
                ['Trainingsplan', '/training', 'GPT-4o-mini', '5-Tage-Wochenplan'],
                ['Matchplan', '/matchprep', 'GPT-4o-mini', 'Formation + Taktik-Anweisungen'],
              ].map(([feature, route, model, output]) => (
                <div key={feature} className="grid grid-cols-12 gap-2 text-xs py-2 border-b border-border/30 last:border-0">
                  <div className="col-span-3 font-medium text-foreground">{feature}</div>
                  <div className="col-span-3 text-muted-foreground">{route}</div>
                  <div className="col-span-3 text-blue-400 font-mono">{model}</div>
                  <div className="col-span-3 text-muted-foreground">{output}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── SICHERHEIT ──────────────────────────────────────────────────────── */}
      {activeTab === 'sicherheit' && (
        <div>
          <Section icon={Shield} title="Authentifizierung & Autorisierung" defaultOpen>
            <CheckItem text="Alle Seiten außer /cam sind login-geschützt (Base44 AuthProvider)" />
            <CheckItem text="JWT-Sessions — verwaltet von Base44 Platform" />
            <CheckItem text="Rollen-System: admin (voller Zugriff), user (Standard-Trainer)" />
            <CheckItem text="/cam ist bewusst public — Kameramann braucht kein Konto" />
            <CheckItem text="Session-Codes sind 6-stellig zufällig — nur für Session-Dauer gültig" />
            <WarnItem text="Codes sind nicht kryptografisch sicher — nur für interne Nutzung geeignet" />
            <WarnItem text="Kein Brute-Force-Schutz auf Code-Eingabe implementiert" />

            <div className="mt-4 bg-muted/50 rounded-lg p-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">User Roles</div>
              <InfoRow label="admin" value="Kann alle Daten sehen, User einladen, Settings ändern" />
              <InfoRow label="user" value="Standard-Trainer: Matches, Analysen, Live-Sessions" />
            </div>
          </Section>

          <Section icon={Lock} title="Datenschutz & Mandantensicherheit">
            <p className="text-sm text-muted-foreground mb-3">TactIQ nutzt die Base44-Plattform, die alle Daten pro App isoliert.</p>
            <CheckItem text="Jede App-Instanz ist vollständig isoliert — keine Cross-App-Datenzugriffe" />
            <CheckItem text="Daten werden in der Base44-Cloud gespeichert (EU-Region)" />
            <CheckItem text="Roboflow API Key wird als Secret gespeichert — nie im Code" />
            <CheckItem text="Video-URLs werden als signierte URLs gespeichert (zeitlich begrenzt)" />
            <WarnItem text="Mehrmandanten-Betrieb (mehrere Vereine in einer App) ist NICHT implementiert" />
            <WarnItem text="Für Mehrverein-Betrieb: separate App-Instanzen pro Verein empfohlen" />

            <div className="mt-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
              <div className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2">⚠ Für echten Mehrmandanten-Betrieb</div>
              <div className="text-xs text-foreground/80 space-y-1">
                <p>▸ Row-Level-Security auf allen Entities aktivieren (Base44 Dashboard → Entity → RLS)</p>
                <p>▸ Alle Queries mit <code className="text-primary">created_by: user.email</code> filtern ODER</p>
                <p>▸ Separate Base44-App-Instanz pro Verein erstellen (empfohlen für echte Isolation)</p>
              </div>
            </div>
          </Section>

          <Section icon={Globe} title="Secrets & Konfiguration">
            <div className="space-y-2">
              {[
                ['ROBOFLOW_API_KEY', 'Roboflow API Key für RF-DETR Tracking', 'Optional — nur für Live-Tracking', 'Base44 Secrets'],
              ].map(([key, desc, required, storage]) => (
                <div key={key} className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-primary text-xs font-bold">{key}</code>
                    <span className="text-[10px] text-muted-foreground">{storage}</span>
                  </div>
                  <div className="text-xs text-foreground/70">{desc}</div>
                  <div className="text-[10px] text-yellow-400 mt-1">{required}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Secrets werden über Base44 Dashboard → App Settings → Secrets verwaltet und nie im Quellcode gespeichert.
              Im Frontend abrufbar via <code className="text-primary">import.meta.env.VITE_ROBOFLOW_API_KEY</code> (wenn als Vite Env gesetzt).
            </div>
          </Section>
        </div>
      )}

      {/* ── API & INTEGRATION ───────────────────────────────────────────────── */}
      {activeTab === 'api' && (
        <div>
          <Section icon={Code2} title="Base44 SDK — Daten-API" defaultOpen>
            <CodeBlock code={`// Entity CRUD
import { base44 } from '@/api/base44Client';

// Liste (sort, limit)
const matches = await base44.entities.Match.list('-created_date', 20);

// Filter
const active = await base44.entities.LiveSession.filter({ status: 'active' });

// Erstellen
const match = await base44.entities.Match.create({ title: '...', date: '...' });

// Aktualisieren
await base44.entities.Match.update(match.id, { status: 'analyzed' });

// Löschen
await base44.entities.Match.delete(match.id);

// Echtzeit-Subscriptions
const unsub = base44.entities.Match.subscribe((event) => {
  // event.type: 'create' | 'update' | 'delete'
  // event.data: aktualisiertes Objekt
});
unsub(); // cleanup`} />
          </Section>

          <Section icon={Cpu} title="Roboflow API — RF-DETR Inference">
            <CodeBlock code={`// Endpunkt
POST https://detect.roboflow.com/football-players-detection-3zvbc-4bgah/2
  ?api_key=YOUR_KEY
  &confidence=35
  &overlap=30

// Request Body: Base64-kodiertes JPEG (kein Data-URL-Prefix!)
Content-Type: application/x-www-form-urlencoded
Body: <base64-jpeg-string>

// Response
{
  "predictions": [
    {
      "x": 320,          // Mittelpunkt X in Pixel
      "y": 240,          // Mittelpunkt Y in Pixel
      "width": 45,       // Breite in Pixel
      "height": 80,      // Höhe in Pixel
      "confidence": 0.87,
      "class": "player"  // player | goalkeeper | referee | ball
    }
  ],
  "image": { "width": 640, "height": 360 }
}

// Rate Limits (kostenloser Plan)
- 10.000 Predictions / Monat
- ~1 Frame / 2 Sekunden empfohlen
- Keine Rate-Limiting-Header — manuell drosseln`} />
          </Section>

          <Section icon={Bot} title="Base44 LLM Integration">
            <CodeBlock code={`// Taktik-Analyse (strukturierter JSON-Output)
const result = await base44.integrations.Core.InvokeLLM({
  prompt: "Du bist KI-Trainer. Analysiere...",
  response_json_schema: {
    type: 'object',
    properties: {
      formation_home: { type: 'string' },
      pressing_index_home: { type: 'number' },
      ai_summary: { type: 'string' },
      // ... weitere Felder
    }
  }
});
// result ist direkt ein JS-Objekt (kein JSON.parse nötig)

// Chat-Antwort (Freitext)
const text = await base44.integrations.Core.InvokeLLM({
  prompt: "Beantworte als Co-Trainer: " + userQuestion
});
// text ist ein String

// File Upload
const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });`} />
          </Section>

          <Section icon={Camera} title="Kamera-System (/cam)">
            <CodeBlock code={`// Flow: Trainer → Assistent
1. Trainer erstellt Live-Session in /live
   → Session hat camera_streams: [{ camera_id, label, code: '382741' }]

2. Trainer teilt Code/Link via /cockpit → Share-Button
   → Link: https://app.domain/cam?code=382741
   → WhatsApp-Template automatisch vorbereitet

3. Assistent öffnet /cam auf Handy
   → Code auto-befüllt aus URL-Parameter
   → getUserMedia() → Rear-Kamera (environment)
   → Video wird lokal angezeigt (kein Streaming-Server)

4. Heartbeat alle 10s
   → LiveSession.camera_streams[n].status = 'connected'
   → LiveSession.camera_streams[n].last_seen = ISO-Timestamp

WICHTIG: Echtes Video-Streaming (WebRTC/RTSP) ist NICHT implementiert.
Die Kamera-Feeds im Cockpit zeigen Platzhalter.
Für echtes Multi-Cam-Streaming: WebRTC-Server (z.B. mediasoup, LiveKit) notwendig.`} />
          </Section>
        </div>
      )}

      {/* ── SKALIERUNG ──────────────────────────────────────────────────────── */}
      {activeTab === 'skalierung' && (
        <div>
          <Section icon={Globe} title="Aktuelle Architektur-Limits" defaultOpen>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Was gut skaliert ✅</div>
                <CheckItem text="Base44 DB: unbegrenzte Entities, automatisches Sharding" />
                <CheckItem text="React SPA: statisch ausgeliefert, kein Server-Load" />
                <CheckItem text="Roboflow API: horizontal skalierbar (mehr API Keys)" />
                <CheckItem text="LLM-Integration: Base44 managed, kein eigener Overhead" />
                <CheckItem text="Kamera-Codes: stateless, kein Session-Server nötig" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-yellow-400 mb-3">Was Grenzen hat ⚠</div>
                <WarnItem text="Video-Streaming: kein WebRTC-Server → kein echter Live-Feed" />
                <WarnItem text="Tracking: 1 FPS (Roboflow kostenlos) → kein Echtzeit-60fps" />
                <WarnItem text="Kein Offline-Modus — alles benötigt Internetverbindung" />
                <WarnItem text="Keine lokale KI — RF-DETR läuft nicht im Browser (500MB)" />
                <WarnItem text="Mehrmandanten: keine Datenisolation zwischen Teams in einer App" />
              </div>
            </div>
          </Section>

          <Section icon={Server} title="Upgrade-Pfad für Production">
            <div className="space-y-3">
              {[
                {
                  step: '1. Mehr Tracking-Leistung',
                  icon: Cpu,
                  color: 'text-primary',
                  desc: 'Roboflow Professional Plan → bis zu 60 FPS Inference. Oder eigener Python-Server mit RF-DETR + FastAPI + WebSocket → Base44 Backend Functions (Builder+ Plan).'
                },
                {
                  step: '2. Echtes Video-Streaming',
                  icon: Camera,
                  color: 'text-blue-400',
                  desc: 'WebRTC-Server integrieren (z.B. LiveKit, mediasoup, Cloudflare Calls). Trainer-Cockpit empfängt echte Video-Streams von Handy-Kameras.'
                },
                {
                  step: '3. Mehrmandanten (Mehrere Vereine)',
                  icon: Users,
                  color: 'text-purple-400',
                  desc: 'Option A: Separate Base44-App-Instanz pro Verein. Option B: Mandant-ID auf alle Entities, RLS-Regeln aktivieren, Queries immer mit club_id filtern.'
                },
                {
                  step: '4. Offline / Stadion-Betrieb',
                  icon: Wifi,
                  color: 'text-orange-400',
                  desc: 'PWA (Service Worker) für Offline-Caching der App-Shell. Lokales YOLO-Modell via ONNX.js im Browser (limitierte Genauigkeit). IndexedDB für lokale Daten-Pufferung.'
                },
              ].map(({ step, icon: Icon, color, desc }) => (
                <div key={step} className="bg-muted/50 rounded-lg p-4">
                  <div className={`flex items-center gap-2 font-grotesk font-semibold text-sm mb-2 ${color}`}>
                    <Icon className="w-4 h-4" /> {step}
                  </div>
                  <p className="text-xs text-foreground/70">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={BarChart3} title="Performance-Empfehlungen">
            <CheckItem text="TanStack Query nutzen (bereits implementiert) — automatisches Caching & Refetching" />
            <CheckItem text="Roboflow-Frames auf 640×360 komprimieren (JPEG 70%) — reduziert API-Kosten um 60%" />
            <CheckItem text="Kalman-Smoother bereits implementiert — verhindert jitternde Tracking-Overlays" />
            <CheckItem text="Stats-History auf 30 Frames begrenzt — konstanter Memory-Footprint" />
            <CheckItem text="useEffect-Cleanup für alle Intervals/Streams — kein Memory-Leak" />
            <WarnItem text="Auf mobilen Geräten: canvas.getImageData() kann bei hoher Auflösung langsam sein" />
            <WarnItem text="Zu viele gleichzeitige LLM-Anfragen können Rate-Limits auslösen" />
          </Section>
        </div>
      )}

      {/* ── TROUBLESHOOT ────────────────────────────────────────────────────── */}
      {activeTab === 'troubleshoot' && (
        <div>
          <Section icon={AlertTriangle} title="Häufige Probleme & Lösungen" defaultOpen>
            <div className="space-y-3">
              {[
                {
                  prob: 'Kamera-Zugriff verweigert im Cockpit',
                  sol: 'HTTPS erforderlich. Lokale Entwicklung: http://localhost ist erlaubt. Bei "NotAllowedError" Browser-Kamera-Berechtigung prüfen.',
                  sev: 'warn'
                },
                {
                  prob: 'Roboflow API gibt 403 zurück',
                  sol: 'API Key ungültig oder abgelaufen. Roboflow Dashboard → Settings → API Key → neu generieren.',
                  sev: 'error'
                },
                {
                  prob: 'Tracking zeigt keine Spieler (Roboflow Modus)',
                  sol: 'Confidence-Threshold zu hoch (Standard 35%). Alternativ: Bildhelligkeit zu gering, Kamerawinkel zu flach. Auf Simulation wechseln zum Testen.',
                  sev: 'warn'
                },
                {
                  prob: 'Team-Farb-Clustering falsch (alle Spieler eine Farbe)',
                  sol: 'CORS blockiert canvas.getImageData() → Team-Zuordnung fällt auf Fallback zurück. Bei eigenem Video-Stream CORS-Header setzen.',
                  sev: 'warn'
                },
                {
                  prob: 'KI-Analyse bleibt bei "processing" hängen',
                  sol: 'LLM-Timeout nach ~60s. Match-Status manuell auf "failed" setzen via DB. Dann erneut analysieren. Prüfe ob Base44 Integration-Credits ausreichend.',
                  sev: 'error'
                },
                {
                  prob: 'Kameramann kann sich nicht verbinden (/cam)',
                  sol: 'Muss eine aktive LiveSession existieren (Status: active). Session in /live erstellen und starten bevor Kodes geteilt werden.',
                  sev: 'warn'
                },
                {
                  prob: 'Dashboard zeigt keine Formkurve',
                  sol: 'Mindestens 2 AnalysisReports erforderlich. Spiele analysieren um Reports zu generieren.',
                  sev: 'info'
                },
                {
                  prob: 'Halbzeit-Analyse zeigt keine Daten',
                  sol: 'Spiel muss Status "analyzed" haben (AnalysisReport existieren). Erst KI-Analyse durchführen.',
                  sev: 'info'
                },
              ].map(({ prob, sol, sev }) => (
                <div key={prob} className={`rounded-lg p-4 border ${sev === 'error' ? 'border-red-500/30 bg-red-500/5' : sev === 'warn' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border bg-muted/30'}`}>
                  <div className={`text-xs font-bold mb-1.5 ${sev === 'error' ? 'text-red-400' : sev === 'warn' ? 'text-yellow-400' : 'text-foreground'}`}>
                    {sev === 'error' ? '🔴' : sev === 'warn' ? '🟡' : 'ℹ'} {prob}
                  </div>
                  <div className="text-xs text-foreground/70">{sol}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section icon={Settings} title="Diagnose-Checkliste">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">System-Health Check</div>
            <div className="space-y-1">
              <CheckItem text="Base44 Auth funktioniert → Dashboard lädt ohne Fehler" />
              <CheckItem text="DB Connectivity → Matches/Reports werden geladen" />
              <CheckItem text="LLM Integration → KI-Assistent antwortet" />
              <CheckItem text="File Upload → Video-Upload in /matches/new funktioniert" />
              <CheckItem text="Live-Session → Session erstellen/beenden in /live" />
              <CheckItem text="Cockpit → Simulation läuft (kein API Key nötig)" />
              <CheckItem text="CameraView → /cam öffnet ohne Login" />
              <CheckItem text="Roboflow (optional) → API Key eingeben → Tracking startet" />
            </div>
          </Section>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 glass rounded-xl p-5 text-center">
        <div className="text-xs text-muted-foreground">
          TactIQ Admin-Dokumentation · Version 2.0 · April 2026 ·
          Bei Fragen: <span className="text-primary">Base44 Support → support.base44.com</span>
        </div>
      </div>
    </div>
  );
}