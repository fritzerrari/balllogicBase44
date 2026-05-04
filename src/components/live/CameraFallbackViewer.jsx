/**
 * CameraFallbackViewer — HTTP-Snapshot-Fallback für instabile WebRTC
 * Pollt alle 2s ein Snapshot-Bild von der Kamera statt Live-Stream
 * Robuster, läuft überall, aber mit 2s Latenz statt Echtzeit
 */
import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export default function CameraFallbackViewer({ sessionId, cameraId, isOnline, fallbackThumbnail }) {
  const imgRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ok | error
  const pollTimerRef = useRef(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!sessionId || !cameraId || !isOnline) {
      setStatus('error');
      return;
    }

    const pollSnapshot = async () => {
      if (!isOnline) return;
      try {
        // Cache-bust mit Timestamp
        const url = `/cam?session=${sessionId}&cam=${cameraId}&snapshot=1&t=${Date.now()}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const blob = await response.blob();
        const imgUrl = URL.createObjectURL(blob);
        
        if (imgRef.current) {
          // Cleanup alt Image URL
          if (imgRef.current.src && imgRef.current.src.startsWith('blob:')) {
            URL.revokeObjectURL(imgRef.current.src);
          }
          imgRef.current.src = imgUrl;
          setStatus('ok');
          lastUpdateRef.current = Date.now();
        }
      } catch (err) {
        console.warn(`[Fallback] Snapshot failed for cam ${cameraId}:`, err.message);
        setStatus('error');
      }
    };

    // Initial poll
    pollSnapshot();
    
    // Poll every 2 seconds
    pollTimerRef.current = setInterval(pollSnapshot, 2000);

    return () => {
      clearInterval(pollTimerRef.current);
      if (imgRef.current?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(imgRef.current.src);
      }
    };
  }, [sessionId, cameraId, isOnline]);

  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
      {/* Snapshot Image */}
      <img
        ref={imgRef}
        alt="camera"
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          status === 'ok' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback when not loaded */}
      {status !== 'ok' && (
        <div className="absolute inset-0">
          {fallbackThumbnail ? (
            <img src={fallbackThumbnail} alt="preview" className="w-full h-full object-cover opacity-40" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
              <div className="text-center space-y-2">
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                    <div className="text-xs text-white/50">Snapshots laden...</div>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-6 h-6 text-red-400 mx-auto" />
                    <div className="text-xs text-white/50">
                      {isOnline ? 'Verbindungsfehler' : 'Kamera offline'}
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
        status === 'ok' ? 'bg-green-600/80 text-white' :
        status === 'loading' ? 'bg-yellow-500/80 text-black' :
        'bg-red-600/80 text-white'
      }`}>
        <div className={`w-1.5 h-1.5 rounded-full ${
          status === 'ok' ? 'bg-white' :
          status === 'loading' ? 'bg-black animate-pulse' :
          'bg-white'
        }`} />
        {status === 'ok' ? 'SNAPSHOT (2s)' : status === 'loading' ? 'Verbinde...' : 'OFFLINE'}
      </div>
    </div>
  );
}