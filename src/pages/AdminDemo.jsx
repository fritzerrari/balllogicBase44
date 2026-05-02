import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Play, Square, Radio, Camera, Zap, Clock, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DEMO_STEPS = [
  {
    id: 'setup',
    title: '1. Session Setup',
    description: 'Trainer konfiguriert neue Live-Session',
    visual: (
      <div className="space-y-3">
        <div className="bg-muted rounded-lg p-4">
          <div className="text-sm font-bold text-foreground mb-2">📝 Spieltitel</div>
          <input className="w-full bg-background border border-border rounded px-3 py-2 text-sm" value="FC Bayern vs BVB" readOnly />
        </div>
        <div className="bg-muted rounded-lg p-4">
          <div className="text-sm font-bold text-foreground mb-2">📹 Kameraanzahl</div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 bg-background border border-border rounded">−</button>
            <span className="font-bold text-2xl text-primary w-8 text-center">3</span>
            <button className="px-2 py-1 bg-background border border-border rounded">+</button>
          </div>
        </div>
        <div className="space-y-2">
          {['Kamera 1', 'Kamera 2', 'Kamera 3'].map((cam, i) => (
            <div key={i} className="bg-background border border-border rounded p-3 flex items-center justify-between">
              <span className="text-sm">{cam}</span>
              <code className="text-xs font-bold text-primary tracking-widest">{String(123456 + i)}</code>
            </div>
          ))}
        </div>
      </div>
    ),
    outcome: '✓ Session erstellt, Codes bereit zum Teilen',
  },
  {
    id: 'connect',
    title: '2. Kameras verbinden',
    description: 'Kameramänner geben Code ein und starten Livebilder',
    visual: (
      <div className="space-y-3">
        {[
          { label: 'Kamera 1', status: 'connected', thumb: true },
          { label: 'Kamera 2', status: 'connected', thumb: true },
          { label: 'Kamera 3', status: 'waiting', thumb: false },
        ].map((cam, i) => (
          <div key={i} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-black h-24 flex items-center justify-center relative">
              {cam.thumb ? (
                <div className="w-full h-full bg-gradient-to-br from-green-600 to-green-900 flex items-center justify-center text-white text-xs font-bold">
                  LIVE: {cam.label}
                </div>
              ) : (
                <div className="text-white/40 text-xs">Wartet auf Kamera...</div>
              )}
              {cam.status === 'connected' && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                </div>
              )}
            </div>
            <div className="p-2 text-xs text-muted-foreground flex items-center justify-between">
              <span>{cam.label}</span>
              <Badge variant={cam.status === 'connected' ? 'default' : 'outline'} className="text-[10px]">
                {cam.status === 'connected' ? '✓ Verbunden' : 'Wartet'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    ),
    outcome: '✓ 2 von 3 Kameras connected, Live kann starten',
  },
  {
    id: 'live',
    title: '3. Live Monitoring',
    description: 'Trainer überwacht Spiel, registriert Events',
    visual: (
      <div className="space-y-3">
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-bold text-foreground">LIVE</span>
            </div>
            <span className="font-mono text-primary font-bold text-2xl">23:45</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
            <div className="bg-background rounded p-2">
              <div className="font-bold text-primary">2</div>
              <div className="text-muted-foreground">Tore</div>
            </div>
            <div className="bg-background rounded p-2">
              <div className="font-bold text-primary">1</div>
              <div className="text-muted-foreground">Gelb</div>
            </div>
            <div className="bg-background rounded p-2">
              <div className="font-bold text-primary">3</div>
              <div className="text-muted-foreground">Events</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['⚽', '🎯', '🟨', '📐'].map((icon, i) => (
              <button key={i} className="py-3 rounded-lg bg-primary/15 border border-primary/30 text-primary font-bold text-sm active:scale-95 transition-all">
                {icon}
                <div className="text-[10px]">Event</div>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
          <div className="flex gap-2"><span className="text-primary font-bold min-w-8">12'</span> ⚽ Tor (Heim)</div>
          <div className="flex gap-2"><span className="text-primary font-bold min-w-8">18'</span> 🎯 Chance (Gäste)</div>
          <div className="flex gap-2"><span className="text-primary font-bold min-w-8">23'</span> ⚽ Tor (Heim)</div>
        </div>
      </div>
    ),
    outcome: '✓ Events registriert, Session läuft sauber',
  },
  {
    id: 'halftime',
    title: '4. Halbzeit-Management',
    description: 'Nach 45 Minuten: Automatischer Alert + Seitenwechsel',
    visual: (
      <div className="space-y-3">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-yellow-500/15 border border-yellow-500/40 rounded-lg p-4 text-center">
          <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
          <div className="font-bold text-foreground mb-1">45 Minuten erreicht!</div>
          <div className="text-xs text-muted-foreground mb-3">Ist jetzt Halbzeit?</div>
          <div className="flex gap-2">
            <button className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-sm rounded transition-all">
              Ja, 2. HZ starten
            </button>
            <button className="flex-1 py-2 bg-muted border border-border text-muted-foreground text-sm rounded transition-all">
              Weiterlaufen
            </button>
          </div>
        </motion.div>
        <div className="bg-muted rounded-lg p-4 text-center">
          <div className="text-sm text-muted-foreground mb-2">Nach 2. HZ Start:</div>
          <div className="font-bold text-foreground">2. Halbzeit · Minute 46'</div>
          <div className="text-xs text-primary mt-1">→ Kameras zeigen Seitenwechsel-Banner</div>
        </div>
      </div>
    ),
    outcome: '✓ Automatische Halbzeit-Verwaltung, Minute korrekt berechnet',
  },
  {
    id: 'end',
    title: '5. Session Beenden',
    description: 'Report-Generierung, Daten-Cleanup, archiviert',
    visual: (
      <div className="space-y-3">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-foreground">Session beendet</div>
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-primary flex-shrink-0 mt-0.5" /> Session.status = "ended"</div>
            <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-primary flex-shrink-0 mt-0.5" /> Match.status = "analyzed"</div>
            <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-primary flex-shrink-0 mt-0.5" /> FunkMessages gelöscht</div>
            <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-primary flex-shrink-0 mt-0.5" /> SessionReport erstellt</div>
            <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-primary flex-shrink-0 mt-0.5" /> Redirect zu Reports</div>
          </div>
        </motion.div>
        <div className="bg-muted rounded-lg p-4">
          <div className="text-xs font-bold text-foreground mb-2">📊 Generierter Report</div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Session: FC Bayern vs BVB</div>
            <div>Duration: 90 minutes</div>
            <div>Events: 12 gesamt</div>
            <div>Goals: 2, Cards: 1, Subs: 0</div>
            <div>Status: ✓ mit Match verknüpft</div>
          </div>
        </div>
      </div>
    ),
    outcome: '✓ Vollständiger Datenzyklus, keine orphaned Events',
  },
];

const BEST_PRACTICES = [
  {
    title: '✓ Session mit Match verknüpft',
    desc: 'Jede Session MUSS match_id haben',
    icon: <CheckCircle2 className="w-5 h-5 text-primary" />,
  },
  {
    title: '✓ Alle Kameras connected',
    desc: 'Vor Live-Start: Status GREEN für alle',
    icon: <Camera className="w-5 h-5 text-primary" />,
  },
  {
    title: '✓ Events mit session_id',
    desc: 'Blockiert: EventButtons ohne Session',
    icon: <Zap className="w-5 h-5 text-primary" />,
  },
  {
    title: '✓ Report nach Session',
    desc: 'Auto-generiert, immer mit Match-ID',
    icon: <Activity className="w-5 h-5 text-primary" />,
  },
  {
    title: '✓ Rate-Limits beachtet',
    desc: 'Polling: 8s (Kamera), 4s (Funk), 20s (HB)',
    icon: <Radio className="w-5 h-5 text-primary" />,
  },
  {
    title: '✓ DSGVO-Consent geprüft',
    desc: 'Alle Spieler: Tracking-Consent dokumentiert',
    icon: <CheckCircle2 className="w-5 h-5 text-primary" />,
  },
];

const PROBLEMS = [
  {
    problem: '❌ Events ohne Session',
    solution: 'EventButtons sind disabled wenn sessionId=null. Ui zeigt "Keine aktive Session".',
    fixed: true,
  },
  {
    problem: '❌ Orphaned MatchEvents',
    solution: 'Validierung + Admin-Recovery-Tool im AdminDashboard zum Löschen',
    fixed: true,
  },
  {
    problem: '❌ Report ohne Match-ID',
    solution: 'SessionReport MUSS match_id haben, sonst wird blockiert',
    fixed: true,
  },
  {
    problem: '❌ Kamera verbindet nicht',
    solution: 'Fallback-Versuche (4K→720p→auto), HTTPS-Check, Browser-Permissions',
    fixed: true,
  },
];

function DemoStep({ step, isActive, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className={`text-left w-full p-4 rounded-xl transition-all border ${
        isActive
          ? 'bg-primary/10 border-primary/40'
          : 'bg-muted border-border hover:border-primary/30'
      }`}
    >
      <div className="font-bold text-foreground text-sm">{step.title}</div>
      <div className="text-xs text-muted-foreground">{step.description}</div>
    </motion.button>
  );
}

export default function AdminDemo() {
  const [activeStep, setActiveStep] = useState('setup');

  const currentStep = DEMO_STEPS.find(s => s.id === activeStep);

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <h1 className="text-3xl font-grotesk font-bold text-foreground mb-2">TactIQ — Sollzustand Demo</h1>
          <p className="text-muted-foreground">Idealer Workflow für Live-Sessions: Setup → Verbindung → Monitoring → Beendigung → Report</p>
        </motion.div>

        {/* Main Demo */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Step List */}
          <div className="space-y-2">
            {DEMO_STEPS.map(step => (
              <DemoStep
                key={step.id}
                step={step}
                isActive={activeStep === step.id}
                onClick={() => setActiveStep(step.id)}
              />
            ))}
          </div>

          {/* Visualization */}
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 border border-primary/20"
          >
            <div className="mb-4">
              <h2 className="font-grotesk font-bold text-lg text-foreground mb-1">{currentStep.title}</h2>
              <p className="text-sm text-muted-foreground">{currentStep.description}</p>
            </div>

            <div className="space-y-4 mb-6">{currentStep.visual}</div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                {currentStep.outcome}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Best Practices */}
        <section className="mb-8">
          <h2 className="font-grotesk font-bold text-2xl text-foreground mb-4">🎯 Best Practices im Idealzustand</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BEST_PRACTICES.map((bp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-4 border border-primary/20 flex items-start gap-3"
              >
                {bp.icon}
                <div>
                  <div className="font-bold text-foreground text-sm">{bp.title}</div>
                  <div className="text-xs text-muted-foreground">{bp.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Problem Fixes */}
        <section className="mb-8">
          <h2 className="font-grotesk font-bold text-2xl text-foreground mb-4">🔧 Implementierte Fixes</h2>
          <div className="space-y-3">
            {PROBLEMS.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-xl p-4 border ${p.fixed ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}
              >
                <div className="flex items-start gap-3">
                  {p.fixed ? (
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground text-sm mb-1">{p.problem}</div>
                    <div className="text-xs text-muted-foreground">{p.solution}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="p-6 bg-muted/30 rounded-2xl border border-border text-center text-sm text-muted-foreground">
          <p className="mb-2">🎬 Diese Demo zeigt den idealen Zustand einer Live-Session</p>
          <p>Siehe <strong>Admin-Handbuch</strong> für technische Details, Troubleshooting und Admin-Tools</p>
        </motion.div>
      </div>
    </div>
  );
}