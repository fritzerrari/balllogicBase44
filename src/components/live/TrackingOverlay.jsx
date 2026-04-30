/**
 * TrackingOverlay — Rendert echte Roboflow-Detektionen auf Canvas
 * Spieler (Heim/Gäste/Torwart), Schiedsrichter, Ball
 * Formations-Linien, Pressing-Linie, Geschwindigkeit, Event-Highlights
 */
import { useEffect, useRef } from 'react';

export default function TrackingOverlay({ players = [], ball = null, events = [] }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const home = players.filter(p => p.team === 'home');
    const away = players.filter(p => p.team === 'away');
    const referee = players.find(p => p.class === 'referee');

    // ── Formation convex-hull lines ──────────────────────────────────────────
    const drawFormationLine = (team, color) => {
      const sorted = [...team].sort((a, b) => a.y - b.y);
      if (sorted.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      sorted.forEach((p, i) => {
        const px = (p.x / 100) * W;
        const py = (p.y / 100) * H;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };
    drawFormationLine(home, 'rgba(74,222,128,0.25)');
    drawFormationLine(away, 'rgba(248,113,113,0.25)');

    // ── Pressing line (vertical avg X of home team) ─────────────────────────
    if (home.length > 0) {
      const avgX = home.reduce((s, p) => s + p.x, 0) / home.length;
      ctx.strokeStyle = 'rgba(74,222,128,0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo((avgX / 100) * W, 0);
      ctx.lineTo((avgX / 100) * W, H);
      ctx.stroke();
      ctx.setLineDash([]);
      // Label
      ctx.fillStyle = 'rgba(74,222,128,0.8)';
      ctx.font = 'bold 8px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(`Pressing ${avgX.toFixed(0)}%`, (avgX / 100) * W, 10);
    }

    // ── Players ─────────────────────────────────────────────────────────────
    const drawPlayer = (p, fillColor, borderColor, label) => {
      const px = (p.x / 100) * W;
      const py = (p.y / 100) * H;
      const r = 9;

      // Shadow
      ctx.shadowColor = fillColor;
      ctx.shadowBlur = 6;

      // Circle
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Number / label
      ctx.fillStyle = '#000';
      ctx.font = 'bold 7px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label || '', px, py);

      // Speed above
      const spd = parseFloat(p.speed || 0);
      if (spd > 16) {
        ctx.fillStyle = spd > 24 ? 'rgba(251,191,36,1)' : 'rgba(255,255,255,0.75)';
        ctx.font = 'bold 7px Inter';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`${spd}`, px, py - r - 2);
      }
    };

    home.forEach((p, i) => {
      const color = p.class === 'goalkeeper' ? '#22c55e' : '#4ade80';
      drawPlayer(p, color, '#fff', p.number || (i + 1));
    });

    away.forEach((p, i) => {
      const color = p.class === 'goalkeeper' ? '#dc2626' : '#f87171';
      drawPlayer(p, color, '#fff', p.number || (i + 1));
    });

    // ── Referee ─────────────────────────────────────────────────────────────
    if (referee) {
      const px = (referee.x / 100) * W;
      const py = (referee.y / 100) * H;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 7px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('R', px, py);
    }

    // ── Ball ─────────────────────────────────────────────────────────────────
    if (ball) {
      const bx = (ball.x / 100) * W;
      const by = (ball.y / 100) * H;

      // Glow ring
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, 16);
      grad.addColorStop(0, 'rgba(251,191,36,0.5)');
      grad.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, 16, 0, Math.PI * 2);
      ctx.fill();

      // Ball dot
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // ── Event flash highlights ───────────────────────────────────────────────
    events.forEach(ev => {
      if (ev.type === 'goal' && ball) {
        const bx = (ball.x / 100) * W;
        const by = (ball.y / 100) * H;
        ctx.strokeStyle = 'rgba(74,222,128,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bx, by, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(74,222,128,0.9)';
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('⚽ TOR!', bx, by - 30);
      }
      if (ev.type === 'corner' && ball) {
        ctx.fillStyle = 'rgba(251,191,36,0.9)';
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('📐 ECKE', (ball.x / 100) * W, (ball.y / 100) * H - 28);
      }
    });

  }, [players, ball, events]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={460}
      className="absolute inset-0 w-full h-full pointer-events-none rounded-xl"
    />
  );
}