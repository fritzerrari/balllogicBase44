/**
 * CoverageBlindspotMap — Dynamische Platzabdeckungs-Analyse
 * 
 * Zeigt in Echtzeit:
 * - Welche Feldzonen von Kameras abgedeckt werden (grün)
 * - Blinde Flecken (rot/orange) = Bereiche mit wenig/keiner Detection
 * - Kamera-Status (online/offline/ausgefallen)
 * - Coverage % pro Zone
 * 
 * Basis: Echte TrackingData-Positionen der letzten N Frames
 */
import { useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

// Spielfeld in 10x6 Zonen aufteilen (60 Zellen)
const GRID_COLS = 10;
const GRID_ROWS = 6;

function drawPitchLines(ctx, W, H) {
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  // Außenlinie
  ctx.strokeRect(10, 8, W - 20, H - 16);
  // Mittellinie
  ctx.beginPath(); ctx.moveTo(W / 2, 8); ctx.lineTo(W / 2, H - 8); ctx.stroke();
  // Strafräume
  ctx.strokeRect(10, H / 2 - 55, 75, 110);
  ctx.strokeRect(W - 85, H / 2 - 55, 75, 110);
  // Tore
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(2, H / 2 - 18, 8, 36);
  ctx.strokeRect(W - 10, H / 2 - 18, 8, 36);
}

function buildCoverageGrid(playerPositions) {
  // Zähle Detections pro Grid-Zelle
  const grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(0));

  playerPositions.forEach(p => {
    const col = Math.min(GRID_COLS - 1, Math.floor((p.x / 100) * GRID_COLS));
    const row = Math.min(GRID_ROWS - 1, Math.floor((p.y / 100) * GRID_ROWS));
    if (col >= 0 && row >= 0) grid[row][col]++;
  });

  return grid;
}

const CAMERA_COLORS = [
  { fill: 'rgba(74,222,128,0.18)', border: 'rgba(74,222,128,0.7)', label: '#4ade80' },
  { fill: 'rgba(96,165,250,0.18)', border: 'rgba(96,165,250,0.7)', label: '#60a5fa' },
  { fill: 'rgba(251,146,60,0.18)', border: 'rgba(251,146,60,0.7)', label: '#fb923c' },
  { fill: 'rgba(196,181,253,0.18)', border: 'rgba(196,181,253,0.7)', label: '#c4b5fd' },
];

