import { useEffect, useRef } from 'react';

export default function FootballPitch({ dangerZones = [], players = [], showGrid = false, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Pitch background
    ctx.fillStyle = '#0d260d';
    ctx.fillRect(0, 0, W, H);

    // Grass stripes
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      ctx.fillRect(0, i * (H / 10), W, H / 10);
    }

    const lineColor = 'rgba(255,255,255,0.35)';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;

    // Outer boundary
    ctx.strokeRect(20, 15, W - 40, H - 30);

    // Center line
    ctx.beginPath();
    ctx.moveTo(W / 2, 15);
    ctx.lineTo(W / 2, H - 15);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 55, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Left penalty area
    ctx.strokeRect(20, H / 2 - 75, 95, 150);
    // Left goal area
    ctx.strokeRect(20, H / 2 - 32, 40, 64);
    // Left goal
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(8, H / 2 - 22, 12, 44);

    // Right penalty area
    ctx.strokeStyle = lineColor;
    ctx.strokeRect(W - 115, H / 2 - 75, 95, 150);
    // Right goal area
    ctx.strokeRect(W - 60, H / 2 - 32, 40, 64);
    // Right goal
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(W - 20, H / 2 - 22, 12, 44);

    // Danger zones heatmap
    dangerZones.forEach(({ x, y, intensity, team }) => {
      const px = (x / 100) * W;
      const py = (y / 100) * H;
      const color = team === 'home' ? '142, 210, 100' : '255, 80, 80';
      const radius = 30 + intensity * 20;
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
      gradient.addColorStop(0, `rgba(${color}, ${0.4 * intensity})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Players
    players.forEach(({ x, y, number, team }) => {
      const px = (x / 100) * W;
      const py = (y / 100) * H;
      const color = team === 'home' ? '#4ade80' : '#f87171';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 8px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(number || '', px, py);
    });

    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(i * (W / 6), 15);
        ctx.lineTo(i * (W / 6), H - 15);
        ctx.stroke();
      }
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(20, i * (H / 4));
        ctx.lineTo(W - 20, i * (H / 4));
        ctx.stroke();
      }
    }
  }, [dangerZones, players, showGrid]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={460}
      className={`w-full h-full rounded-xl ${className}`}
    />
  );
}