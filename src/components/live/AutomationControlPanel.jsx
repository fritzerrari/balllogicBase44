/**
 * AutomationControlPanel — Trainer Dashboard für Auto-Tracking
 * Status aller Automations + Manual Override Optionen
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Zap } from 'lucide-react';

const AUTOMATIONS = [
  { id: 'possession', label: 'Ballbesitz', icon: '⚽', active: true },
  { id: 'events', label: 'Auto-Events', icon: '🎯', active: true },
  { id: 'formation', label: 'Formation', icon: '📊', active: true },
  { id: 'heatmap', label: 'Heatmap', icon: '🔥', active: true },
];

export default function AutomationControlPanel({ sessionId, matchId }) {
  const [automations, setAutomations] = useState(
    Object.fromEntries(AUTOMATIONS.map(a => [a.id, a.active]))
  );
  const [showing, setShowing] = useState('status'); // 'status' | 'overrides'

  const handleToggle = async (automationId, enabled) => {
    setAutomations(prev => ({ ...prev, [automationId]: enabled }));
    
    // Optional: Log toggle event
    await base44.entities.MatchEvent.create({
      session_id: sessionId,
      match_id: matchId,
      type: 'automation_toggle',
      team: 'unknown',
      description: `Automation ${automationId}: ${enabled ? 'ON' : 'OFF'}`,
      timestamp_ms: Date.now(),
    }).catch(() => {});
  };

  return (
    <div className="glass rounded-xl p-4 border border-border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Auto-Tracking
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowing('status')}
            className={`text-xs px-2 py-1 rounded ${
              showing === 'status'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'
            }`}
          >
            Status
          </button>
          <button
            onClick={() => setShowing('overrides')}
            className={`text-xs px-2 py-1 rounded ${
              showing === 'overrides'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'
            }`}
          >
            Korrekturen
          </button>
        </div>
      </div>

      {showing === 'status' ? (
        // Status View
        <div className="space-y-2">
          {AUTOMATIONS.map(auto => (
            <motion.div
              key={auto.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{auto.icon}</span>
                <span className="text-xs font-bold">{auto.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {automations[auto.id] ? (
                  <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
                    ✓ AKTIV
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    ○ AUS
                  </Badge>
                )}
                <button
                  onClick={() => handleToggle(auto.id, !automations[auto.id])}
                  className={`w-8 h-5 rounded-full transition-all ${
                    automations[auto.id]
                      ? 'bg-primary'
                      : 'bg-muted border border-border'
                  }`}
                />
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        // Corrections View
        <CorrectionsPanel sessionId={sessionId} matchId={matchId} />
      )}

      {/* Info */}
      <div className="text-[10px] text-muted-foreground bg-muted/20 p-2 rounded">
        ℹ️ Automationen können hier deaktiviert werden. Korrektionen werden später auf alle Frames angewendet.
      </div>
    </div>
  );
}

function CorrectionsPanel({ sessionId, matchId }) {
  const [corrections, setCorrections] = useState([]);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-2">
      {corrections.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground">
          Keine Korrektionen
        </div>
      ) : (
        corrections.map((c, i) => (
          <div key={i} className="text-[10px] bg-muted/40 p-2 rounded border border-yellow-500/20">
            <div className="font-bold">{c.type}</div>
            <div>{c.reason}</div>
          </div>
        ))
      )}

      <Button
        onClick={() => setShowForm(!showForm)}
        variant="outline"
        className="w-full text-xs h-8"
      >
        + Korrektur hinzufügen
      </Button>

      {showForm && (
        <ManualCorrectionForm
          sessionId={sessionId}
          matchId={matchId}
          onSave={(c) => {
            setCorrections([...corrections, c]);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function ManualCorrectionForm({ sessionId, matchId, onSave }) {
  const [type, setType] = useState('possession_manual_override');
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert('Bitte Grund eingeben');
      return;
    }

    const correction = {
      session_id: sessionId,
      match_id: matchId,
      type,
      reason: reason.trim(),
      timestamp_ms: Date.now(),
      corrected_by: (await base44.auth.me()).email,
    };

    await base44.entities.TrackingCorrection.create(correction);
    onSave(correction);
  };

  return (
    <div className="space-y-2 p-2 bg-muted/20 rounded border border-primary/20">
      <select
        value={type}
        onChange={e => setType(e.target.value)}
        className="w-full text-xs bg-background border border-input rounded px-2 py-1"
      >
        <option value="possession_manual_override">Ballbesitz-Korrektur</option>
        <option value="event_rejection">Event ablehnen</option>
        <option value="event_approval">Event bestätigen</option>
        <option value="team_reassign">Team-Neuzuweisung</option>
        <option value="formation_override">Formation-Korrektur</option>
      </select>

      <input
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Grund für Korrektur..."
        className="w-full text-xs bg-background border border-input rounded px-2 py-1"
      />

      <div className="flex gap-1">
        <Button
          onClick={handleSubmit}
          className="flex-1 text-xs h-7 bg-primary"
        >
          Speichern
        </Button>
        <button
          onClick={() => setReason('')}
          className="flex-1 text-xs px-2 py-1 rounded bg-muted text-muted-foreground"
        >
          Reset
        </button>
      </div>
    </div>
  );
}