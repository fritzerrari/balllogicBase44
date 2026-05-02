/**
 * generateHeatmap — Erstellt Heatmaps aus accumulierten TrackingData
 * 
 * Input: Session-ID + Team + Period
 * Output: HeatmapCache mit 10x10 Grid
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GRID_SIZE = 10; // 10x10
const GAUSSIAN_RADIUS = 1.5; // Blur-Effekt

/**
 * Erstellt leeren Grid
 */
function createEmptyGrid() {
  const grid = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      grid.push({ x, y, intensity: 0 });
    }
  }
  return grid;
}

/**
 * Gaussian Blur auf Grid anwenden (optimiert — nur lokale Nachbarn)
 */
function applyGaussianBlur(grid) {
   const blurred = grid.map(cell => ({ ...cell }));
   const gridMap = Object.fromEntries(grid.map(c => [`${c.x}_${c.y}`, c]));

   for (let cell of grid) {
     let sum = 0;
     let weightSum = 0;

     // Nur nahe Nachbarn (radius 2)
     for (let dx = -2; dx <= 2; dx++) {
       for (let dy = -2; dy <= 2; dy++) {
         const nx = cell.x + dx;
         const ny = cell.y + dy;
         if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;

         const other = gridMap[`${nx}_${ny}`];
         if (!other) continue;

         const distance = Math.sqrt(dx * dx + dy * dy);
         const weight = Math.exp(-(distance * distance) / (2 * GAUSSIAN_RADIUS * GAUSSIAN_RADIUS));

         sum += other.intensity * weight;
         weightSum += weight;
       }
     }

     const blurredCell = blurred.find(c => c.x === cell.x && c.y === cell.y);
     if (blurredCell) {
       blurredCell.intensity = weightSum > 0 ? Math.round(sum / weightSum) : 0;
     }
   }

   return blurred;
}

/**
 * Normalisiert Intensitäten auf 0-100
 */
function normalizeIntensities(grid) {
  const max = Math.max(...grid.map(c => c.intensity), 1);
  return grid.map(cell => ({
    ...cell,
    intensity: Math.round((cell.intensity / max) * 100),
  }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { session_id, team, heatmap_type = 'player_density', period = 'full_match' } = body;

    if (!session_id || !team) {
      return Response.json({ error: 'Missing session_id or team' }, { status: 400 });
    }

    // 1. LOAD TRACKING DATA
    const trackingDataList = await base44.entities.TrackingData.filter({
      session_id,
    });

    if (trackingDataList.length === 0) {
      return Response.json({ error: 'No tracking data found' }, { status: 404 });
    }

    // 2. FILTER BY PERIOD
    let filtered = trackingDataList;
    if (period === 'half_1') {
      filtered = filtered.filter(t => t.elapsed_seconds < 45 * 60);
    } else if (period === 'half_2') {
      filtered = filtered.filter(t => t.elapsed_seconds >= 45 * 60);
    }

    // 3. BUILD GRID BASED ON TYPE
    let grid = createEmptyGrid();

    // Build grid map for O(1) lookup (not O(n) per access)
    const gridMap = Object.fromEntries(grid.map(c => [`${c.x}_${c.y}`, c]));

    if (heatmap_type === 'player_density') {
      // Akkumuliere Player-Positionen — FILTER BY TEAM
      for (const tracking of filtered) {
        for (const player of tracking.player_positions || []) {
          // DSGVO: skip anonymized players
          if (player.tracking_anonymize || player.team !== team) continue;

          const gridX = Math.floor((player.x / 100) * GRID_SIZE);
          const gridY = Math.floor((player.y / 100) * GRID_SIZE);
          const cell = gridMap[`${gridX}_${gridY}`];
          if (cell) {
            cell.intensity += player.confidence / 100;
          }
        }
      }
    } else if (heatmap_type === 'ball_possession') {
      // Ball-Kontakt-Bereich
      for (const tracking of filtered) {
        if (tracking.ball_position && tracking.ball_position.confidence > 60) {
          const gridX = Math.floor((tracking.ball_position.x / 100) * GRID_SIZE);
          const gridY = Math.floor((tracking.ball_position.y / 100) * GRID_SIZE);
          const cell = gridMap[`${gridX}_${gridY}`];
          if (cell) {
            cell.intensity += tracking.ball_position.confidence / 100;
          }
        }
      }
    }

     // 4. APPLY GAUSSIAN BLUR
     grid = applyGaussianBlur(grid);

     // 5. NORMALIZE
     grid = normalizeIntensities(grid);

     // 6. QUALITY SCORE (safety: avoid division by zero)
     const avgQuality = filtered.length > 0
       ? Math.round(filtered.reduce((sum, t) => sum + (t.detection_quality || 0), 0) / filtered.length)
       : 0;

    // 7. SAVE HEATMAP CACHE
    const heatmap = await base44.entities.HeatmapCache.create({
      session_id,
      match_id: filtered[0]?.match_id,
      team,
      heatmap_type,
      grid_data: grid,
      period,
      generated_at: new Date().toISOString(),
      total_frames_processed: filtered.length,
      quality_score: avgQuality,
    });

    return Response.json({
      success: true,
      heatmap,
      grid_preview: grid.filter(c => c.intensity > 10).slice(0, 10),
    });
  } catch (error) {
    console.error('❌ generateHeatmap failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});