/**
 * FrameMonitor — Echtzeit-Überwachung von Frame-Upload und Tracking
 * Zeigt: Upload-Rate, Tracking-Status, SessionState Data
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, AlertTriangle, Activity } from 'lucide-react';

export default function FrameMonitor({ sessionId, cameraId }) {
  const [frameCount, setFrameCount] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState(null);
  const [uploadRate, setUploadRate] = useState('0 fps');
  const [sessionState, setSessionState] = useState(null);
  const [isHealthy, setIsHealthy] = useState(false);

  // Subscribe to SessionState updates
  useEffect(() => {
    if (!sessionId) return;

    try {
      const unsubscribe = base44.entities.SessionState.subscribe((event) => {
        if (event.type === 'update' && event.data?.session_id === sessionId) {
          setSessionState(event.data);
          setFrameCount(event.data.frame_count || 0);
          setLastFrameTime(Date.now());
          setIsHealthy(true);
        }
      });
      return () => unsubscribe?.();
    } catch (err) {
      console.warn('[FrameMonitor] Subscribe failed:', err.message);
    }
  }, [sessionId]);

  // Calculate FPS
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastFrameTime && Date.now() - lastFrameTime < 10000) {
        const fps = frameCount > 0 ? (frameCount / ((Date.now() - lastFrameTime) / 1000)).toFixed(1) : 0;
        setUploadRate(`${fps} fps`);
      } else {
        setUploadRate('0 fps');
        setIsHealthy(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [frameCount, lastFrameTime]);

  const quality = sessionState?.detection_quality_avg ?? 0;
  const possession = sessionState?.possession_percentage ?? { home: 0, away: 0 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-3 border border-primary/20 space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isHealthy ? (
            <Wifi className="w-4 h-4 text-green-400 animate-pulse" />
          ) : (
            <WifiOff className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-xs font-bold text-foreground">Frame Monitor</span>
        </div>
        <div className="text-xs font-mono font-bold text-primary">{uploadRate}</div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="bg-muted/50 rounded p-2 text-center">
          <div className="font-bold text-foreground">{frameCount}</div>
          <div className="text-muted-foreground">Frames</div>
        </div>
        <div className={`rounded p-2 text-center font-bold ${
          quality >= 70 ? 'bg-green-500/10 text-green-400' :
          quality >= 40 ? 'bg-yellow-500/10 text-yellow-400' :
          'bg-red-500/10 text-red-400'
        }`}>
          <div>{quality}%</div>
          <div className="text-muted-foreground">Quality</div>
        </div>
        <div className="bg-muted/50 rounded p-2 text-center">
          <div className="font-bold text-foreground">
            {Math.round(possession.home ?? 0)}%
          </div>
          <div className="text-muted-foreground">Home</div>
        </div>
      </div>

      {/* Status */}
      {!isHealthy && (
        <div className="flex items-center gap-2 text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          Kamera sendet keine Frames seit {lastFrameTime ? Math.round((Date.now() - lastFrameTime) / 1000) : '?'}s
        </div>
      )}

      {isHealthy && frameCount > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded p-2">
          <Activity className="w-3 h-3 flex-shrink-0 animate-pulse" />
          Tracking läuft — {frameCount} Frames verarbeitet
        </div>
      )}
    </motion.div>
  );
}