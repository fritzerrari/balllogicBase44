/**
 * AdaptiveStreamViewer — Stabil Streaming mit Frame-Capture statt WebRTC
 * 
 * - Verwendet AdaptiveFrameCapture (alle 15-60s Snapshots)
 * - Zeigt Live-Video + Status-KPIs
 * - Recovery-Panel bei Reload falls Frames in localStorage
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, AlertTriangle, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function AdaptiveStreamViewer({ sessionId, cameraId, onStatusChange }) {

  
  const [status, setStatus] = useState('ready'); // ready | streaming | error | fallback
  const [progress, setProgress] = useState(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryData, setRecoveryData] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const canvasRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Warte auf externe Kamera-Frames (vom Handy)
  // Dieser Viewer empfängt nur Snapshots, startet KEINE lokale Kamera
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setStatus('ready'); // Bereit zum Empfang von Frames
    
    return () => {
      // Cleanup
    };
  }, [sessionId]);

  // Frame Display vom SessionState Polling
  useEffect(() => {
    let lastFrameTime = 0;

    const pollFrames = async () => {
      try {
        const states = await base44.entities.SessionState.filter({ session_id: sessionId });
        if (states.length === 0) return;

        const state = states[0];
        if (!state.latest_frame_base64) {
          setStatus('ready');
          return;
        }

        // Nur wenn neue Frame (verhindert Redundanz)
        if (state.latest_frame_timestamp <= lastFrameTime) return;
        lastFrameTime = state.latest_frame_timestamp;

        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          const img = new Image();

          img.onload = () => {
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              setStatus('streaming');
              setProgress({
                status: 'streaming',
                capturedCount: 0,
                droppedCount: 0,
                pendingFrames: 0,
                totalUploaded: 0,
              });
            }
          };
          img.onerror = () => {
            console.warn('[SnapshotViewer] Image load failed');
            setStatus('error');
          };

          img.src = `data:image/jpeg;base64,${state.latest_frame_base64}`;
        }
      } catch (err) {
        console.warn('[SnapshotViewer] Poll failed:', err.message);
        setStatus('error');
      }
    };

    // Poll alle 2 Sekunden
    const interval = setInterval(pollFrames, 2000);
    pollFrames(); // Initial poll
    return () => clearInterval(interval);
  }, [sessionId]);

  const handleRecover = async () => {
    if (!recoveryData) return;
    
    setIsRecovering(true);
    const success = await recoveryData.onRecover();
    setIsRecovering(false);
    
    if (success) {
      setShowRecovery(false);
      setRecoveryData(null);
    }
  };

  const handleDiscard = () => {
    localStorage.removeItem(`frames_${sessionId}`);
    setShowRecovery(false);
    setRecoveryData(null);
  };

  return (
    <div className="space-y-3">
      {/* Recovery Panel */}
      <AnimatePresence>
        {showRecovery && recoveryData && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-foreground">
                  {recoveryData.frameCount} ungesendete Frames gefunden
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Ältester Frame von {recoveryData.oldestFrame.toLocaleTimeString('de')}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRecover}
                disabled={isRecovering}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 gap-2"
              >
                {isRecovering
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird hochgeladen...</>
                  : <><Download className="w-4 h-4" /> Hochladen & Fortsetzen</>
                }
              </Button>
              <Button
                onClick={handleDiscard}
                variant="outline"
                className="flex-1"
                disabled={isRecovering}
              >
                Verwerfen
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas für Snapshot Display */}
      <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className={`w-full h-full object-cover transition-opacity ${
            status === 'streaming' ? 'opacity-100' : 'opacity-50'
          }`}
        />

        {/* Status Overlay */}
        {status !== 'streaming' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center space-y-2">
              {status === 'ready' ? (
                <>
                  <Play className="w-8 h-8 text-primary mx-auto animate-pulse" />
                  <div className="text-sm text-white/70">Warte auf externe Kamera...</div>
                </>
              ) : status === 'error' ? (
                <>
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                  <div className="text-sm text-red-400">Keine Frames empfangen</div>
                </>
              ) : (
                <>
                  <Loader2 className="w-8 h-8 text-yellow-400 mx-auto animate-spin" />
                  <div className="text-sm text-white/70">
                    {status.charAt(0).toUpperCase() + status.slice(1)}...
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className={`absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold backdrop-blur-sm z-10 ${
          status === 'streaming'
            ? 'bg-green-600/80 text-white'
            : status === 'error'
            ? 'bg-red-600/80 text-white'
            : 'bg-yellow-600/80 text-white'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            status === 'streaming'
              ? 'bg-white animate-pulse'
              : 'bg-white'
          }`} />
          {status === 'streaming' ? 'FRAME CAPTURE' : status === 'error' ? 'FEHLER' : 'WIRD VORBEREITET'}
        </div>

        {/* Live Indicator */}
        {status === 'streaming' && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-600/90 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold z-10">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      {/* KPI Panel */}
      {progress && status === 'streaming' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-4 gap-2 text-[10px]"
        >
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="font-bold text-foreground">{progress.capturedCount || 0}</div>
            <div className="text-muted-foreground">Captured</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="font-bold text-yellow-400">{progress.droppedCount || 0}</div>
            <div className="text-muted-foreground">Dropped</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="font-bold text-primary">{progress.pendingFrames || 0}</div>
            <div className="text-muted-foreground">Pending</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="font-bold text-green-400">{progress.totalUploaded || 0}</div>
            <div className="text-muted-foreground">Uploaded</div>
          </div>
        </motion.div>
      )}

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-xs text-blue-300 space-y-1">
        <div className="font-bold">ℹ️ Adaptive Frame Capture</div>
        <div>
          Stellt automatisch Snapshots alle 15–60 Sekunden bereit. Offline-resilient dank localStorage-Puffer.
          Viel stabiler als Live-Streaming bei instabilen Netzen.
        </div>
      </div>
    </div>
  );
}