/**
 * WebRTCViewer — Trainer-Seite (Empfänger)
 * Pollt Signaling-Server, nimmt Offer an, sendet Answer, zeigt echten Livestream
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function WebRTCViewer({ sessionId, cameraId, isOnline, fallbackThumbnail }) {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const pollingRef = useRef(null);
  const connectedRef = useRef(false);
  const [rtcState, setRtcState] = useState('waiting'); // waiting | connecting | live | failed

  const signal = useCallback(async (action, data) => {
    return base44.functions.invoke('webrtcSignal', {
      action,
      session_id: sessionId,
      camera_id: cameraId,
      data,
    });
  }, [sessionId, cameraId]);

  const connect = useCallback(async (offer, iceCameraList) => {
    if (connectedRef.current) return;
    connectedRef.current = true;
    setRtcState('connecting');

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ontrack = (e) => {
      if (videoRef.current && e.streams[0]) {
        videoRef.current.srcObject = e.streams[0];
        videoRef.current.play().catch(() => {});
        setRtcState('live');
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setRtcState('failed');
        connectedRef.current = false;
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Add camera ICE candidates
    for (const c of (iceCameraList || [])) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Wait for ICE gathering
    const iceCandidates = [];
    pc.onicecandidate = (e) => {
      if (e.candidate) iceCandidates.push(e.candidate.toJSON());
    };

    await new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const check = setInterval(() => {
        if (pc.iceGatheringState === 'complete') { clearInterval(check); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 2000);
    });

    await signal('set_answer', {
      answer: pc.localDescription.toJSON(),
      ice_candidates: iceCandidates,
    }).catch(console.warn);
  }, [signal]);

  useEffect(() => {
    if (!sessionId || !cameraId || !isOnline) return;

    // Poll for offer
    pollingRef.current = setInterval(async () => {
      if (connectedRef.current) return;
      try {
        const res = await signal('get_signal', {});
        const s = res?.data?.signal;
        if (s?.offer) {
          clearInterval(pollingRef.current);
          await connect(s.offer, s.ice_camera);
        }
      } catch (e) {
        // ignore
      }
    }, 2000);

    return () => {
      clearInterval(pollingRef.current);
      pcRef.current?.close();
      pcRef.current = null;
      connectedRef.current = false;
    };
  }, [sessionId, cameraId, isOnline]);

  return (
    <div className="relative w-full h-full bg-black" style={{ aspectRatio: '16/9' }}>
      {/* WebRTC Live Video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-cover ${rtcState === 'live' ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Fallback: thumbnail or placeholder */}
      {rtcState !== 'live' && (
        <div className="absolute inset-0">
          {fallbackThumbnail ? (
            <img src={fallbackThumbnail} alt="preview" className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
              <div className="text-center space-y-2">
                {rtcState === 'connecting' ? (
                  <><Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" /><div className="text-xs text-white/50">Verbinde Livestream...</div></>
                ) : rtcState === 'failed' ? (
                  <><WifiOff className="w-6 h-6 text-red-400 mx-auto" /><div className="text-xs text-white/50">Stream unterbrochen</div></>
                ) : (
                  <><Wifi className="w-6 h-6 text-white/20 mx-auto" /><div className="text-xs text-white/30">Warte auf Kamera...</div></>
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