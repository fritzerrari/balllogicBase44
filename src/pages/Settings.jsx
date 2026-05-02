import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Zap, Shield, Bell, Users, ExternalLink, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';

const Section = ({ title, children }) => (
  <div className="glass rounded-xl p-6 mb-4">
    <h2 className="font-grotesk font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">{title}</h2>
    {children}
  </div>
);

export default function Settings() {
  const [footballApiKey, setFootballApiKey] = useState(localStorage.getItem('football_data_key') || '');
  const [apiSaved, setApiSaved] = useState(false);

  const saveFootballApiKey = () => {
    localStorage.setItem('football_data_key', footballApiKey);
    // Auch als env-ähnlichen Wert speichern für den footballDataApi-Helper
    window.__FOOTBALL_DATA_KEY__ = footballApiKey;
    setApiSaved(true);
    setTimeout(() => setApiSaved(false), 2000);
  };

  return (
    <div className="p-6 lg:p-8 min-h-screen max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <h1 className="text-3xl font-grotesk font-bold text-foreground mb-1">Einstellungen</h1>
        <p className="text-muted-foreground">Verein & Analyse-Einstellungen</p>
      </motion.div>

      <Section title="Verein">
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Vereinsname</Label>
            <Input placeholder="FC Musterverein" className="bg-muted border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Liga / Wettbewerb</Label>
            <Input placeholder="z.B. Bundesliga" className="bg-muted border-border" />
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Speichern</Button>
        </div>
      </Section>

      <Section title="Nutzer & Rollen">
        <div className="space-y-3">
          {[
            { name: 'Cheftrainer', role: 'trainer', desc: 'Sieht Dashboard & Reports' },
            { name: 'Analyst', role: 'analyst', desc: 'Voller Zugriff auf alle Funktionen' },
          ].map(user => (
            <div key={user.role} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{user.name[0]}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.desc}</div>
                </div>
              </div>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="KI-Analyse">
        <div className="space-y-4">
          {[
            { label: 'Formations-Erkennung', desc: 'Automatische Formations-Analyse' },
            { label: 'Pressing-Analyse', desc: 'Pressing-Höhe und Intensität berechnen' },
            { label: 'Ermüdungs-Indikator', desc: 'Sprint-Intensität pro Intervall tracken' },
            { label: 'Gefahrenzonen-Heatmap', desc: 'Heatmap der gefährlichen Räume' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <Switch defaultChecked />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Fußball-API (api-football.com)">
        <div className="space-y-3">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-primary font-medium flex items-center gap-2">
            <Key className="w-3.5 h-3.5 shrink-0" />
            API-Key ist bereits konfiguriert und aktiv
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <div>✓ Spielplan-Erkennung (Bundesliga, PL, Champions League etc.)</div>
            <div>✓ Kader-Import für Aufstellungen</div>
            <div>✓ Live-Scores und Ergebnisse</div>
            <div>✓ Über 1000 Ligen und Wettbewerbe</div>
          </div>
        </div>
      </Section>

      <Section title="Benachrichtigungen">
        <div className="space-y-4">
          {[
            { label: 'Analyse abgeschlossen', desc: 'Benachrichtigung wenn KI fertig ist' },
            { label: 'Live-Session gestartet', desc: 'Alarm bei neuen Live-Sessions' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <Switch defaultChecked />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}