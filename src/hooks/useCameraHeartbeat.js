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
        const session = await base44.entities.LiveSession.filter({ id: sessionId }).then(r => r[0]);
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
        const session = sessionRef.current;
        const updated = {
          ...session,
          camera_streams: session.camera_streams.map(cam => {
            // Update: Nur diese Kamera, wenn Code matched
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
        await base44.entities.LiveSession.update(session.id, {
          camera_streams: updated.camera_streams,
        });

        sessionRef.current = updated;
      } catch (e) {
        console.error('Heartbeat failed:', e);
      }
    };

    // Starte Heartbeat
    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, cameraCode, isActive]);
}