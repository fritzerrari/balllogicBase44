import { useEffect, useRef } from 'react';

/**
 * pitchType:
 *   'full'     — 11v11 Vollfeld (default)
 *   'half'     — Halbfeld (1 Tor, 1 Strafraum)
 *   'small'    — Kleines Feld (7v7 / 5v5, keine Strafräume)
 *   'training' — Trainingsfläche (nur Außenlinie + Mittelkreis)
 */
export default function FootballPitch({ dangerZones = [], players = [], showGrid = false, pitchType = 'full', className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Background
    ctx.fillStyle = '#0d260d';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      ctx.fillRect(0, i * (H / 10), W, H / 10);
    }

    const lineColor = 'rgba(255,255,255,0.35)';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;

    if (pitchType === 'full') {
      // Full 11v11 pitch
      ctx.strokeRect(20, 15, W - 40, H - 30);
      ctx.beginPath(); ctx.moveTo(W / 2, 15); ctx.lineTo(W / 2, H - 15); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 55, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = lineColor;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = lineColor;
      ctx.strokeRect(20, H / 2 - 75, 95, 150);
      ctx.strokeRect(20, H / 2 - 32, 40, 64);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(8, H / 2 - 22, 12, 44);
      ctx.strokeStyle = lineColor;
      ctx.strokeRect(W - 115, H / 2 - 75, 95, 150);
      ctx.strokeRect(W - 60, H / 2 - 32, 40, 64);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(W - 20, H / 2 - 22, 12, 44);

    } else if (pitchType === 'half') {
      // Half pitch (left half only, 1 goal)
      ctx.strokeRect(20, 15, W - 40, H - 30);
      ctx.beginPath(); ctx.moveTo(20, H / 2); ctx.lineTo(W - 20, H / 2); ctx.stroke();
      // Penalty area
      const paW = Math.round((W - 40) * 0.45), paH = Math.round((H - 30) * 0.65);
      ctx.strokeStyle = lineColor;
      ctx.strokeRect(20, H / 2 - paH / 2, paW, paH);
      // Goal area
      const gaW = Math.round(paW * 0.35), gaH = Math.round(paH * 0.45);
      ctx.strokeRect(20, H / 2 - gaH / 2, gaW, gaH);
      // Goal
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(8, H / 2 - gaH * 0.35, 12, gaH * 0.7);
      // Center spot
      ctx.fillStyle = lineColor;
      ctx.beginPath(); ctx.arc(W / 2, H - 20, 3, 0, Math.PI * 2); ctx.fill();

    } else if (pitchType === 'small') {
      // Small-sided field (5v5 / 7v7) — no penalty boxes, just outer + goals
      ctx.strokeRect(20, 15, W - 40, H - 30);
      ctx.beginPath(); ctx.moveTo(W / 2, 15); ctx.lineTo(W / 2, H - 15); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(40, W * 0.07), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = lineColor;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2); ctx.fill();
      // Small goals
      const goalH = H * 0.22;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(8, H / 2 - goalH / 2, 12, goalH);
      ctx.strokeRect(W - 20, H / 2 - goalH / 2, 12, goalH);

    } else if (pitchType === 'training') {
      // Open training area — just boundary + optional grid
      ctx.strokeRect(20, 15, W - 40, H - 30);
      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.font = `bold ${Math.round(W * 0.04)}px Space Grotesk, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TRAININGSFELD', W / 2, H / 2);
    }

    // Danger zones
    dangerZones.forEach(({ x, y, intensity, team }) => {
      const px = (x / 100) * W;
      const py = (y / 100) * H;
      const color = team === 'home' ? '142, 210, 100' : '255, 80, 80';
      const radius = 30 + intensity * 20;
      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
      gradient.addColorStop(0, `rgba(${color}, ${0.4 * intensity})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
    });

    // Players
    players.forEach(({ x, y, number, team }) => {
      const px = (x / 100) * W;
      const py = (y / 100) * H;
      const color = team === 'home' ? '#4ade80' : '#f87171';
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
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
        ctx.beginPath(); ctx.moveTo(i * (W / 6), 15); ctx.lineTo(i * (W / 6), H - 15); ctx.stroke();
      }
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(20, i * (H / 4)); ctx.lineTo(W - 20, i * (H / 4)); ctx.stroke();
      }
    }
  }, [dangerZones, players, showGrid, pitchType]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={460}
      className={`w-full h-full rounded-xl ${className}`}
    />
  );
}