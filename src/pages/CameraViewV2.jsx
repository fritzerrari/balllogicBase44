/**
 * CameraViewV2 — Minimal, Rate-Limit-safe Camera Interface
 * 
 * - NO WebRTC (too complex, too buggy)
 * - NO SessionState polling (rate limit killer)
 * - NO React Query (hammers API)
 * 
 * Just: Video capture → Upload frames every 40s → Done
 */
import { useState, useEffect, useRef } from 'react';
import { CameraPipeline } from '@/lib/cameraPipeline';
import { AlertTriangle, Radio, Loader2 } from 'lucide-react';

const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function CameraViewV2() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  const cameraId = urlParams.get('cam') || '1';

  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState('initializing'); // initializing | capturing | uploaded | error
  const [stats, setStats] = useState({
    capturedCount: 0,
    uploadedCount: 0,
    failedCount: 0,
    lastError: null,
  });
  const [micActive, setMicActive] = useState(false);

  const videoRef = useRef(null);
  const pipelineRef = useRef(null);
  const timerRef = useRef(null);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Start camera + pipeline
  useEffect(() => {
    if (!sessionId || !cameraId) {
      setStatus('error');
      return;
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});

          // Start pipeline
          const pipeline = new CameraPipeline(
            videoRef.current,
            sessionId,
            cameraId,
            (update) => {
              if (update.type === 'captured') {
                setStatus('capturing');
              } else if (update.type === 'uploaded') {
                setStatus('uploaded');
              } else if (update.type === 'error') {
                setStatus('error');
              }
              setStats(update.stats);
              console.log('[CameraViewV2]', update);
            }
          );

          pipeline.start();
          pipelineRef.current = pipeline;
          setStatus('capturing');
        }
      } catch (err) {
        console.error('Camera error:', err);
        setStatus('error');
      }
    };

    startCamera();

    return () => {
      pipelineRef.current?.stop();
    };
  }, [sessionId, cameraId]);

  if (!sessionId) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-center p-4">
        <div className="space-y-3">
          <div className="text-4xl">📹</div>
          <p className="font-bold">Kein Session-Link</p>
          <p className="text-sm text-gray-400">Öffne den Link vom Trainer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="flex-1 w-full h-full object-cover"
      />

      {/* Status Badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-red-600/90 text-white rounded-lg text-sm font-bold">
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        LIVE {formatTime(elapsed)}
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold backdrop-blur-sm bg-black/60">
        <div className={`w-2 h-2 rounded-full ${
          status === 'captured' ? 'bg-yellow-400 animate-pulse' :
          status === 'uploaded' ? 'bg-green-400' :
          status === 'error' ? 'bg-red-400' :
          'bg-blue-400 animate-pulse'
        }`} />
        <span>
          {status === 'capturing' ? `📹 ${stats.capturedCount}` :
           status === 'uploaded' ? `✓ ${stats.uploadedCount}` :
           status === 'error' ? '⚠️ Error' :
           'Init...'}
        </span>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent space-y-3">
        {/* Error Display */}
        {stats.lastError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-600/20 border border-red-600/40 rounded-lg text-xs text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {stats.lastError}
          </div>
        )}

        {/* Signal Button */}
        <button
          onMouseDown={() => setMicActive(true)}
          onMouseUp={() => setMicActive(false)}
          onTouchStart={(e) => { e.preventDefault(); setMicActive(true); }}
          onTouchEnd={(e) => { e.preventDefault(); setMicActive(false); }}
          className={`w-full py-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 ${
            micActive ? 'bg-orange-500 neon-glow' : 'bg-black/60 border border-white/30'
          }`}
        >
          <Radio className="w-5 h-5" />
          {micActive ? 'Signal: Sprechend...' : 'Halten → Signal'}
        </button>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="bg-black/60 border border-white/20 rounded-lg p-2 text-center">
            <div className="font-bold text-blue-400">{stats.capturedCount}</div>
            <div className="text-white/50">Captured</div>
          </div>
          <div className="bg-black/60 border border-white/20 rounded-lg p-2 text-center">
            <div className="font-bold text-green-400">{stats.uploadedCount}</div>
            <div className="text-white/50">Uploaded</div>
          </div>
          <div className="bg-black/60 border border-white/20 rounded-lg p-2 text-center">
            <div className="font-bold text-yellow-400">{stats.failedCount}</div>
            <div className="text-white/50">Failed</div>
          </div>
        </div>

        {/* Info */}
        <div className="text-[10px] text-white/40 text-center">
          {status === 'capturing' && 'Frames werden erfasst (alle 40s)'}
          {status === 'uploaded' && 'Frames hochgeladen'}
          {status === 'error' && 'Fehler — siehe oben'}
          {status === 'initializing' && 'Initialisiere...'}
        </div>
      </div>
    </div>
  );
}