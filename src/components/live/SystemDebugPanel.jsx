/**
 * SystemDebugPanel — Zeigt ALLE Live-System-Status & Fehler
 * Für Emergency-Debugging wenn nix funktioniert
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronDown, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SystemDebugPanel({ sessionId }) {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState({
    session_id: sessionId,
    tracking_data_count: 0,
    match_events_count: 0,
    auto_events_count: 0,
    session_state: null,
    last_error: null,
    frame_rate: 0,
  });

  useEffect(() => {
    if (!sessionId) return;

    const check = async () => {
      try {
        // Zähle TrackingData
        const tracking = await base44.entities.TrackingData.filter({ session_id: sessionId });
        
        // Zähle MatchEvents
        const events = await base44.entities.MatchEvent.filter({ session_id: sessionId });
        
        // Zähle AutoEvents
        const autoEvents = await base44.entities.AutoEvent.filter({ session_id: sessionId });
        
        // Lade SessionState
        const states = await base44.entities.SessionState.filter({ session_id: sessionId });
        const state = states?.[0];

        const frameRate = tracking.length > 1 
          ? Math.round(tracking.length / ((Date.now() - new Date(tracking[tracking.length - 1]?.created_date).getTime()) / 1000))
          : 0;

        setStats({
          session_id: sessionId,
          tracking_data_count: tracking.length,
          match_events_count: events.length,
          auto_events_count: autoEvents.length,
          session_state: state ? {
            frame_count: state.frame_count,
            possession: state.possession_percentage,
            quality: state.detection_quality_avg,
            last_frame: state.last_frame_number,
          } : null,
          last_error: null,
          frame_rate: frameRate,
        });
      } catch (err) {
        setStats(prev => ({
          ...prev,
          last_error: err.message,
        }));
      }
    };

    // Check sofort + alle 2s
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const isHealthy = 
    stats.tracking_data_count > 0 && 
    stats.match_events_count >= 0 && 
    stats.session_state?.possession;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 font-mono text-xs">
      {/* Collapsed Badge */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-4 py-2 rounded-lg border backdrop-blur-sm flex items-center justify-between transition-all ${
          isHealthy
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : stats.tracking_data_count === 0
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
        }`}
      >
        <div className="flex items-center gap-2">
          {isHealthy ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : stats.tracking_data_count === 0 ? (
            <AlertCircle className="w-4 h-4 animate-pulse" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span className="font-bold">
            {isHealthy ? '✅ SYSTEM OK' : stats.tracking_data_count === 0 ? '🔴 NO DATA' : '⚠️ PARTIAL'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-2 bg-black/90 border border-white/20 rounded-lg p-3 space-y-2 backdrop-blur-sm"
          >
            {/* TrackingData */}
            <div className={`${stats.tracking_data_count > 0 ? 'text-green-400' : 'text-red-400'}`}>
              <strong>📹 TrackingData:</strong> {stats.tracking_data_count} records
              {stats.tracking_data_count > 0 && <span className="ml-2 text-green-400/60">({stats.frame_rate} fps)</span>}
              {stats.tracking_data_count === 0 && <span className="ml-2 text-red-400/60">← NO FRAMES</span>}
            </div>

            {/* MatchEvents */}
            <div className={`${stats.match_events_count > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
              <strong>⚽ MatchEvents:</strong> {stats.match_events_count} events
              {stats.match_events_count === 0 && <span className="ml-2 text-yellow-400/60">← No manual events logged</span>}
            </div>

            {/* AutoEvents */}
            <div className={`${stats.auto_events_count > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
              <strong>🤖 AutoEvents:</strong> {stats.auto_events_count} events
              {stats.auto_events_count === 0 && <span className="ml-2 text-yellow-400/60">← No auto-detected events</span>}
            </div>

            {/* SessionState */}
            {stats.session_state ? (
              <div className="text-blue-400 space-y-1 bg-white/5 rounded p-2">
                <strong>📊 SessionState:</strong>
                <div className="pl-2 space-y-0.5 text-[10px]">
                  <div>Frames: {stats.session_state.frame_count}</div>
                  <div>Possession: 🏠 {stats.session_state.possession?.home ?? 50}% | ✈️ {stats.session_state.possession?.away ?? 50}%</div>
                  <div>Quality: {stats.session_state.quality || 0}%</div>
                  <div>Last Frame #: {stats.session_state.last_frame}</div>
                </div>
              </div>
            ) : (
              <div className="text-red-400">
                <strong>❌ SessionState:</strong> Not found
              </div>
            )}

            {/* Error */}
            {stats.last_error && (
              <div className="text-red-400 bg-red-500/10 rounded p-2">
                <strong>⚠️ Error:</strong> {stats.last_error}
              </div>
            )}

            {/* Diagnostik */}
            <div className="bg-white/5 rounded p-2 text-[10px] text-white/60 space-y-1 border-t border-white/10 mt-2 pt-2">
              <div>🔍 <strong>Diagnostik:</strong></div>
              <div>
                {stats.tracking_data_count === 0
                  ? '❌ Kameras senden KEINE Frames — Verbindung prüfen!'
                  : stats.match_events_count === 0
                    ? '⚠️ Keine Events geloggt — Button nicht gepressed?'
                    : stats.auto_events_count === 0
                      ? '⚠️ AutoEvents fehlen — Ball-Tracking deaktiviert?'
                      : '✅ Alle Systeme aktiv!'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}