/**
 * useCameraHeartbeat — Kamera-Verbindungsstatus tracken
 * 
 * Sendet alle 2 Sekunden einen Heartbeat an LiveSession.camera_streams
 * um den Status von "waiting" zu "connected" zu ändern
 */
import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export default function useCameraHeartbeat(sessionId, cameraCode, cameraLabel, isActive = true) {
  const sessionRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!sessionId || !cameraCode || !isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Zunächst: Session laden
    const initSession = async () => {
      try {
        const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
        const session = sessions[0];
        if (!session) return;
        sessionRef.current = session;
      } catch (e) {
        console.error('Failed to load session for heartbeat:', e);
      }
    };

    // Heartbeat senden
    const sendHeartbeat = async () => {
      if (!sessionRef.current) {
        await initSession();
        if (!sessionRef.current) return;
      }

      try {
        // Frische Session-Kopie laden statt stale ref zu verwenden
        const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
        const currentSession = sessions[0];
        if (!currentSession) return;

        const updated = {
          ...currentSession,
          camera_streams: (currentSession.camera_streams || []).map(cam => {
            if (cam.code === cameraCode) {
              return {
                ...cam,
                status: 'connected',
                last_seen: new Date().toISOString(),
              };
            }
            return cam;
          }),
        };

        // Update in DB
        await base44.entities.LiveSession.update(currentSession.id, {
          camera_streams: updated.camera_streams,
        });

        sessionRef.current = updated;
      } catch (e) {
        console.error('Heartbeat failed:', e);
      }
    };

    // Starte Heartbeat (REDUZIERT: 2s → 15s um Rate-Limit zu vermeiden)
    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, cameraCode, isActive]);
}