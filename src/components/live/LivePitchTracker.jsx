/**
 * LivePitchTracker — Live Pitch Visualisierung mit echten Tracking-Daten
 * Spieler-Positionen, Ball, Formations-Linien, Ballbesitz, Pressing-Linie
 * Pollt SessionState + TrackingData in Echtzeit
 */
import { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

function drawPitch(ctx, W, H) {
  // Green gradient background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1f0a');
  bg.addColorStop(1, '#0d2d0d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Stripes
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.018)';
      ctx.fillRect(i * (W / 8), 0, W / 8, H);
    }
  }

  const lc = 'rgba(255,255,255,0.38)';
  ctx.strokeStyle = lc;
  ctx.lineWidth = 1.5;

  // Outer boundary
  ctx.strokeRect(18, 12, W - 36, H - 24);

  // Center line
  ctx.beginPath(); ctx.moveTo(W / 2, 12); ctx.lineTo(W / 2, H - 12); ctx.stroke();

  // Center circle
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 52, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = lc;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2); ctx.fill();

  // Left penalty area
  ctx.strokeRect(18, H / 2 - 70, 88, 140);
  ctx.strokeRect(18, H / 2 - 28, 36, 56);
  // Left goal
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeRect(6, H / 2 - 20, 12, 40);

  // Right penalty area
  ctx.strokeStyle = lc;
  ctx.strokeRect(W - 106, H / 2 - 70, 88, 140);
  ctx.strokeRect(W - 54, H / 2 - 28, 36, 56);
  // Right goal
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeRect(W - 18, H / 2 - 20, 12, 40);
}

