import { motion } from 'framer-motion';
import { FileText, CheckCircle2, TrendingUp, BarChart3, Calendar, Clock, Users, Trophy, Radar, AlertTriangle, Lightbulb, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminExampleReport() {
  return (
    <div className="min-h-screen p-4 lg:p-8 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-5xl mx-auto">
        {/* Cover */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-block p-8 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mb-6">
            <h1 className="text-5xl font-grotesk font-bold text-foreground mb-2">Vollständiger Spielbericht</h1>
            <p className="text-2xl text-primary font-bold">Viktoria Aschaffenburg U19 vs ASV Cham</p>
            <div className="mt-4 text-5xl font-grotesk font-bold text-foreground">3 : 0</div>
            <p className="text-sm text-muted-foreground mt-4">Sonntag, 19. April 2026 • Hauptplatz</p>
          </div>
        </motion.div>

        {/* Management Summary */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 border border-primary/20 mb-8">
          <h2 className="text-2xl font-grotesk font-bold text-foreground mb-4 flex items-center gap-2">
            🎯 Management Summary
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Die Viktoria Aschaffenburg U19 setzte sich im 6v6-Format dank ihrer beeindruckenden Effizienz im Abschluss mit 3:0 gegen ASV Cham durch. Tore von Bieber (14'), Gutermann (60') und Antoni (88') unterstreichen die überragende Chancenverwertung von 60% bei 100% Schussgenauigkeit aufs Tor. Trotz einer phasenweise hohen Foulintensität (5 Fouls in der ersten halben Stunde), konnte die Defensive sicher stehen und ließ nur 2 Torschüsse der Gäste zu.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-primary">8/10</div>
              <div className="text-xs text-muted-foreground mt-1">GESAMTNOTE</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-primary">3:0</div>
              <div className="text-xs text-muted-foreground mt-1">ENDERGEBNIS</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-primary">23</div>
              <div className="text-xs text-muted-foreground mt-1">EVENTS ERFASST</div>
            </div>
          </div>
        </motion.div>

        {/* Tabs für Detail-Abschnitte */}
        <Tabs defaultValue="performance" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-5 gap-1 bg-muted/30 p-1">
            <TabsTrigger value="performance" className="text-xs lg:text-sm">Performance</TabsTrigger>
            <TabsTrigger value="analyse" className="text-xs lg:text-sm">Analyse</TabsTrigger>
            <TabsTrigger value="taktik" className="text-xs lg:text-sm">Taktik</TabsTrigger>
            <TabsTrigger value="coaching" className="text-xs lg:text-sm">Coaching</TabsTrigger>
            <TabsTrigger value="training" className="text-xs lg:text-sm">Training</TabsTrigger>
          </TabsList>

          {/* Performance */}
          <TabsContent value="performance" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">📊 Performance-Cockpit</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: '📊', label: 'Gesamtnote', value: '8/10' },
                  { icon: '⚽', label: 'Tore', value: '3' },
                  { icon: '📋', label: 'Events', value: '23' },
                  { icon: '📐', label: 'Ecken', value: '2' },
                ].map((stat, i) => (
                  <div key={i} className="bg-muted/50 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-1">{stat.icon}</div>
                    <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                    <div className="font-bold text-primary">{stat.value}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">⭐ Top-Erkenntnisse</h3>
              <div className="space-y-3">
                {[
                  { num: 1, title: 'Klinische Chancenverwertung', desc: '60% der Torschüsse wurden in Tore umgemünzt (3 Tore aus 5)' },
                  { num: 2, title: 'Defensiv-Stabilität', desc: 'Nur 2 Torschüsse des Gegners zugelassen, kein Gegentor' },
                  { num: 3, title: 'Frühe Aggressivität', desc: '5 Fouls in den ersten 30 Minuten, aggressives Pressing' },
                  { num: 4, title: 'Umschaltstärke', desc: 'Das 3:0 in der 88. Minute aus effektivem Konter' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">{item.num}</div>
                    <div>
                      <div className="font-medium text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* Analyse */}
          <TabsContent value="analyse" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">📈 Spielverlauf & Momentum</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Viktoria Aschaffenburg übernahm von Beginn an die Kontrolle mit früher Führung (14'). Obwohl ASV Cham zwischenzeitlich Momente der Gefahr erzeugte, zog die Heimelf mit dem 2:0 (60') das Momentum endgültig auf ihre Seite. Das 3:0 (88') unterstrich die konstante Überlegenheit.
              </p>
              <div className="bg-muted/30 rounded-lg p-4 text-center text-sm text-muted-foreground">
                📊 Momentum-Kurve: Heim durchgehend dominant
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">⏱️ Event-Chronik (Auszug)</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[
                  { min: '14\'', icon: '⚽', event: 'Tor — Nico Bieber (Viktoria Ascha)' },
                  { min: '21\'', icon: '🎯', event: 'Chance (Viktoria Ascha)' },
                  { min: '30\'', icon: '🎯', event: 'Chance (ASV Cham)' },
                  { min: '38\'', icon: '🟨', event: 'Gelb (ASV Cham)' },
                  { min: '60\'', icon: '⚽', event: 'Tor — Daniel Gutermann (Viktoria Ascha)' },
                  { min: '88\'', icon: '⚽', event: 'Tor — Paul Antoni (Viktoria Ascha)' },
                ].map((e, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors text-sm">
                    <span className="font-mono text-primary font-bold min-w-10">{e.min}</span>
                    <span className="text-lg">{e.icon}</span>
                    <span className="text-muted-foreground">{e.event}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* Taktik */}
          <TabsContent value="taktik" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">🎛️ Taktische Bewertung</h3>
              <div className="space-y-4">
                <div>
                  <div className="font-medium text-foreground mb-2">Positionsgruppen:</div>
                  <div className="space-y-2">
                    {[
                      { pos: 'Abwehr', grade: 'A', desc: 'Herausragend, ließ nur 2 Torschüsse zu, blieb ohne Gegentor' },
                      { pos: 'Mittelfeld', grade: 'B', desc: 'Gute Ballkontrolle und wenige Ballverluste' },
                      { pos: 'Angriff', grade: 'A', desc: 'Klinisch präzise, 3 Tore aus 5 Torschüssen' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <Badge className={item.grade === 'A' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}>
                          {item.grade}
                        </Badge>
                        <div>
                          <div className="font-medium text-foreground text-sm">{item.pos}</div>
                          <div className="text-xs text-muted-foreground">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">💪 SWOT-Analyse</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="font-bold text-green-400 mb-2">✅ Stärken</div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Klinische Chancenverwertung (60%)</li>
                    <li>• Defensiv-Stabilität (0 Gegentore)</li>
                    <li>• Umschaltspiel (3:0 in 88')</li>
                    <li>• Physische Ausdauer (114 Min)</li>
                  </ul>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="font-bold text-red-400 mb-2">⚠️ Schwächen</div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Hohe Foulfrequenz (5 in 30 Min)</li>
                    <li>• Timing-Probleme Defensiv</li>
                    <li>• Standard-Abschlüsse (0 Tore)</li>
                    <li>• Statisches Mittelfeld (phasenweise)</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* Coaching */}
          <TabsContent value="coaching" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">🧠 Coaching-Insights</h3>
              <div className="space-y-4">
                {[
                  { 
                    title: 'Pressingintensität vs. Foulspiel',
                    desc: 'Hohe Pressingbereitschaft war entscheidend, aber 5 Fouls in 30 Min zu viel. Balance zwischen Aggressivität und Disziplin finden.',
                    impact: '7/10'
                  },
                  { 
                    title: 'Klinischer Abschluss als Erfolgsfaktor',
                    desc: '3 Tore aus 5 Torschüssen zeigt hohe Konzentration im finalen Drittel. Diese Effizienz beibehalten.',
                    impact: '9/10'
                  },
                  { 
                    title: 'Physische Top-Verfassung',
                    desc: 'Mannschaft hielt hohes Niveau über 114 Minuten, noch im Umschaltspiel (88\') frisch. Großer Vorteil.',
                    impact: '8/10'
                  },
                ].map((item, i) => (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-bold text-foreground text-sm">{item.title}</div>
                      <Badge className="bg-primary/15 text-primary">{item.impact}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">🚨 Prioritäten für nächstes Spiel</h3>
              <div className="space-y-2">
                {[
                  'Disziplinierte Zweikampfführung: Foulspiel in kritischen Zonen minimieren',
                  'Offensive Standardsituationen: Varianten trainieren & effektiver nutzen',
                  'Mittelfeld-Dynamik: Mehr Rotationen & vertikale Pässe',
                  'Frühe Torerfolge: Initial-Intensität beibehalten',
                  'Umschaltmomente: Konterstärke weiter trainieren',
                ].map((p, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg text-sm">
                    <div className="flex-shrink-0 text-primary font-bold">{i + 1}.</div>
                    <div className="text-muted-foreground">{p}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* Training */}
          <TabsContent value="training" className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">🏋️ Trainingsempfehlungen</h3>
              <div className="space-y-3">
                {[
                  { 
                    title: 'Präzises Zweikampfverhalten',
                    time: '30-40 Min',
                    severity: 'mittel',
                    desc: 'Timing & Stellungsspiel im 1v1 trainieren, Ballgewinne ohne Foul'
                  },
                  { 
                    title: 'Offensive Standardsituationen',
                    time: '45-60 Min',
                    severity: 'mittel',
                    desc: 'Eckbälle & Freistöße mit Varianten, Laufwege, Abschlüsse'
                  },
                  { 
                    title: 'Dynamisches Positionsspiel',
                    time: '40-50 Min',
                    severity: 'hoch',
                    desc: 'Rotationen, Doppelpässe, schnelles Umschaltspiel trainieren'
                  },
                ].map((item, i) => (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-bold text-foreground text-sm">{item.title}</div>
                      <Badge variant={item.severity === 'hoch' ? 'default' : 'outline'} className="text-xs">{item.time}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold text-foreground mb-4">📅 Wochenplan</h3>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { day: 'Tag+1', title: 'Regeneration & Analyse', severity: 'gering' },
                  { day: 'Tag+2', title: 'Defensives Stellungsspiel', severity: 'mittel' },
                  { day: 'Tag+3', title: 'Offensivtraining & Standards', severity: 'hoch' },
                ].map((item, i) => (
                  <div key={i} className="bg-muted/30 rounded-lg p-4 text-center">
                    <div className="font-bold text-foreground text-sm mb-1">{item.day}</div>
                    <div className="text-xs text-muted-foreground mb-2">{item.title}</div>
                    <Badge variant="outline" className="text-[10px]">{item.severity}</Badge>
                  </div>
                ))}
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Fazit */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-2xl p-8 border border-primary/20 mt-8">
          <h2 className="text-2xl font-grotesk font-bold text-foreground mb-4 flex items-center gap-2">
            🏁 Fazit & Strategischer Ausblick
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Die Viktoria Aschaffenburg U19 lieferte eine reife Leistung ab, getragen von außergewöhnlicher Effizienz im Abschluss (3 Tore aus 5 Torschüssen, 60% Verwertung). Die defensive Stabilität über 114 Minuten ohne Gegentor war der Schlüssel zum Erfolg. Die frühe Foulhäufung ist ein Verbesserungsbereich, da sie unnötige Freistoßgefahr generierte. Insgesamt dominierte die Heimelf das Spiel, verwaltete ihre Führung souverän und zeigte auch in der Schlussphase die nötige Konzentration und Physis für das 3:0. Dieser Sieg war ein klares Zeichen der Stärke und taktischen Disziplin.
          </p>
        </motion.div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground mt-8 py-6 border-t border-border">
          <p>📊 <strong>Automatisch generiert nach jeder Live-Session</strong></p>
          <p className="mt-1">Siehe Admin-Handbuch für technische Details zur Report-Generierung</p>
        </div>
      </div>
    </div>
  );
}