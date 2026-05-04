/**
 * useWebRTCCamera — Kamera-Seite (Sender)
 * Erstellt RTCPeerConnection, sendet Offer, wartet auf Answer via Polling
 */
import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function useWebRTCCamera({ sessionId, cameraId, stream, enabled }) {
  const pcRef = useRef(null);
  const pollingRef = useRef(null);
  const startedRef = useRef(false);

  const signal = useCallback(async (action, data) => {
    return base44.functions.invoke('webrtcSignal', {
      action,
      session_id: sessionId,
      camera_id: cameraId,
      data,
    });
  }, [sessionId, cameraId]);

  const start = useCallback(async () => {
    if (!stream || !sessionId || !cameraId || startedRef.current) return;
    startedRef.current = true;

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
      console.log('[WebRTC Camera] ICE state:', pc.iceConnectionState);
    };

    // Create offer
    const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete (max 2s)
    await new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const check = setInterval(() => {
        if (pc.iceGatheringState === 'complete') {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 2000);
    });

    // Send offer + gathered ICE candidates
    await signal('set_offer', {
      offer: pc.localDescription.toJSON(),
      ice_candidates: iceCandidates,
    }).catch(console.warn);

    // Poll for answer
    pollingRef.current = setInterval(async () => {
      try {
        const res = await signal('get_signal', {});
        const s = res?.data?.signal;
        if (!s?.answer || pc.signalingState === 'stable') return;

        await pc.setRemoteDescription(new RTCSessionDescription(s.answer));

        // Apply viewer ICE candidates
        for (const c of (s.ice_viewer || [])) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }

        clearInterval(pollingRef.current);
      } catch (e) {
        // ignore polling errors
      }
    }, 1500);
  }, [stream, sessionId, cameraId, signal]);

  useEffect(() => {
    if (!enabled || !stream || !sessionId || !cameraId) return;
    start();
    return () => {
      clearInterval(pollingRef.current);
      pcRef.current?.close();
      pcRef.current = null;
      startedRef.current = false;
      signal('clear', {}).catch(() => {});
    };
  }, [enabled, stream, sessionId, cameraId]);
}