export default function LivePitchTracker({ sessionId, kickoffDetected }) {
  const canvasRef = useRef(null);

  const { data: sessionState } = useQuery({
    queryKey: ['session-state-pitch', sessionId],
    queryFn: () => base44.entities.SessionState.filter({ session_id: sessionId }),
    refetchInterval: 1500,
    select: d => d?.[0],
  });

  const { data: lastTracking } = useQuery({
    queryKey: ['tracking-latest', sessionId],
    queryFn: () => base44.entities.TrackingData.filter({ session_id: sessionId }, '-timestamp_ms', 1),
    refetchInterval: 1500,
    select: d => d?.[0],
  });

  const { data: recentEvents = [] } = useQuery({
    queryKey: ['recent-events-pitch', sessionId],
    queryFn: () => base44.entities.MatchEvent.filter({ session_id: sessionId }, '-timestamp_ms', 5),
    refetchInterval: 3000,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    drawPitch(ctx, W, H);

    const players = lastTracking?.player_positions || [];
    const ball = lastTracking?.ball_position;
    const home = players.filter(p => p.team === 'home');
    const away = players.filter(p => p.team === 'away');

    // Formation lines (dashed)
    const drawFormLine = (team, color) => {
      const sorted = [...team].sort((a, b) => a.x - b.x);
      if (sorted.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      sorted.forEach((p, i) => {
        const px = (p.x / 100) * W;
        const py = (p.y / 100) * H;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };
    drawFormLine(home, 'rgba(74,222,128,0.3)');
    drawFormLine(away, 'rgba(248,113,113,0.3)');

    // Pressing line
    if (home.length >= 3) {
      const avgX = home.reduce((s, p) => s + p.x, 0) / home.length;
      ctx.strokeStyle = 'rgba(74,222,128,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo((avgX / 100) * W, 12);
      ctx.lineTo((avgX / 100) * W, H - 12);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(74,222,128,0.9)';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`▲ ${avgX.toFixed(0)}%`, (avgX / 100) * W, 10);
    }

    // Draw players
    const drawPlayer = (p, fill, border, label) => {
      const px = (p.x / 100) * W;
      const py = (p.y / 100) * H;
      const r = 9;
      ctx.shadowColor = fill;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000';
      ctx.font = 'bold 7px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px, py);
    };

    home.forEach((p, i) => {
      const fill = p.class === 'goalkeeper' ? '#16a34a' : '#4ade80';
      drawPlayer(p, fill, '#fff', p.number || String(i + 1));
    });
    away.forEach((p, i) => {
      const fill = p.class === 'goalkeeper' ? '#b91c1c' : '#f87171';
      drawPlayer(p, fill, '#fff', p.number || String(i + 1));
    });

    // Ball
    if (ball) {
      const bx = (ball.x / 100) * W;
      const by = (ball.y / 100) * H;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, 18);
      grad.addColorStop(0, 'rgba(251,191,36,0.6)');
      grad.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(bx, by, 18, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Event flash
    const lastEvent = recentEvents[0];
    if (lastEvent && ball && (Date.now() - lastEvent.timestamp_ms) < 4000) {
      if (lastEvent.type === 'goal') {
        const bx = (ball.x / 100) * W;
        const by = (ball.y / 100) * H;
        ctx.strokeStyle = 'rgba(74,222,128,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(bx, by, 26, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('⚽ TOR!', bx, by - 34);
      }
    }

    // "Keine Daten" Overlay
    if (players.length === 0 && !ball) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kickoffDetected ? 'Warte auf Tracking-Daten...' : '← Anstoß erfassen zum Starten', W / 2, H / 2);
    }

  }, [lastTracking, recentEvents, kickoffDetected]);

  const possession = sessionState?.possession_percentage || { home: 50, away: 50 };
  const playerCount = lastTracking?.player_positions?.length || 0;
  const ballDetected = !!lastTracking?.ball_position;
  const quality = lastTracking?.detection_quality || 0;
  const formation = sessionState?.formation_home;

  return (
    <div className="space-y-2">
      {/* Pitch Canvas */}
      <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <canvas
          ref={canvasRef}
          width={700}
          height={394}
          className="w-full h-full rounded-xl"
        />
        {/* Live badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE TRACKING
        </div>
        {formation && (
          <div className="absolute top-2 right-2 bg-black/60 text-primary text-[10px] font-bold px-2 py-1 rounded-lg">
            {formation}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-2">
        {/* Possession Bar */}
        <div className="col-span-4 bg-muted/50 rounded-lg p-2">
          <div className="flex justify-between text-[10px] font-bold mb-1">
            <span className="text-green-400">Heim {possession.home?.toFixed(0) ?? 50}%</span>
            <span className="text-muted-foreground text-[9px]">Ballbesitz</span>
            <span className="text-red-400">{possession.away?.toFixed(0) ?? 50}% Gäste</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div className="bg-green-500 transition-all duration-500" style={{ width: `${possession.home ?? 50}%` }} />
            <div className="bg-red-500 transition-all duration-500" style={{ width: `${possession.away ?? 50}%` }} />
          </div>
        </div>

        <div className={`rounded-lg p-2 text-center ${playerCount > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50'}`}>
          <div className="text-base font-bold text-foreground">{playerCount}</div>
          <div className="text-[9px] text-muted-foreground">Spieler</div>
        </div>
        <div className={`rounded-lg p-2 text-center ${ballDetected ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-muted/50'}`}>
          <div className="text-base font-bold">{ballDetected ? '⚽' : '○'}</div>
          <div className="text-[9px] text-muted-foreground">Ball</div>
        </div>
        <div className="rounded-lg p-2 text-center bg-muted/50">
          <div className={`text-base font-bold ${quality >= 70 ? 'text-green-400' : quality >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
            {quality}%
          </div>
          <div className="text-[9px] text-muted-foreground">Qualität</div>
        </div>
        <div className="rounded-lg p-2 text-center bg-muted/50">
          <div className={`text-base font-bold ${kickoffDetected ? 'text-primary' : 'text-muted-foreground'}`}>
            {kickoffDetected ? '✓' : '○'}
          </div>
          <div className="text-[9px] text-muted-foreground">Kalibriert</div>
        </div>
      </div>
    </div>
  );
}