/**
 * VideoOverlayPlayer – Live-Video mit Tracking-Overlay
 * 
 * Zeigt:
 * - Video-Stream
 * - Spieler als farbige Punkte
 * - Ball als gelber Punkt
 * - Formation-Labels
 */
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

export default function VideoOverlayPlayer({ videoStream, detections, ball, teamColors = {} }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const animFrameRef = useRef(null);

  // Auto-draw even if no video source (simulation mode)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const redraw = () => {
      canvas.width = canvas.width || 640;
      canvas.height = canvas.height || 360;
      ctx.fillStyle = '#0d260d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Always draw overlay even without video
      if (detections?.length > 0) {
        detections.forEach(player => {
          if (player.class === 'ball') return;
          const x = (player.x / 100) * canvas.width;
          const y = (player.y / 100) * canvas.height;
          const color = player.team === 'home' ? { r: 52, g: 211, b: 153 } : { r: 239, g: 68, b: 68 };
          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      if (ball) {
        const bx = (ball.x / 100) * canvas.width;
        const by = (ball.y / 100) * canvas.height;
        ctx.fillStyle = 'rgba(234, 179, 8, 0.9)';
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      animFrameRef.current = requestAnimationFrame(redraw);
    };
    redraw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [detections, ball]);

  const defaultColors = {
    home: { r: 52, g: 211, b: 153 }, // primary grün
    away: { r: 239, g: 68, b: 68 }, // red
  };



  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-border">
        <video
          ref={videoRef}
          autoPlay
          muted={muted}
          playsInline
          className="hidden"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />

        {/* Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center gap-2">
          <button
            onClick={() => setPlaying(!playing)}
            className="p-2 rounded-lg bg-primary/80 text-white hover:bg-primary transition-all"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMuted(!muted)}
            className="p-2 rounded-lg bg-muted/80 text-white hover:bg-muted transition-all"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <span className="text-xs text-white/60 ml-auto">
            {detections?.length || 0} Spieler · Ball {ball ? 'erkannt' : 'suche...'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span>Heim</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Gäste</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>Ball</span>
        </div>
      </div>
    </div>
  );
}