export default function CoverageBlindspotMap({ session }) {
  const canvasRef = useRef(null);
  const cameras = session?.camera_streams || [];

  // Lade letzte 30 Frames Tracking-Daten für Coverage-Analyse
  const { data: recentTracking = [] } = useQuery({
    queryKey: ['coverage-tracking', session?.id],
    queryFn: () => base44.entities.TrackingData.filter(
      { session_id: session.id }, '-timestamp_ms', 30
    ),
    refetchInterval: 5000,
    enabled: !!session?.id,
  });

  // Kamera-Status berechnen
  const cameraStatuses = useMemo(() => cameras.map(cam => {
    const lastSeenMs = cam.last_seen ? Date.now() - new Date(cam.last_seen).getTime() : null;
    const online = lastSeenMs !== null && lastSeenMs < 15000;
    const stale = lastSeenMs !== null && lastSeenMs >= 15000 && lastSeenMs < 60000;
    return { ...cam, online, stale, offline: !online && !stale };
  }), [cameras]);

  // Coverage-Grid aus echten Tracking-Daten berechnen
  const coverageGrid = useMemo(() => {
    if (recentTracking.length === 0) return null;
    const allPositions = recentTracking.flatMap(t => t.player_positions || []);
    if (allPositions.length === 0) return null;
    return buildCoverageGrid(allPositions);
  }, [recentTracking]);

  // Coverage-Statistik
  const coverageStats = useMemo(() => {
    if (!coverageGrid) return { covered: 0, total: GRID_COLS * GRID_ROWS, pct: 0, blindspots: [] };
    const blindspots = [];
    let covered = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (coverageGrid[r][c] > 0) covered++;
        else blindspots.push({ r, c });
      }
    }
    return {
      covered,
      total: GRID_COLS * GRID_ROWS,
      pct: Math.round((covered / (GRID_COLS * GRID_ROWS)) * 100),
      blindspots,
    };
  }, [coverageGrid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Rasen-Hintergrund
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1f0a');
    bg.addColorStop(1, '#0d2d0d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Streifen
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.015)';
        ctx.fillRect(i * (W / 8), 0, W / 8, H);
      }
    }

    // ── COVERAGE HEATMAP ──────────────────────────────────────────────────
    const cellW = W / GRID_COLS;
    const cellH = H / GRID_ROWS;

    if (coverageGrid) {
      // Maximale Detections für Normalisierung
      const maxDet = Math.max(1, ...coverageGrid.flat());

      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const count = coverageGrid[r][c];
          const intensity = count / maxDet;

          if (count === 0) {
            // Blindfleck — rot mit Diagonal-Muster
            ctx.fillStyle = 'rgba(239,68,68,0.22)';
            ctx.fillRect(c * cellW, r * cellH, cellW, cellH);

            // Schraffur
            ctx.strokeStyle = 'rgba(239,68,68,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(c * cellW, r * cellH + cellH * 0.5);
            ctx.lineTo(c * cellW + cellW * 0.5, r * cellH);
            ctx.moveTo(c * cellW, r * cellH + cellH);
            ctx.lineTo(c * cellW + cellW, r * cellH);
            ctx.moveTo(c * cellW + cellW * 0.5, r * cellH + cellH);
            ctx.lineTo(c * cellW + cellW, r * cellH + cellH * 0.5);
            ctx.stroke();
          } else if (intensity < 0.2) {
            // Wenig abgedeckt — orange
            ctx.fillStyle = `rgba(251,146,60,${0.1 + intensity * 0.3})`;
            ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
          } else {
            // Gut abgedeckt — grün
            ctx.fillStyle = `rgba(74,222,128,${0.08 + intensity * 0.25})`;
            ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
          }
        }
      }
    } else {
      // Noch keine Daten — alles grau
      ctx.fillStyle = 'rgba(100,100,100,0.15)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Warte auf Tracking-Daten...', W / 2, H / 2);
    }

    // Grid-Linien
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let c = 1; c < GRID_COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * cellW, 0); ctx.lineTo(c * cellW, H); ctx.stroke();
    }
    for (let r = 1; r < GRID_ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cellH); ctx.lineTo(W, r * cellH); ctx.stroke();
    }

    // ── KAMERA-ABDECKUNGS-POLYGONE ────────────────────────────────────────
    cameras.forEach((cam, idx) => {
      if (!cam.coverage_polygon || cam.coverage_polygon.length < 3) return;
      const lastSeenMs = cam.last_seen ? Date.now() - new Date(cam.last_seen).getTime() : null;
      const isOnline = lastSeenMs !== null && lastSeenMs < 15000;
      const color = CAMERA_COLORS[idx % CAMERA_COLORS.length];
      const alpha = isOnline ? 1 : 0.3;

      const pts = cam.coverage_polygon.map(p => ({ x: (p.x / 100) * W, y: (p.y / 100) * H }));

      ctx.fillStyle = isOnline ? color.fill : 'rgba(100,100,100,0.08)';
      ctx.strokeStyle = isOnline ? color.border : 'rgba(150,150,150,0.3)';
      ctx.lineWidth = isOnline ? 2 : 1;
      ctx.setLineDash(isOnline ? [] : [5, 4]);
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Kamera-Position Marker
      if (cam.position_x !== undefined && cam.position_y !== undefined) {
        const cx = (cam.position_x / 100) * W;
        const cy = (cam.position_y / 100) * H;
        ctx.fillStyle = isOnline ? color.label : 'rgba(150,150,150,0.6)';
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.stroke();
        // Label
        ctx.fillStyle = isOnline ? color.label : 'rgba(150,150,150,0.7)';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(cam.label || `Cam ${idx + 1}`, cx, cy - 8);
      }
    });

    // ── SPIELFELDLINIEN (oben drüber) ─────────────────────────────────────
    drawPitchLines(ctx, W, H);

    // ── COVERAGE % LABEL ──────────────────────────────────────────────────
    if (coverageGrid) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.roundRect(W - 86, 6, 80, 22, 4);
      ctx.fill();
      const pct = coverageStats.pct;
      ctx.fillStyle = pct >= 70 ? '#4ade80' : pct >= 40 ? '#fb923c' : '#f87171';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Abdeckung ${pct}%`, W - 46, 17);
    }

  }, [coverageGrid, cameras, coverageStats]);

  const onlineCams = cameraStatuses.filter(c => c.online).length;
  const staleCams = cameraStatuses.filter(c => c.stale).length;
  const offlineCams = cameraStatuses.filter(c => c.offline).length;

  return (
    <div className="space-y-3">
      {/* Kamera-Status-Leiste */}
      <div className="flex items-center gap-2 flex-wrap">
        {cameraStatuses.map((cam, idx) => {
          const color = CAMERA_COLORS[idx % CAMERA_COLORS.length];
          return (
            <div key={cam.camera_id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                cam.online ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : cam.stale ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
              {cam.online ? <Wifi className="w-3 h-3" /> : cam.stale ? <AlertTriangle className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {cam.label || `Kamera ${idx + 1}`}
              <span className="opacity-60">{cam.online ? 'LIVE' : cam.stale ? 'SCHWACH' : 'AUS'}</span>
            </div>
          );
        })}
        {offlineCams > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertTriangle className="w-3 h-3" /> Redundanz-Fallback aktiv
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <canvas ref={canvasRef} width={700} height={394} className="w-full h-full rounded-xl" />
      </div>

      {/* Legende + Statistik */}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg p-2">
          <div className="w-3 h-3 rounded-sm bg-green-500/40 border border-green-500/60 flex-shrink-0" />
          <span className="text-green-400 font-medium">Abgedeckt ({coverageStats.pct}%)</span>
        </div>
        <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
          <div className="w-3 h-3 rounded-sm bg-orange-500/30 border border-orange-500/50 flex-shrink-0" />
          <span className="text-orange-400 font-medium">Wenig Daten</span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          <div className="w-3 h-3 rounded-sm bg-red-500/25 border border-red-500/40 flex-shrink-0" />
          <span className="text-red-400 font-medium">Blindfleck ({GRID_COLS * GRID_ROWS - coverageStats.covered} Zonen)</span>
        </div>
      </div>

      {/* Blindfleck-Warnung */}
      {coverageStats.pct < 60 && coverageStats.covered > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5 text-[11px] text-orange-400 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Nur <strong>{coverageStats.pct}%</strong> des Feldes erfasst.
            {offlineCams > 0 && ` ${offlineCams} Kamera(s) ausgefallen.`}
            {' '}Bewege Kameras oder aktiviere fehlende Streams.
          </span>
        </div>
      )}
    </div>
  );
}