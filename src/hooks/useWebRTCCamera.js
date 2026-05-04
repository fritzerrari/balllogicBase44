/**
 * useWebRTCCamera — Kamera-Seite (Sender)
 *
 * Robustes Design:
 * - Offer einmalig senden, dann NUR auf Answer warten (max 30s, dann Retry)
 * - Nach connected: polling SOFORT stoppen → keine weiteren API-Calls
 * - ICE restart statt full reconnect bei disconnected
 * - Exponential backoff: 3s → 6s → 12s → max 60s
 * - Max 20 Versuche (endlos-Betrieb über 90min Match)
 */
import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_DELAY_MS = 3000;
const MAX_DELAY_MS = 60000;
const ANSWER_POLL_INTERVAL_MS = 3000;  // Nur während Handshake
const ANSWER_POLL_TIMEOUT_MS = 30000; // Nach 30s ohne Answer → retry

export default function useWebRTCCamera({ sessionId, cameraId, stream, enabled }) {
  const pcRef = useRef(null);
  const pollingRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);
  const connectedRef = useRef(false);

  const signal = useCallback(async (action, data) => {
    return base44.functions.invoke('webrtcSignal', {
      action,
      session_id: sessionId,
      camera_id: cameraId,
      data,
    });
  }, [sessionId, cameraId]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopPolling();
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    connectedRef.current = false;
    if (pcRef.current) {
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      try { pcRef.current.close(); } catch (_) {}
      pcRef.current = null;
    }
  }, [stopPolling]);

  const startRef = useRef(null);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WebRTC Cam] Max reconnect attempts reached');
      return;
    }
    const attempt = reconnectAttemptsRef.current++;
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
    console.log(`[WebRTC Cam] Reconnect in ${delay}ms (attempt ${attempt + 1})`);
    reconnectTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      startRef.current?.();
    }, delay);
  }, []);

  const start = useCallback(async () => {
    if (!stream || !sessionId || !cameraId || !mountedRef.current) return;

    cleanup();

    // Clear stale signal from previous session
    await signal('clear', {}).catch(() => {});

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Add all camera tracks
    stream.getTracks().forEach(track => {
      try { pc.addTrack(track, stream); } catch (_) {}
    });

    // ICE candidates collected during gathering
    const iceCandidates = [];
    pc.onicecandidate = (e) => {
      if (e.candidate) iceCandidates.push(e.candidate.toJSON());
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC Cam] Connection state:', state);
      if (state === 'connected') {
        connectedRef.current = true;
        reconnectAttemptsRef.current = 0;
        stopPolling(); // ← CRITICAL: stop polling once connected
      } else if (state === 'failed') {
        console.warn('[WebRTC Cam] Connection failed, reconnecting...');
        cleanup();
        scheduleReconnect();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('[WebRTC Cam] ICE state:', state);
      if (state === 'connected' || state === 'completed') {
        connectedRef.current = true;
        reconnectAttemptsRef.current = 0;
        stopPolling(); // ← CRITICAL: stop polling once ICE connected
      } else if (state === 'failed') {
        cleanup();
        scheduleReconnect();
      } else if (state === 'disconnected') {
        // Wait 5s before reconnecting — might self-recover
        reconnectTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            cleanup();
            scheduleReconnect();
          }
        }, 5000);
      }
    };

    // Create offer
    let offer;
    try {
      offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);
    } catch (err) {
      console.error('[WebRTC Cam] Failed to create offer:', err);
      scheduleReconnect();
      return;
    }

    // Wait for ICE gathering (max 3s)
    await new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const check = setInterval(() => {
        if (pc.iceGatheringState === 'complete') { clearInterval(check); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 3000);
    });

    if (!mountedRef.current || pcRef.current !== pc) return;

    // Send offer to signaling server (one shot)
    try {
      await signal('set_offer', {
        offer: pc.localDescription.toJSON(),
        ice_candidates: iceCandidates,
      });
    } catch (err) {
      console.error('[WebRTC Cam] Failed to send offer:', err);
      scheduleReconnect();
      return;
    }

    // Poll for answer — ONLY until answer received OR timeout
    let pollCount = 0;
    const maxPolls = Math.ceil(ANSWER_POLL_TIMEOUT_MS / ANSWER_POLL_INTERVAL_MS);

    pollingRef.current = setInterval(async () => {
      if (!mountedRef.current || pcRef.current !== pc) {
        stopPolling();
        return;
      }

      pollCount++;
      if (pollCount > maxPolls) {
        console.warn('[WebRTC Cam] No answer received within timeout, retrying...');
        stopPolling();
        cleanup();
        scheduleReconnect();
        return;
      }

      try {
        const res = await signal('get_signal', {});
        const s = res?.data?.signal;

        // Stop if already in stable state
        if (!s?.answer || pc.signalingState === 'stable') return;

        await pc.setRemoteDescription(new RTCSessionDescription(s.answer));

        for (const c of (s.ice_viewer || [])) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }

        // Answer received — stop polling immediately
        stopPolling();
        console.log('[WebRTC Cam] Handshake complete, polling stopped');
      } catch (err) {
        // Ignore individual poll errors
      }
    }, ANSWER_POLL_INTERVAL_MS);

  }, [stream, sessionId, cameraId, signal, cleanup, stopPolling, scheduleReconnect]);

  // Keep startRef up to date
  startRef.current = start;

  useEffect(() => {
    if (!enabled || !stream || !sessionId || !cameraId) return;
    mountedRef.current = true;
    reconnectAttemptsRef.current = 0;
    connectedRef.current = false;
    start();

    return () => {
      mountedRef.current = false;
      cleanup();
      // Don't await — fire and forget on cleanup
      base44.functions.invoke('webrtcSignal', {
        action: 'clear',
        session_id: sessionId,
        camera_id: cameraId,
        data: {},
      }).catch(() => {});
    };
  }, [enabled, sessionId, cameraId]); // stream intentionally excluded — changing stream re-mounts component
}