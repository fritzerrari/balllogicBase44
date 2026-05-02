import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Download } from 'lucide-react';

/**
 * HeatmapVisualization — Canvas-basierte Heatmap Rendering
 * 
 * Props:
 *   - gridData: Array von {x, y, intensity}
 *   - title: "Player Density" etc.
 *   - loading: bool
 */
export default function HeatmapVisualization({ gridData = [], title = 'Heatmap', loading = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !gridData.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const cellWidth = canvas.width / 10;
    const cellHeight = canvas.height / 10;

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellWidth, 0);
      ctx.lineTo(i * cellWidth, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellHeight);
      ctx.lineTo(canvas.width, i * cellHeight);
      ctx.stroke();
    }

    // Heatmap cells
    for (const cell of gridData) {
      const x = cell.x * cellWidth;
      const y = cell.y * cellHeight;
      const intensity = cell.intensity / 100;

      // Color gradient: blue (low) → red (high)
      let r, g, b;
      if (intensity < 0.5) {
        r = Math.round(0 + intensity * 2 * 255);
        g = 0;
        b = Math.round(255 - intensity * 2 * 255);
      } else {
        r = 255;
        g = Math.round((intensity - 0.5) * 2 * 255);
        b = 0;
      }

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${intensity * 0.7})`;
      ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
    }

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }, [gridData]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground text-sm">{title}</h3>
        {loading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
      </div>

      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="w-full rounded-lg border border-border bg-muted"
      />

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>Low</div>
        <div className="flex gap-1">
          {[0, 25, 50, 75, 100].map(val => (
            <div
              key={val}
              style={{
                background: val < 50
                  ? `rgb(${val * 2.55}, 0, ${255 - val * 2.55})`
                  : `rgb(255, ${(val - 50) * 5.1}, 0)`,
                width: '20px',
                height: '12px',
                borderRadius: '2px',
              }}
            />
          ))}
        </div>
        <div>High</div>
      </div>
    </div>
  );
}