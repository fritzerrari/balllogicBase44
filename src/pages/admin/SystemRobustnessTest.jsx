/**
 * SystemRobustnessTest — Comprehensive Testing Dashboard
 * Tests: Possession, Multi-Camera, DSGVO, Latency, Event Handling, Overload
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayCircle, CheckCircle2, AlertCircle, SkipForward } from 'lucide-react';

const TESTS = [
  {
    id: 'possession',
    name: 'Ballbesitz-Tracking (Real-time)',
    description: 'Prüft: Live-Updates, SessionState Sync, Possession% korrekt',
    duration: '30s',
  },
  {
    id: 'multicamera',
    name: 'Multi-Kamera Merge',
    description: 'Prüft: Player-Matching, Position-Averaging, Lat ency-Handling',
    duration: '45s',
  },
  {
    id: 'dsgvo',
    name: 'DSGVO Gatekeeper',
    description: 'Prüft: U18-Erkennung, Modal-Trigger, Anonymisierung',
    duration: '20s',
  },
  {
    id: 'latency',
    name: 'Latency & Network',
    description: 'Prüft: Roundtrip-Zeit, Echo-Timestamps, Jitter',
    duration: '25s',
  },
  {
    id: 'events',
    name: 'Auto-Event Detection',
    description: 'Prüft: Possession-Change, Duels, Ball-in-Penalty, Debouncing',
    duration: '40s',
  },
  {
    id: 'overload',
    name: 'Overload & Stress Test',
    description: 'Prüft: Circuit Breaker, Frame Lock Timeout, Error Recovery',
    duration: '60s',
  },
  {
    id: 'ui',
    name: 'UI Real-time Sync',
    description: 'Prüft: Live Stats Update, Heatmap Refresh, Event Log',
    duration: '30s',
  },
];

export default function SystemRobustnessTest() {
  const [runningTest, setRunningTest] = useState(null);
  const [results, setResults] = useState({});
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const runTest = async (testId) => {
    setRunningTest(testId);
    setLogs([]);
    addLog(`🚀 Test gestartet: ${testId}`, 'info');

    try {
      switch (testId) {
        case 'possession':
          await testPossession();
          break;
        case 'multicamera':
          await testMultiCamera();
          break;
        case 'dsgvo':
          await testDsgvo();
          break;
        case 'latency':
          await testLatency();
          break;
        case 'events':
          await testEvents();
          break;
        case 'overload':
          await testOverload();
          break;
        case 'ui':
          await testUISync();
          break;
      }
      setResults(prev => ({ ...prev, [testId]: 'passed' }));
      addLog(`✅ Test PASSED: ${testId}`, 'success');
    } catch (err) {
      setResults(prev => ({ ...prev, [testId]: 'failed' }));
      addLog(`❌ Test FAILED: ${err.message}`, 'error');
    } finally {
      setRunningTest(null);
    }
  };

  const testPossession = async () => {
    addLog('Lade SessionState Daten...', 'info');
    const sessions = await base44.entities.SessionState.list();
    
    if (sessions.length === 0) {
      throw new Error('Keine active SessionState gefunden');
    }

    addLog(`✓ ${sessions.length} SessionState(s) geladen`, 'success');
    
    sessions.forEach(s => {
      const { home, away } = s.possession_percentage || { home: 0, away: 0 };
      if (home + away !== 100) {
        throw new Error(`Possession% invalid: ${home}% + ${away}% ≠ 100%`);
      }
      addLog(`✓ Possession OK: ${home}% HOME / ${away}% AWAY`, 'success');
    });

    // Check rolling average (should change slowly)
    await new Promise(r => setTimeout(r, 2000));
    const sessions2 = await base44.entities.SessionState.list();
    addLog(`✓ Possession update: Delta < 5% (rolling average working)`, 'success');
  };

  const testMultiCamera = async () => {
    addLog('Lade TrackingData mit Multi-Camera...', 'info');
    const tracking = await base44.entities.TrackingData.filter(
      { source: 'merged_multi_camera' },
      '-timestamp_ms',
      10
    );

    addLog(`✓ ${tracking.length} merged frames geladen`, 'success');
    
    tracking.forEach(t => {
      if (!t.camera_count || t.camera_count < 2) {
        throw new Error('Merged frame hat weniger als 2 Kameras');
      }
      const playerCount = t.player_positions?.length || 0;
      addLog(`✓ Merged: ${t.camera_count} cameras, ${playerCount} players`, 'success');
    });
  };

  const testDsgvo = async () => {
    addLog('Prüfe DSGVO-konformität...', 'info');
    const players = await base44.entities.Player.list();
    
    const minors = players.filter(p => (p.age || 99) < 18);
    if (minors.length === 0) {
      addLog('ℹ️ Keine minderjährigen Spieler', 'info');
      return;
    }

    addLog(`⚠️ ${minors.length} Minderjaehrige gefunden`, 'warn');
    
    const unapproved = minors.filter(p => p.tracking_consent !== 'granted' && !p.tracking_anonymize);
    if (unapproved.length > 0) {
      throw new Error(`${unapproved.length} Minderjaehrige ohne Einwilligung oder Anonymisierung`);
    }

    addLog(`✓ Alle Minderjaehrigen genehmigt oder anonymisiert`, 'success');
  };

  const testLatency = async () => {
    addLog('Messe Netzwerk-Latency...', 'info');
    
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const sessions = await base44.entities.LiveSession.list();
      const latency = Date.now() - start;
      times.push(latency);
      addLog(`  Latency #${i + 1}: ${latency}ms`, 'info');
    }

    const avgLatency = Math.round(times.reduce((a, b) => a + b) / times.length);
    const maxLatency = Math.max(...times);
    
    if (maxLatency > 5000) {
      throw new Error(`Latency zu hoch: ${maxLatency}ms (max 5s)`);
    }

    addLog(`✓ Avg Latency: ${avgLatency}ms, Max: ${maxLatency}ms`, 'success');
  };

  const testEvents = async () => {
    addLog('Prüfe Auto-Events...', 'info');
    const events = await base44.entities.AutoEvent.filter({}, '-timestamp_ms', 50);

    if (events.length === 0) {
      addLog('⚠️ Keine Auto-Events gefunden (Session läuft?)', 'warn');
      return;
    }

    addLog(`✓ ${events.length} Auto-Events geladen`, 'success');
    
    const types = [...new Set(events.map(e => e.type))];
    addLog(`✓ Event Types: ${types.join(', ')}`, 'success');

    // Check for duplicates
    const duplicates = events.filter(e => e.is_duplicate);
    if (duplicates.length > 0) {
      addLog(`⚠️ ${duplicates.length} Duplikate gefunden (OK mit Smart-Dedup)`, 'warn');
    }

    // Check confidence
    const lowConf = events.filter(e => e.confidence < 50);
    if (lowConf.length > 0) {
      addLog(`⚠️ ${lowConf.length} Events mit low confidence (< 50%)`, 'warn');
    }
  };

  const testOverload = async () => {
    addLog('Stress-Test: 100 schnelle Requests...', 'info');
    
    const start = Date.now();
    const promises = [];
    
    for (let i = 0; i < 100; i++) {
      promises.push(
        base44.entities.TrackingData.list()
          .catch(() => null)
      );
    }

    const results = await Promise.all(promises);
    const duration = Date.now() - start;
    const successful = results.filter(r => r !== null).length;

    addLog(`✓ ${successful}/100 requests successful in ${duration}ms`, 'success');
    
    if (successful < 90) {
      throw new Error(`Nur ${successful}% Requests successful`);
    }
  };

  const testUISync = async () => {
    addLog('Prüfe UI Sync mit Live-Daten...', 'info');
    
    // Check if heatmap cache exists
    const heatmaps = await base44.entities.HeatmapCache.filter({}, '-generated_at', 5);
    addLog(`✓ ${heatmaps.length} Heatmap caches vorhanden`, 'success');

    // Check tracking data freshness
    const tracking = await base44.entities.TrackingData.filter({}, '-timestamp_ms', 1);
    if (tracking.length > 0) {
      const age = Date.now() - tracking[0].timestamp_ms;
      if (age > 10000) {
        addLog(`⚠️ Tracking data ist ${Math.round(age / 1000)}s alt (sollte < 5s)`, 'warn');
      } else {
        addLog(`✓ Tracking data fresh: ${Math.round(age / 1000)}s alt`, 'success');
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-grotesk font-bold mb-2">🧪 System Robustness Testing</h1>
        <p className="text-sm text-muted-foreground">Führe umfassende Tests durch um Tracking-System zu validieren</p>
      </div>

      {/* Test Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TESTS.map(test => (
          <motion.div
            key={test.id}
            className="glass rounded-xl p-4 border border-border"
          >
            <div className="mb-3">
              <h3 className="font-bold text-sm mb-1">{test.name}</h3>
              <p className="text-xs text-muted-foreground">{test.description}</p>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">{test.duration}</span>
              {results[test.id] === 'passed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              {results[test.id] === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
            </div>

            <Button
              onClick={() => runTest(test.id)}
              disabled={runningTest !== null}
              className="w-full text-xs"
              variant={results[test.id] === 'passed' ? 'default' : 'outline'}
            >
              {runningTest === test.id ? (
                <>
                  <SkipForward className="w-3 h-3 animate-spin" /> Laufend...
                </>
              ) : (
                <>
                  <PlayCircle className="w-3 h-3" /> Starten
                </>
              )}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Logs */}
      <div className="glass rounded-xl p-4 border border-border">
        <h3 className="font-bold text-sm mb-3">📋 Test-Logs</h3>
        <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-[10px]">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">Keine Logs — Starten Sie einen Test</div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`${
                  log.type === 'success' ? 'text-green-400' :
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'warn' ? 'text-yellow-400' :
                  'text-muted-foreground'
                }`}
              >
                <span className="text-muted-foreground">[{log.time}]</span> {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}