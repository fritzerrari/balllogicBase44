/**
 * HeatmapVisualization — 10x10 Grid Heatmap Canvas Renderer
 */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function HeatmapVisualization({ gridData, title, loading }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gridData || gridData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const cellSize = canvas.width / 10;

    // Background
    ctx.fillStyle = '#0d1f0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }

    // Draw heatmap
    for (let i = 0; i < gridData.length; i++) {
      const intensity = gridData[i] || 0;
      const x = (i % 10) * cellSize;
      const y = Math.floor(i / 10) * cellSize;

      // Interpolate color: cool (0%) → hot (100%)
      let r, g, b;
      if (intensity < 50) {
        // Blue → Green
        const t = intensity / 50;
        r = 0;
        g = Math.round(255 * t);
        b = Math.round(255 * (1 - t));
      } else {
        // Green → Red
        const t = (intensity - 50) / 50;
        r = Math.round(255 * t);
        g = Math.round(255 * (1 - t));
        b = 0;
      }

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

      // Label
      if (intensity > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${intensity}`, x + cellSize / 2, y + cellSize / 2);
      }
    }
  }, [gridData]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground">{title}</h4>
        {loading && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
      </div>
      <div className="aspect-square rounded-xl overflow-hidden border border-border bg-black">
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="w-full h-full"
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2">
        <span>Kalt (0%)</span>
        <span>Heiß (100%)</span>
      </div>
    </motion.div>
  );
}