/**
 * useCameraConnections — Verwaltet Camera-Verbindungen mit Handshake vor Tracking-Start
 * 
 * Workflow:
 * 1. Session erstellt → Kamera-Links generiert
 * 2. Trainer öffnet CoachingCockpit → Poll nach Kamera-Status
 * 3. Kameramann öffnet Link → Heartbeat → Status wird "connected"
 * 4. Alle Kameras connected → Tracking freischalten
 */
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function useCameraConnections(sessionId, enabled = true) {
  const [readyToTrack, setReadyToTrack] = useState(false);
  const pollIntervalRef = useRef(null);

  // Hole Session-Kameras
  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionId ? base44.entities.LiveSession.get(sessionId) : null,
    enabled: !!sessionId && enabled,
    refetchInterval: 3000, // Poll alle 3s für Status-Updates
    staleTime: 1000,
  });

  // Check ob alle Kameras connected sind
  useEffect(() => {
    if (!session?.camera_streams) return;

    const allConnected = session.camera_streams.every(cam =>
      cam.status === 'connected' && cam.last_seen
    );

    const anyConnected = session.camera_streams.some(cam =>
      cam.status === 'connected'
    );

    setReadyToTrack(allConnected);

    // Log für Debugging
    if (anyConnected && !allConnected) {
      const connected = session.camera_streams.filter(c => c.status === 'connected').length;
      const total = session.camera_streams.length;
      console.log(`📷 Kameras: ${connected}/${total} verbunden`);
    }
  }, [session?.camera_streams]);

  return {
    cameras: session?.camera_streams || [],
    readyToTrack,
    sessionId,
    cameraCount: session?.camera_streams?.length || 0,
    connectedCount: session?.camera_streams?.filter(c => c.status === 'connected').length || 0,
  };
}