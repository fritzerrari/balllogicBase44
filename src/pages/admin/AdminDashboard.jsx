/**
 * Admin-Dashboard — Nur für Admins
 * Nutzerverwaltung, globale Match-Übersicht, Statistiken, Audit-Log, Changelog-Editor
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Video, BarChart3, FileText, Plus, Trash2,
  Shield, Activity, Clock, CheckCircle2, AlertTriangle, BookOpen, Settings, Radar
} from 'lucide-react';
import TeamSetupWizard from '@/components/admin/TeamSetupWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';

const TABS = [
  { id: 'overview', label: 'Übersicht', icon: BarChart3 },
  { id: 'matches', label: 'Alle Spiele', icon: Video },
  { id: 'users', label: 'Nutzer', icon: Users },
  { id: 'tracking', label: 'Tracking-Setup', icon: Radar },
  { id: 'changelog', label: 'Changelog', icon: BookOpen },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
];

const ROBOFLOW_MODELS = [
  { id: 'football-players-detection-3zvbc/1', label: 'Football Players Detection (Standard)', description: 'Erkennt Spieler, Torwart, Schiedsrichter & Ball' },
  { id: 'football-players-detection-3zvbc/2', label: 'Football Players Detection v2', description: 'Verbesserte Version mit höherer Genauigkeit' },
  { id: 'football-detection-najd5/1', label: 'Football Detection (Najd)', description: 'Alternatives Modell für Spieler & Ball' },
  { id: 'soccer-players-detection-pmrdp/1', label: 'Soccer Players (PMRDP)', description: 'Spezialisiert auf Spielererkennung' },
];

const statusColors = {
  uploading: 'bg-yellow-500/15 text-yellow-400',
  processing: 'bg-blue-500/15 text-blue-400',
  analyzed: 'bg-primary/15 text-primary',
  live: 'bg-red-500/15 text-red-400',
  failed: 'bg-destructive/15 text-destructive',
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [newChangelog, setNewChangelog] = useState({ version: '', title: '', description: '', type: 'added' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: matches = [] } = useQuery({
    queryKey: ['admin-matches'],
    queryFn: () => base44.entities.Match.list('-created_date', 50),
  });
  const { data: reports = [] } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date', 50),
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: () => base44.entities.LiveSession.list('-created_date', 20),
  });
  const { data: changelogs = [] } = useQuery({
    queryKey: ['changelogs'],
    queryFn: () => base44.entities.Changelog.list('-date', 30),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['app-settings'],
    queryFn: () => base44.entities.AppSetting.list(),
  });

  const roboflowModelSetting = appSettings.find(s => s.key === 'roboflow_model');
  const currentModel = roboflowModelSetting?.value || 'football-players-detection-3zvbc/1';

  const saveAppSetting = useMutation({
    mutationFn: async ({ key, value, label }) => {
      const existing = appSettings.find(s => s.key === key);
      if (existing) {
        return base44.entities.AppSetting.update(existing.id, { value, label });
      } else {
        return base44.entities.AppSetting.create({ key, value, label });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast({ title: 'Einstellung gespeichert' });
    },
  });

  const { data: sessionReports = [] } = useQuery({
    queryKey: ['admin-session-reports'],
    queryFn: () => base44.entities.SessionReport.list('-created_date', 50),
  });
  const { data: matchEvents = [] } = useQuery({
    queryKey: ['admin-match-events'],
    queryFn: () => base44.entities.MatchEvent.list('-created_date', 50),
  });
  const { data: analysisReportsAll = [] } = useQuery({
    queryKey: ['admin-analysis-all'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date', 50),
  });

  const [deleting, setDeleting] = useState({});

  const deleteAll = async (entityName, items, queryKeys) => {
    setDeleting(p => ({ ...p, [entityName]: true }));
    await Promise.all(items.map(i => base44.entities[entityName].delete(i.id).catch(() => {})));
    queryKeys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    setDeleting(p => ({ ...p, [entityName]: false }));
    toast({ title: `Alle ${entityName} gelöscht (${items.length})` });
  };

  const deleteMatch = useMutation({
    mutationFn: (id) => base44.entities.Match.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-matches'] }),
  });

  const createChangelog = useMutation({
    mutationFn: (data) => base44.entities.Changelog.create({ ...data, date: new Date().toISOString().split('T')[0] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changelogs'] });
      setNewChangelog({ version: '', title: '', description: '', type: 'added' });
      toast({ title: 'Changelog-Eintrag gespeichert' });
    },
  });

  const deleteChangelog = useMutation({
    mutationFn: (id) => base44.entities.Changelog.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['changelogs'] }),
  });

  const stats = {
    totalMatches: matches.length,
    analyzed: matches.filter(m => m.status === 'analyzed').length,
    live: matches.filter(m => m.status === 'live').length,
    failed: matches.filter(m => m.status === 'failed').length,
    totalReports: reports.length,
    totalSessions: sessions.length,
  };

  const DeleteAllButton = ({ label, entity, items, queryKeys }) => (
    <button
      onClick={() => deleteAll(entity, items, queryKeys)}
      disabled={deleting[entity] || items.length === 0}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/20 disabled:opacity-40 transition-all"
    >
      <Trash2 className="w-3.5 h-3.5" />
      {deleting[entity] ? 'Löscht...' : `Alle ${label} löschen (${items.length})`}
    </button>
  );

  const typeColors = {
    added: 'bg-primary/15 text-primary border-primary/30',
    improved: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    fixed: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    removed: 'bg-destructive/15 text-destructive border-destructive/30',
  };
  const typeLabels = { added: '✦ Neu', improved: '↑ Verbessert', fixed: '✓ Behoben', removed: '✕ Entfernt' };

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 md:mb-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 uppercase tracking-widest">
          <Shield className="w-3 h-3 text-primary" /> Admin-Bereich
        </div>
        <h1 className="text-2xl md:text-3xl font-grotesk font-bold text-foreground">Admin-Dashboard</h1>
        <p className="text-muted-foreground text-sm">Systemverwaltung & Übersicht</p>
      </motion.div>

      {/* Tab Nav — scrollable on mobile */}
      <div className="flex gap-1 mb-4 md:mb-6 bg-muted rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${activeTab === t.id ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {[
              { label: 'Gesamt Spiele', value: stats.totalMatches, icon: Video, color: 'text-primary bg-primary/15', sub: `${stats.analyzed} analysiert` },
              { label: 'Analyse-Reports', value: stats.totalReports, icon: BarChart3, color: 'text-blue-400 bg-blue-500/15' },
              { label: 'Live-Sessions', value: stats.totalSessions, icon: Activity, color: 'text-red-400 bg-red-500/15' },
              { label: 'Fehlgeschlagen', value: stats.failed, icon: AlertTriangle, color: 'text-destructive bg-destructive/15', sub: stats.failed > 0 ? 'Achtung!' : 'Alles OK' },
              { label: 'Derzeit Live', value: stats.live, icon: Clock, color: 'text-yellow-400 bg-yellow-500/15' },
              { label: 'Changelog-Einträge', value: changelogs.length, icon: BookOpen, color: 'text-purple-400 bg-purple-500/15' },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-5">
                <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center mb-3`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="text-2xl font-grotesk font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                {s.sub && <div className="text-[10px] text-primary mt-1">{s.sub}</div>}
              </motion.div>
            ))}
          </div>

          {/* Daten-Verwaltung */}
          <div className="glass rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-foreground mb-1 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" /> Daten bereinigen
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Vorsicht: Löschen ist nicht rückgängig zu machen!</p>
            <div className="flex flex-wrap gap-2">
              <DeleteAllButton label="Spiele" entity="Match" items={matches} queryKeys={['admin-matches', 'matches-recent', 'matches-all']} />
              <DeleteAllButton label="Sessions" entity="LiveSession" items={sessions} queryKeys={['admin-sessions', 'liveSessions', 'liveSessions-ended']} />
              <DeleteAllButton label="Match-Events" entity="MatchEvent" items={matchEvents} queryKeys={['admin-match-events', 'match-events-all']} />
              <DeleteAllButton label="Berichte" entity="SessionReport" items={sessionReports} queryKeys={['admin-session-reports', 'session-reports']} />
              <DeleteAllButton label="Analysen" entity="AnalysisReport" items={analysisReportsAll} queryKeys={['admin-analysis-all', 'admin-reports']} />
              <DeleteAllButton label="Changelog" entity="Changelog" items={changelogs} queryKeys={['changelogs']} />
            </div>
          </div>

          {/* Letzte Sessions */}
          <div className="glass rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Letzte Live-Sessions
            </h2>
            {sessions.length === 0
              ? <div className="text-xs text-muted-foreground text-center py-4">Keine Sessions vorhanden</div>
              : sessions.slice(0, 8).map(s => (
                <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-foreground">{s.match_title}</div>
                    <div className="text-xs text-muted-foreground">{s.started_at ? format(new Date(s.started_at), 'dd. MMM yyyy HH:mm', { locale: de }) : '—'}</div>
                  </div>
                  <Badge className={s.status === 'active' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-muted text-muted-foreground border-border'}>
                    {s.status === 'active' ? '● Live' : s.status === 'ended' ? 'Beendet' : s.status}
                  </Badge>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── MATCHES ── */}
      {activeTab === 'matches' && (
        <div className="glass rounded-xl p-5">
          <h2 className="font-grotesk font-semibold text-foreground mb-4">Alle Spiele ({matches.length})</h2>
          <div className="space-y-2">
            {matches.length === 0 && <div className="text-xs text-muted-foreground text-center py-8">Keine Spiele vorhanden</div>}
            {matches.map(m => (
              <div key={m.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge className={`text-[10px] border ${statusColors[m.status]}`}>{m.status}</Badge>
                    <span className="text-sm font-medium text-foreground truncate">{m.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span>{m.date ? format(new Date(m.date), 'dd.MM.yyyy', { locale: de }) : '—'}</span>
                    {m.competition && <span>{m.competition}</span>}
                    <span className="text-primary/70">{m.created_by}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteMatch.mutate(m.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── USERS ── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-foreground mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Nutzer einladen
            </h2>
            <p className="text-xs text-muted-foreground mb-4">Neue Trainer oder Admins per E-Mail einladen.</p>
            <InviteUserForm />
          </div>
          <div className="glass rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-foreground mb-4">Rollen-System</h2>
            <div className="space-y-3">
              {[
                { role: 'admin', label: 'Admin', desc: 'Voller Zugriff inkl. Admin-Dashboard, Nutzerverwaltung, Changelog', color: 'text-primary bg-primary/15 border-primary/30' },
                { role: 'user', label: 'Trainer / Analyst', desc: 'Zugriff auf Dashboard, Spiele, Analysen, Live-Sessions, KI-Tools', color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
              ].map(r => (
                <div key={r.role} className="flex items-start gap-4 p-3 bg-muted/40 rounded-lg">
                  <Badge className={`text-xs border flex-shrink-0 ${r.color}`}>{r.label}</Badge>
                  <div className="text-xs text-foreground/70">{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-foreground mb-1 flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" /> Roboflow Modell
            </h2>
            <p className="text-xs text-muted-foreground mb-5">
              Wähle das KI-Modell für die Live-Spielererkennung. Das Modell wird beim nächsten Frame-Aufruf aktiv.
            </p>

            <div className="space-y-2 mb-5">
              {ROBOFLOW_MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => saveAppSetting.mutate({ key: 'roboflow_model', value: model.id, label: model.label })}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    currentModel === model.id
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-border bg-muted/30 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{model.label}</span>
                    {currentModel === model.id && (
                      <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">AKTIV</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{model.description}</div>
                  <div className="text-[10px] font-mono text-primary/60 mt-1">{model.id}</div>
                </button>
              ))}
            </div>

            {/* Custom Model */}
            <CustomModelInput
              currentModel={currentModel}
              knownModels={ROBOFLOW_MODELS}
              onSave={(id) => saveAppSetting.mutate({ key: 'roboflow_model', value: id, label: 'Custom Model' })}
            />
          </div>
        </div>
      )}

      {/* ── TRACKING SETUP ── */}
      {activeTab === 'tracking' && (
        <div className="space-y-4">
          {/* Workflow Info */}
          <div className="glass rounded-xl p-5 border border-primary/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Radar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-grotesk font-bold text-foreground">Roboflow Workflow</h3>
                <p className="text-xs text-muted-foreground">Football Tracking Phase 1</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Aktiv
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Workflow-ID', value: 'football-tracking-phase-1-1777785537057', mono: true },
                { label: 'Object Detection', value: 'football-players-detection-3zvbc' },
                { label: 'Byte Tracker', value: 'Eindeutige Spieler-IDs über Frames', },
                { label: 'Keypoint Detection', value: 'Spielfeld-Linien Erkennung' },
              ].map(item => (
                <div key={item.label} className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground mb-0.5">{item.label}</div>
                  <div className={`text-foreground font-medium ${item.mono ? 'font-mono text-[10px]' : ''}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tracking Status Badge erklärt */}
          <div className="glass rounded-xl p-5">
            <h3 className="font-grotesk font-semibold text-foreground mb-3">Tracking-Status (Kamera-Badge)</h3>
            <div className="space-y-2">
              {[
                { badge: '👥12 ⚽', style: 'bg-green-500/15 text-green-400 border border-green-500/30', label: 'Aktiv — Spieler + Ball erkannt' },
                { badge: '👥12 ❌', style: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30', label: 'Teilweise — Spieler erkannt, Ball nicht sichtbar' },
                { badge: 'Kein Tracking', style: 'bg-red-500/15 text-red-400 border border-red-500/30', label: 'Inaktiv — keine Detections' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${item.style}`}>{item.badge}</span>
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Team Setup Wizard */}
          <div className="glass rounded-xl p-5">
            <TeamSetupWizard
              appSettings={appSettings}
              onSave={async (key, value, label) => {
                await saveAppSetting.mutateAsync({ key, value, label });
              }}
            />
          </div>

          {/* Model Update Guide */}
          <div className="glass rounded-xl p-5 border border-border">
            <h3 className="font-grotesk font-semibold text-foreground mb-2 flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" /> Modell wechseln (nach Training)
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Wenn ein neues Modell in Roboflow trainiert wurde, einfach die Workflow-ID unten eintragen.
              Das Backend verwendet automatisch den neuen Workflow.
            </p>
            <CustomWorkflowInput
              appSettings={appSettings}
              onSave={(value) => saveAppSetting.mutate({ key: 'roboflow_workflow_id', value, label: 'Roboflow Workflow ID' })}
            />
          </div>
        </div>
      )}

      {/* ── CHANGELOG ── */}
      {activeTab === 'changelog' && (
        <div className="space-y-4">
          {/* New Entry */}
          <div className="glass rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-foreground mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Neuer Eintrag
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Version *</label>
                <Input value={newChangelog.version} onChange={e => setNewChangelog(p => ({ ...p, version: e.target.value }))}
                  placeholder="z.B. 1.2.0" className="bg-muted border-border text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Typ</label>
                <select
                  value={newChangelog.type}
                  onChange={e => setNewChangelog(p => ({ ...p, type: e.target.value }))}
                  className="w-full h-9 bg-muted border border-input rounded-md px-3 text-sm text-foreground"
                >
                  {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">Titel *</label>
              <Input value={newChangelog.title} onChange={e => setNewChangelog(p => ({ ...p, title: e.target.value }))}
                placeholder="Feature-Name oder kurze Beschreibung" className="bg-muted border-border text-sm" />
            </div>
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-1 block">Beschreibung</label>
              <textarea
                value={newChangelog.description}
                onChange={e => setNewChangelog(p => ({ ...p, description: e.target.value }))}
                placeholder="Detaillierte Beschreibung der Änderung..."
                rows={3}
                className="w-full bg-muted border border-input rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Button
              onClick={() => createChangelog.mutate(newChangelog)}
              disabled={!newChangelog.version || !newChangelog.title || createChangelog.isPending}
              className="bg-primary text-primary-foreground gap-2"
            >
              <Plus className="w-4 h-4" /> Eintrag speichern
            </Button>
          </div>

          {/* Existing Entries */}
          <div className="glass rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-foreground mb-4">Versionsverlauf ({changelogs.length})</h2>
            <div className="space-y-3">
              {changelogs.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Noch keine Einträge</div>}
              {changelogs.map(c => (
                <div key={c.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
                  <Badge className={`text-[10px] border flex-shrink-0 mt-0.5 ${typeColors[c.type] || typeColors.added}`}>
                    {typeLabels[c.type] || c.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-primary font-bold">{c.version}</span>
                      <span className="text-sm font-medium text-foreground">{c.title}</span>
                      {c.date && <span className="text-[10px] text-muted-foreground ml-auto">{format(new Date(c.date), 'dd. MMM yyyy', { locale: de })}</span>}
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.description}</p>}
                  </div>
                  <button onClick={() => deleteChangelog.mutate(c.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomModelInput({ currentModel, knownModels, onSave }) {
  const isCustom = !knownModels.some(m => m.id === currentModel);
  const [customId, setCustomId] = useState(isCustom ? currentModel : '');
  const [expanded, setExpanded] = useState(isCustom);

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-xs text-primary hover:underline flex items-center gap-1"
      >
        {expanded ? '▲' : '▼'} Eigenes Modell eingeben
      </button>
      {expanded && (
        <div className="mt-3 flex gap-2">
          <input
            value={customId}
            onChange={e => setCustomId(e.target.value)}
            placeholder="z.B. my-model/1"
            className="flex-1 bg-muted border border-input rounded-md px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            onClick={() => { if (customId.trim()) onSave(customId.trim()); }}
            disabled={!customId.trim()}
            size="sm"
            className="bg-primary text-primary-foreground"
          >
            Speichern
          </Button>
        </div>
      )}
      {isCustom && (
        <div className="mt-2 text-xs text-yellow-400">
          ⚡ Custom-Modell aktiv: <span className="font-mono">{currentModel}</span>
        </div>
      )}
    </div>
  );
}

function CustomWorkflowInput({ appSettings, onSave }) {
  const existing = appSettings?.find(s => s.key === 'roboflow_workflow_id');
  const [value, setValue] = useState(existing?.value || 'football-tracking-phase-1-1777785537057');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!value.trim()) return;
    onSave(value.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Workflow-ID (z.B. football-tracking-phase-1-1777785537057)"
        className="flex-1 bg-muted border border-input rounded-md px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button onClick={handleSave} disabled={!value.trim()} size="sm" className="bg-primary text-primary-foreground gap-1.5">
        {saved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Gespeichert</> : 'Speichern'}
      </Button>
    </div>
  );
}

function InviteUserForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    await base44.users.inviteUser(email.trim(), role);
    setLoading(false);
    setDone(true);
    setEmail('');
    toast({ title: 'Einladung gesendet!', description: `${email} wurde eingeladen als ${role}.` });
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInvite()}
        placeholder="trainer@verein.de" className="bg-muted border-border text-sm flex-1 min-w-48" />
      <select value={role} onChange={e => setRole(e.target.value)}
        className="bg-muted border border-input rounded-md px-3 text-sm text-foreground h-9">
        <option value="user">Trainer</option>
        <option value="admin">Admin</option>
      </select>
      <Button onClick={handleInvite} disabled={loading || !email.trim()} className="bg-primary text-primary-foreground gap-2">
        {done ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {done ? 'Gesendet!' : 'Einladen'}
      </Button>
    </div>
  );
}