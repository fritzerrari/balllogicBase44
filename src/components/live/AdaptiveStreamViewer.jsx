/**
 * AdaptiveStreamViewer — Stabil Streaming mit Frame-Capture statt WebRTC
 * 
 * - Verwendet AdaptiveFrameCapture (alle 15-60s Snapshots)
 * - Zeigt Live-Video + Status-KPIs
 * - Recovery-Panel bei Reload falls Frames in localStorage
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, AlertTriangle, Loader2, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdaptiveFrameCapture } from '@/lib/adaptiveFrameCapture';

export default function AdaptiveStreamViewer({ sessionId, cameraId, onStatusChange }) {
  const videoRef = useRef(null);
  const captureRef = useRef(null);
  
  const [status, setStatus] = useState('ready'); // ready | streaming | error | fallback
  const [progress, setProgress] = useState(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryData, setRecoveryData] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Starte Capture bei Mount
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // Check für Recovery-Kandidaten
      const recovery = await AdaptiveFrameCapture.recoverFrames(sessionId);
      if (recovery) {
        setRecoveryData(recovery);
        setShowRecovery(true);
        return; // Warte auf User-Action
      }

      startCapture();
    };

    init();

    return () => {
      if (captureRef.current) {
        captureRef.current.stop();
      }
    };
  }, [sessionId]);

  const startCapture = async () => {
    if (captureRef.current) {
      captureRef.current.stop();
    }

    captureRef.current = new AdaptiveFrameCapture(sessionId, cameraId, (prog) => {
      setProgress(prog);
      setStatus(prog.status);
      onStatusChange?.(prog);
    });

    const success = await captureRef.current.start(videoRef.current);
    if (success) {
      setStatus('streaming');
    } else {
      setStatus('error');
    }
  };

  const handleRecover = async () => {
    if (!recoveryData) return;
    
    setIsRecovering(true);
    const success = await recoveryData.onRecover();
    setIsRecovering(false);
    
    if (success) {
      setShowRecovery(false);
      setRecoveryData(null);
      startCapture();
    }
  };

  const handleDiscard = () => {
    localStorage.removeItem(`frames_${sessionId}`);
    setShowRecovery(false);
    setRecoveryData(null);
    startCapture();
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

      {/* Video Container */}
      <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
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
                  <div className="text-sm text-white/70">Kamera wird aktiviert...</div>
                </>
              ) : status === 'error' ? (
                <>
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                  <div className="text-sm text-red-400">Kamera nicht verfügbar</div>
                  <Button
                    onClick={startCapture}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Erneut versuchen
                  </Button>
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