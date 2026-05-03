/**
 * CameraStreamViewLive — Live Video-Stream mit Tracking-Daten-Overlay
 * 
 * Zeigt:
 * - Live Thumbnail von Kamera (aktualisiert alle 3s)
 * - Erkannte Spieler + Ball als Overlay
 * - Verbindungs-Status + Qualität
 * - Frame-Count + Latency
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Radio, AlertCircle, TrendingUp } from 'lucide-react';
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

  // Draw thumbnail + tracking overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Canvas size
    canvas.width = 320;
    canvas.height = 180;

    // Dark background if no data
    ctx.fillStyle = '#0d260d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw thumbnail if available
    if (cameraStream?.thumbnail) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawTrackingOverlay(ctx, canvas.width, canvas.height);
        setOverlayDrawn(true);
      };
      img.onerror = () => {
        drawPlaceholder(ctx, canvas.width, canvas.height);
      };
      img.src = cameraStream.thumbnail;
    } else {
      drawPlaceholder(ctx, canvas.width, canvas.height);
    }

    function drawPlaceholder(ctx, w, h) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, w, h);
      
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cameraStream?.status === 'connected' ? 'Kamera lädt...' : 'Kamera offline', w / 2, h / 2 - 15);
      
      if (cameraStream?.label) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(cameraStream.label, w / 2, h / 2 + 15);
      }
    }

    function drawTrackingOverlay(ctx, w, h) {
      if (!trackingData?.player_positions) return;

      // Draw players
      trackingData.player_positions.forEach(p => {
        const x = (p.x / 100) * w;
        const y = (p.y / 100) * h;
        const color = p.team === 'home' ? '#4ade80' : '#ef4444';

        // Player dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Confidence ring
        const conf = Math.round((p.confidence || 0) / 100 * 255);
        ctx.strokeStyle = `rgba(${color === '#4ade80' ? '74,222,128' : '239,68,68'},${conf})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Draw ball
      if (trackingData.ball_position) {
        const bx = (trackingData.ball_position.x / 100) * w;
        const by = (trackingData.ball_position.y / 100) * h;
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // HUD: Player count
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(3, 3, 60, 30);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const homeCount = trackingData.player_positions.filter(p => p.team === 'home').length;
      const awayCount = trackingData.player_positions.filter(p => p.team === 'away').length;
      ctx.fillText(`🏠${homeCount}`, 6, 5);
      ctx.fillText(`✈${awayCount}`, 6, 17);

      // HUD: Ball indicator
      if (trackingData.ball_position) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(w - 40, 3, 37, 15);
        ctx.fillStyle = '#eab308';
        ctx.fillText('⚽ Erkannt', w - 37, 5);
      }
    }
  }, [cameraStream?.thumbnail, trackingData]);

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
      <div className="px-3 py-2 bg-muted/50 border-t border-border space-y-1.5">
        {/* Label + Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Camera className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground truncate">
                {cameraStream?.label || camera?.label || `Kamera ${camera?.camera_id}`}
              </div>
              <div className="text-[9px] text-muted-foreground">
                Code: {cameraStream?.code || camera?.code}
              </div>
            </div>
          </div>
        </div>

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