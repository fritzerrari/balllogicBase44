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
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const animFrameRef = useRef(null);

  const defaultColors = {
    home: { r: 52, g: 211, b: 153 }, // primary grün
    away: { r: 239, g: 68, b: 68 }, // red
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    const drawFrame = () => {
      // Video auf Canvas zeichnen
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        ctx.drawImage(video, 0, 0);

        // Overlay: Spieler
        if (detections?.length > 0) {
          detections.forEach(player => {
            if (player.class === 'ball') return;

            const x = (player.x / 100) * canvas.width;
            const y = (player.y / 100) * canvas.height;
            const color = player.team === 'home' ? defaultColors.home : defaultColors.away;

            // Spieler-Kreis
            ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();

            // Kontur
            ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Confidence-Label
            const confPercent = Math.round(player.confidence);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(x - 12, y - 18, 24, 14);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${confPercent}%`, x, y - 11);
          });
        }

        // Ball
        if (ball) {
          const bx = (ball.x / 100) * canvas.width;
          const by = (ball.y / 100) * canvas.height;
          ctx.fillStyle = 'rgba(234, 179, 8, 0.9)'; // gold
          ctx.beginPath();
          ctx.arc(bx, by, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(234, 179, 8, 1)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // HUD-Info oben links
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, 10, 150, 50);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '12px monospace';
        ctx.fillText(`Players: ${detections?.length || 0}`, 15, 30);
        ctx.fillText(`Ball: ${ball ? '●' : '○'}`, 15, 50);
      }

      animFrameRef.current = requestAnimationFrame(drawFrame);
    };

    if (playing) {
      drawFrame();
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [detections, ball, playing]);

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