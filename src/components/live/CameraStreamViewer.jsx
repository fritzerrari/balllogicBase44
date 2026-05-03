/**
 * CameraStreamViewer — Zeigt Live-Video-Stream einer Kamera
 * Kombiniert: MJPEG-Stream vom Backend + Fallback auf Placeholder
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Wifi, WifiOff, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CameraStreamViewer({ camera, sessionId }) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simuliere Stream-Status basierend auf camera.status
    if (camera.status === 'connected') {
      setIsConnected(true);
      setError(null);
    } else {
      setIsConnected(false);
      setError('Kamera wartet auf Verbindung...');
    }
  }, [camera.status]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative aspect-video bg-black rounded-xl overflow-hidden border border-border"
    >
      {/* Stream Container */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isConnected && camera.thumbnail ? (
          <img
            src={camera.thumbnail}
            alt={camera.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted/30 to-muted/10">
            <Camera className="w-12 h-12 text-muted-foreground mb-2 opacity-50" />
            <p className="text-xs text-muted-foreground text-center">
              {camera.status === 'connected' ? 'Stream wird geladen...' : 'Warte auf Kamera...'}
            </p>
          </div>
        )}
      </div>

      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-2 z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isConnected ? 'bg-primary animate-pulse' : 'bg-yellow-400 animate-pulse'
            }`} />
            <span className="text-xs font-medium text-white truncate">{camera.label}</span>
          </div>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {camera.status === 'connected' ? (
              <>
                <Wifi className="w-2.5 h-2.5 mr-1" /> Live
              </>
            ) : (
              <>
                <WifiOff className="w-2.5 h-2.5 mr-1" /> Offline
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Error State */}
      {error && !isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
          <div className="text-center">
            <Radio className="w-8 h-8 text-yellow-400 mx-auto mb-2 opacity-75" />
            <p className="text-xs text-yellow-400">{error}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}