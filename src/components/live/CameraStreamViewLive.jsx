/**
 * CameraStreamViewLive — Live Video-Stream mit Tracking-Daten-Overlay + Direct Link
 * 
 * Zeigt:
 * - Live Thumbnail von Kamera (mit Fallback zu Placeholder)
 * - Erkannte Spieler + Ball als Overlay
 * - Verbindungs-Status + Qualität
 * - Direct-Link zum Öffnen der Kamera auf Handy
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, ExternalLink, AlertCircle, TrendingUp, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function CameraStreamViewLive({ 
  camera, 
  sessionId,
  trackingData = null,
  onThumbnailUpdate = null
}) {
  const canvasRef = useRef(null);
  const [overlayDrawn, setOverlayDrawn] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  // Poll camera thumbnail every 3s from LiveSession
  const { data: liveSession } = useQuery({
    queryKey: ['session-camera-stream', sessionId, camera.camera_id],
    queryFn: async () => {
      const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
      return sessions?.[0];
    },
    refetchInterval: 3000,
    staleTime: 1000,
  });

  // Get current camera data from session
  const cameraStream = liveSession?.camera_streams?.find(
    c => String(c.camera_id) === String(camera.camera_id)
  );

  // Draw canvas — simple status display, no waiting for thumbnail
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 180;

    // Background
    const bgColor = cameraStream?.status === 'connected' ? '#1a3a1a' : '#2a2a2a';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Status text
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      cameraStream?.status === 'connected' ? '● LIVE' : '○ WARTET',
      canvas.width / 2,
      canvas.height / 2 - 20
    );

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px monospace';
    ctx.fillText(cameraStream?.label || `Kamera ${camera?.camera_id}`, canvas.width / 2, canvas.height / 2 + 30);

    // Draw tracking overlay if data available
    // Only overlay if connected + has data
    if (trackingData?.player_positions) {
      drawTrackingOverlay(ctx, canvas.width, canvas.height);
    }

    function drawTrackingOverlay(ctx, w, h) {
      trackingData.player_positions?.forEach(p => {
        const x = (p.x / 100) * w;
        const y = (p.y / 100) * h;
        const color = p.team === 'home' ? '#4ade80' : '#ef4444';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      if (trackingData.ball_position) {
        const bx = (trackingData.ball_position.x / 100) * w;
        const by = (trackingData.ball_position.y / 100) * h;
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [cameraStream?.status, camera?.camera_id, trackingData]);

  // Calculate last seen
  const lastSeen = cameraStream?.last_seen
    ? Math.round((Date.now() - new Date(cameraStream.last_seen).getTime()) / 1000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-xl overflow-hidden border border-border hover:border-primary/40 transition-all"
    >
      {/* Video/Canvas Area */}
      <div className="relative aspect-video bg-black">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
        />

        {/* Status Badge */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 ${
          cameraStream?.status === 'connected'
            ? 'bg-primary/80 text-primary-foreground'
            : 'bg-black/70 text-yellow-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            cameraStream?.status === 'connected' ? 'bg-white animate-pulse' : 'bg-yellow-400'
          }`} />
          {cameraStream?.status === 'connected' ? 'LIVE' : 'WARTET'}
          {lastSeen !== null && lastSeen < 10 && <span>{lastSeen}s</span>}
        </div>

        {/* Quality Badge */}
        {trackingData?.detection_quality && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[9px] font-bold bg-black/70 text-green-400 flex items-center gap-1">
            <TrendingUp className="w-2.5 h-2.5" />
            {trackingData.detection_quality}%
          </div>
        )}
      </div>

      {/* Info Bar */}
      <div className="px-3 py-2 bg-muted/50 border-t border-border space-y-2">
        {/* Label + Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Camera className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground truncate">
                {cameraStream?.label || camera?.label || `Kamera ${camera?.camera_id}`}
              </div>
              <div className={`text-[9px] font-bold flex items-center gap-1 ${
                cameraStream?.status === 'connected' ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {cameraStream?.status === 'connected' ? <Check className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                {cameraStream?.status === 'connected' ? 'Verbunden' : 'Wartet'}
              </div>
            </div>
          </div>
        </div>

        {/* Direct Link Button */}
        <button
          onClick={() => {
            const camUrl = `${window.location.origin}/cam?session=${sessionId}&cam=${camera.camera_id}`;
            window.open(camUrl, '_blank');
          }}
          className="w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary text-xs font-bold hover:bg-primary/30 transition-all"
        >
          <ExternalLink className="w-3 h-3" />
          Auf Handy öffnen
        </button>

        {/* Tracking Stats */}
        {trackingData && (
          <div className="grid grid-cols-3 gap-1 text-[9px] text-muted-foreground">
            <div className="px-1.5 py-0.5 bg-background/50 rounded">
              👥 {trackingData.player_positions?.length || 0}
            </div>
            <div className="px-1.5 py-0.5 bg-background/50 rounded">
              ⚽ {trackingData.ball_position ? '✓' : '○'}
            </div>
            <div className="px-1.5 py-0.5 bg-background/50 rounded">
              Frame #{trackingData.frame_number || 0}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}