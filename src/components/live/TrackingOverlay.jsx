/**
 * TrackingOverlay — Visualisiert RF-DETR Tracking-Daten
 * Spieler-IDs, Geschwindigkeit, Formationslinien
 * (Echte Daten kämen vom RF-DETR Python-Backend)
 */
import { useEffect, useRef } from 'react';

export default function TrackingOverlay({ players, ball }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Draw formation lines (home)
    const home = players.filter(p => p.team === 'home').sort((a, b) => a.x - b.x);
    const away = players.filter(p => p.team === 'away').sort((a, b) => a.x - b.x);

    // Formation convex hull approximation (simple line)
    if (home.length > 1) {
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      home.forEach((p, i) => {
        const px = (p.x / 100) * W;
        const py = (p.y / 100) * H;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Pressing line (vertical average x of home team)
    const avgX = home.reduce((s, p) => s + p.x, 0) / Math.max(home.length, 1);
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo((avgX / 100) * W, 0);
    ctx.lineTo((avgX / 100) * W, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Speed labels for fast players
    players.forEach(p => {
      const spd = parseFloat(p.speed || 0);
      if (spd > 18) {
        const px = (p.x / 100) * W;
        const py = (p.y / 100) * H;
        ctx.fillStyle = spd > 24 ? 'rgba(251,191,36,0.9)' : 'rgba(255,255,255,0.6)';
        ctx.font = 'bold 8px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${spd} km/h`, px, py - 14);
      }
    });

    // Ball trajectory dot
    if (ball) {
      const bx = (ball.x / 100) * W;
      const by = (ball.y / 100) * H;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, 12);
      grad.addColorStop(0, 'rgba(251,191,36,0.6)');
      grad.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.fill();
    }

  }, [players, ball]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={460}
      className="absolute inset-0 w-full h-full pointer-events-none rounded-xl"
    />
  );
}