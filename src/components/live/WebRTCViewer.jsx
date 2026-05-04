/**
 * WebRTCViewer — Trainer-Seite (Empfänger)
 *
 * Robustes Design:
 * - Polling NUR während des Handshakes (alle 3s, max 30s)
 * - Nach erfolgreichem Track-Empfang: polling SOFORT stoppen
 * - Bei Verbindungsabbruch: auto-reconnect mit backoff
 * - Kein Polling im eingeschwungenen Zustand → kein Rate Limit
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 30000;
const RECONNECT_BASE_MS = 5000;
const RECONNECT_MAX_MS = 60000;

export default function WebRTCViewer({ sessionId, cameraId, isOnline, fallbackThumbnail }) {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const pollingRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);
  const [rtcState, setRtcState] = useState('waiting'); // waiting | connecting | live | failed

  const signal = useCallback(async (action, data) => {
    return base44.functions.invoke('webrtcSignal', {
      action,
      session_id: sessionId,
      camera_id: cameraId,
      data,
    });
  }, [sessionId, cameraId]);

  const stopPolling = useCallback(() => {
    clearInterval(pollingRef.current);
    clearTimeout(pollTimeoutRef.current);
    pollingRef.current = null;
    pollTimeoutRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    stopPolling();
    clearTimeout(reconnectTimerRef.current);
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      try { pcRef.current.close(); } catch (_) {}
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopPolling]);

  const connectRef = useRef(null);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    const attempt = reconnectAttemptsRef.current++;
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(1.5, attempt), RECONNECT_MAX_MS);
    console.log(`[WebRTC Viewer] Reconnect cam ${cameraId} in ${delay}ms (attempt ${attempt + 1})`);
    setRtcState('waiting');
    reconnectTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      connectRef.current?.();
    }, delay);
  }, [cameraId]);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    cleanup();
    setRtcState('connecting');

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ontrack = (e) => {
      if (!mountedRef.current) return;
      if (videoRef.current && e.streams[0]) {
        videoRef.current.srcObject = e.streams[0];
        videoRef.current.play().catch(() => {});
        setRtcState('live');
        reconnectAttemptsRef.current = 0;
        // Track received → stop polling immediately
        stopPolling();
        console.log(`[WebRTC Viewer] cam ${cameraId} LIVE — polling stopped`);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed') {
        console.warn(`[WebRTC Viewer] cam ${cameraId} connection failed`);
        cleanup();
        scheduleReconnect();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed') {
        cleanup();
        scheduleReconnect();
      } else if (state === 'disconnected') {
        setRtcState('waiting');
        reconnectTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            cleanup();
            scheduleReconnect();
          }
        }, 5000);
      }
    };

    // Poll for offer from camera — ONLY until offer found OR timeout
    let pollCount = 0;
    const maxPolls = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

    pollingRef.current = setInterval(async () => {
      if (!mountedRef.current || pcRef.current !== pc) {
        stopPolling();
        return;
      }

      pollCount++;
      if (pollCount > maxPolls) {
        console.warn(`[WebRTC Viewer] cam ${cameraId} no offer within timeout`);
        stopPolling();
        cleanup();
        scheduleReconnect();
        return;
      }

      try {
        const res = await signal('get_signal', {});
        const s = res?.data?.signal;

        if (!s?.offer) return; // Camera not ready yet
        if (pc.signalingState !== 'stable') return; // Already processing

        // Stop polling — we have an offer
        stopPolling();

        await pc.setRemoteDescription(new RTCSessionDescription(s.offer));

        for (const c of (s.ice_camera || [])) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Collect viewer ICE candidates
        const viewerIce = [];
        pc.onicecandidate = (e) => {
          if (e.candidate) viewerIce.push(e.candidate.toJSON());
        };

        // Wait for ICE gathering (max 3s)
        await new Promise(resolve => {
          if (pc.iceGatheringState === 'complete') return resolve();
          const check = setInterval(() => {
            if (pc.iceGatheringState === 'complete') { clearInterval(check); resolve(); }
          }, 100);
          setTimeout(() => { clearInterval(check); resolve(); }, 3000);
        });

        await signal('set_answer', {
          answer: pc.localDescription.toJSON(),
          ice_candidates: viewerIce,
        }).catch(console.warn);

        console.log(`[WebRTC Viewer] cam ${cameraId} answer sent, waiting for track...`);
      } catch (err) {
        // Ignore individual poll errors, don't abort
      }
    }, POLL_INTERVAL_MS);

  }, [sessionId, cameraId, signal, cleanup, stopPolling, scheduleReconnect]);

  connectRef.current = connect;

  useEffect(() => {
    if (!sessionId || !cameraId || !isOnline) {
      cleanup();
      return;
    }

    mountedRef.current = true;
    reconnectAttemptsRef.current = 0;
    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [sessionId, cameraId, isOnline]);

  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
      {/* WebRTC Live Video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-cover ${rtcState === 'live' ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Fallback when not live */}
      {rtcState !== 'live' && (
        <div className="absolute inset-0">
          {fallbackThumbnail ? (
            <img src={fallbackThumbnail} alt="preview" className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
              <div className="text-center space-y-2">
                {rtcState === 'connecting' ? (
                  <>
                    <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                    <div className="text-xs text-white/50">Verbinde Livestream...</div>
                  </>
                ) : rtcState === 'failed' ? (
                  <>
                    <WifiOff className="w-6 h-6 text-red-400 mx-auto" />
                    <div className="text-xs text-white/50">Reconnecting...</div>
                  </>
                ) : (
                  <>
                    <Wifi className="w-6 h-6 text-white/20 mx-auto" />
                    <div className="text-xs text-white/30">
                      {isOnline ? 'Warte auf Kamera...' : 'Kamera offline'}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Badge */}
      <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm z-10 ${
        rtcState === 'live' ? 'bg-green-600/80 text-white' :
        rtcState === 'connecting' ? 'bg-yellow-500/80 text-black' :
        'bg-black/60 text-muted-foreground'
      }`}>
        <div className={`w-1.5 h-1.5 rounded-full ${
          rtcState === 'live' ? 'bg-white animate-pulse' :
          rtcState === 'connecting' ? 'bg-black animate-pulse' :
          'bg-muted-foreground'
        }`} />
        {rtcState === 'live' ? 'LIVE' : rtcState === 'connecting' ? 'Verbinde...' : 'OFFLINE'}
      </div>
    </div>
  );
}