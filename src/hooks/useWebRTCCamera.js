/**
 * useWebRTCCamera — Kamera-Seite (Sender)
 * Erstellt RTCPeerConnection, sendet Offer, wartet auf Answer via Polling
 * 
 * Reconnect-Logik:
 * - Erkennt ICE-Verbindungsfehler (failed / disconnected)
 * - Reconnect mit Exponential Backoff (2s → 4s → 8s → max 30s)
 * - Max 10 Versuche, dann aufgeben
 */
import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

export default function useWebRTCCamera({ sessionId, cameraId, stream, enabled }) {
  const pcRef = useRef(null);
  const pollingRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  const signal = useCallback(async (action, data) => {
    return base44.functions.invoke('webrtcSignal', {
      action,
      session_id: sessionId,
      camera_id: cameraId,
      data,
    });
  }, [sessionId, cameraId]);

  const cleanup = useCallback(() => {
    clearInterval(pollingRef.current);
    clearTimeout(reconnectTimerRef.current);
    pollingRef.current = null;
    reconnectTimerRef.current = null;
    if (pcRef.current) {
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.close();
      pcRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WebRTC Camera] Max reconnect attempts reached — giving up');
      return;
    }

    const attempt = reconnectAttemptsRef.current;
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt), MAX_RECONNECT_DELAY_MS);
    reconnectAttemptsRef.current++;

    console.log(`[WebRTC Camera] Reconnecting in ${delay}ms (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      signal('clear', {}).catch(() => {});
      start();
    }, delay);
  }, [signal]); // start wird unten defined, zirkuläre Abhängigkeit via ref lösen

  const scheduleReconnectRef = useRef(scheduleReconnect);
  scheduleReconnectRef.current = scheduleReconnect;

  const start = useCallback(async () => {
    if (!stream || !sessionId || !cameraId || !mountedRef.current) return;

    cleanup();

    // Clear old signal
    await signal('clear', {}).catch(() => {});

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Add all tracks from camera stream
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const iceCandidates = [];
    pc.onicecandidate = (e) => {
      if (e.candidate) iceCandidates.push(e.candidate.toJSON());
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('[WebRTC Camera] ICE state:', state);

      if (state === 'connected' || state === 'completed') {
        // Erfolgreiche Verbindung — Reset Reconnect-Zähler
        reconnectAttemptsRef.current = 0;
      } else if (state === 'failed' || state === 'disconnected') {
        // Verbindung verloren → Reconnect
        console.warn('[WebRTC Camera] Connection lost, scheduling reconnect...');
        scheduleReconnectRef.current();
      }
    };

    // Create offer
    const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering (max 2s)
    await new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const check = setInterval(() => {
        if (pc.iceGatheringState === 'complete') { clearInterval(check); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 2000);
    });

    if (!mountedRef.current || pcRef.current !== pc) return; // Wurde in der Zwischenzeit abgebrochen

    // Send offer + gathered ICE candidates
    await signal('set_offer', {
      offer: pc.localDescription.toJSON(),
      ice_candidates: iceCandidates,
    }).catch(console.warn);

    // Poll for answer
    pollingRef.current = setInterval(async () => {
      if (!mountedRef.current || pcRef.current !== pc) {
        clearInterval(pollingRef.current);
        return;
      }
      try {
        const res = await signal('get_signal', {});
        const s = res?.data?.signal;
        if (!s?.answer || pc.signalingState === 'stable') return;

        await pc.setRemoteDescription(new RTCSessionDescription(s.answer));

        for (const c of (s.ice_viewer || [])) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }

        clearInterval(pollingRef.current);
      } catch (_) {}
    }, 1500);
  }, [stream, sessionId, cameraId, signal, cleanup]);

  // Halte start-Referenz aktuell für scheduleReconnect
  const startRef = useRef(start);
  startRef.current = start;

  // Überschreibe scheduleReconnect mit stabiler Referenz
  const stableScheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WebRTC Camera] Max reconnect attempts reached — giving up');
      return;
    }
    const attempt = reconnectAttemptsRef.current;
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt), MAX_RECONNECT_DELAY_MS);
    reconnectAttemptsRef.current++;
    console.log(`[WebRTC Camera] Reconnecting in ${delay}ms (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    reconnectTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      signal('clear', {}).catch(() => {});
      startRef.current();
    }, delay);
  }, [signal]);

  // scheduleReconnectRef aktuell halten
  scheduleReconnectRef.current = stableScheduleReconnect;

  useEffect(() => {
    if (!enabled || !stream || !sessionId || !cameraId) return;
    mountedRef.current = true;
    reconnectAttemptsRef.current = 0;
    start();

    return () => {
      mountedRef.current = false;
      cleanup();
      signal('clear', {}).catch(() => {});
    };
  }, [enabled, stream, sessionId, cameraId]);
}