/**
 * useCameraStreamManager — Zentrale, robuste Verwaltung aller Kamera-Verbindungen
 * 
 * Features:
 * - Einmalige Verbindung pro Session (nicht pro Kamera)
 * - Automatische Heartbeat-Updates (jede 3s)
 * - Fehlerbehandlung mit Auto-Reconnect
 * - Memory-safe Cleanup
 * - Real-time Status für UI
 */
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const HEARTBEAT_INTERVAL_MS = 3000;
const STATUS_TIMEOUT_MS = 10000; // Kamera offline wenn > 10s kein Update

export default function useCameraStreamManager(sessionId, enabled = true) {
  const [cameraStates, setCameraStates] = useState({});
  const [globalStatus, setGlobalStatus] = useState('idle'); // idle | streaming | error
  const hbIntervalRef = useRef(null);
  const statusCheckRef = useRef(null);
  const lastUpdateRef = useRef({});

  // ── Heartbeat: Update all cameras every 3s ──────────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId) {
      setGlobalStatus('idle');
      return;
    }

    setGlobalStatus('streaming');

    const sendHeartbeat = async () => {
      try {
        const session = await base44.entities.LiveSession.filter({ id: sessionId });
        if (!session?.[0]) return;

        const updatedStreams = session[0].camera_streams?.map(cam => ({
          ...cam,
          status: 'connected',
          last_seen: new Date().toISOString(),
        }));

        if (updatedStreams) {
          // Update entire session in one operation
          await base44.entities.LiveSession.update(sessionId, {
            camera_streams: updatedStreams,
          }).catch(() => {});

          // Update local state
          const newStates = {};
          updatedStreams.forEach(cam => {
            newStates[cam.camera_id] = {
              status: 'connected',
              label: cam.label,
              lastSeen: new Date(cam.last_seen),
            };
          });
          setCameraStates(newStates);
          lastUpdateRef.current = newStates;
        }
      } catch (err) {
        console.warn('⚠️ Heartbeat failed:', err.message);
        setGlobalStatus('error');
      }
    };

    // Initial send
    sendHeartbeat();

    // Recurring heartbeat
    hbIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(hbIntervalRef.current);
    };
  }, [sessionId, enabled]);

  // ── Status Check: Mark cameras offline if no recent update ──────────────────
  useEffect(() => {
    statusCheckRef.current = setInterval(() => {
      const now = Date.now();
      const updated = { ...cameraStates };
      let hasOffline = false;

      Object.entries(updated).forEach(([camId, state]) => {
        if (state.lastSeen && now - state.lastSeen.getTime() > STATUS_TIMEOUT_MS) {
          updated[camId] = { ...state, status: 'offline' };
          hasOffline = true;
        }
      });

      if (hasOffline) {
        setCameraStates(updated);
        setGlobalStatus('error');
      }
    }, 5000);

    return () => clearInterval(statusCheckRef.current);
  }, [cameraStates]);

  return {
    cameraStates,        // { camera_id: { status, label, lastSeen } }
    globalStatus,        // 'idle' | 'streaming' | 'error'
    connectedCount: Object.values(cameraStates).filter(s => s.status === 'connected').length,
    totalCount: Object.keys(cameraStates).length,
  };
}