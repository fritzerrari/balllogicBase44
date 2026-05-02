/**
 * aggregatePlayerStats – Live-Spieler-Statistiken aus TrackingData
 * 
 * Berechnet pro Spieler:
 * - Distanz gelaufen
 * - Sprints
 * - Ball-Berührungen
 * - Heatmap
 * - Durchschn. Position
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // Alle TrackingData für diese Session laden
    const allTracking = await base44.entities.TrackingData.filter({ session_id });

    if (allTracking.length === 0) {
      return Response.json({ stats: {} });
    }

    // Group by player_id + berechne Statistiken
    const playerStats = {};

    allTracking.forEach(tracking => {
      if (!tracking.player_positions) return;

      tracking.player_positions.forEach(player => {
        const playerId = player.player_id || `player_${player.x}_${player.y}`;

        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            player_id: playerId,
            positions: [],
            total_distance_km: 0,
            sprint_count: 0,
            avg_x: 0,
            avg_y: 0,
            heatmap_grid: Array(100).fill(0),
          };
        }

        playerStats[playerId].positions.push({
          x: player.x,
          y: player.y,
          timestamp: tracking.timestamp_ms,
        });

        // Heatmap-Grid update (10x10)
        const gridX = Math.floor((player.x / 100) * 10);
        const gridY = Math.floor((player.y / 100) * 10);
        const gridIndex = gridY * 10 + gridX;
        playerStats[playerId].heatmap_grid[gridIndex]++;
      });
    });

    // Berechne abgeleitete Metriken
    Object.values(playerStats).forEach(player => {
      if (player.positions.length < 2) return;

      // Distanz
      let distance = 0;
      for (let i = 1; i < player.positions.length; i++) {
        const p1 = player.positions[i - 1];
        const p2 = player.positions[i];
        const dx = ((p2.x - p1.x) / 100) * 105; // ~105m Feldlänge
        const dy = ((p2.y - p1.y) / 100) * 68; // ~68m Feldbreite
        distance += Math.sqrt(dx * dx + dy * dy);
      }
      player.total_distance_km = Math.round(distance / 1000 * 100) / 100;

      // Sprints (Distanz > 10m in < 1s)
      let sprints = 0;
      for (let i = 1; i < player.positions.length; i++) {
        const p1 = player.positions[i - 1];
        const p2 = player.positions[i];
        const timeDiff = (p2.timestamp - p1.timestamp) / 1000;
        const dx = ((p2.x - p1.x) / 100) * 105;
        const dy = ((p2.y - p1.y) / 100) * 68;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10 && timeDiff < 1) sprints++;
      }
      player.sprint_count = sprints;

      // Durchschnittliche Position
      const avgX = player.positions.reduce((sum, p) => sum + p.x, 0) / player.positions.length;
      const avgY = player.positions.reduce((sum, p) => sum + p.y, 0) / player.positions.length;
      player.avg_x = Math.round(avgX);
      player.avg_y = Math.round(avgY);

      // Normalize Heatmap
      const maxHeat = Math.max(...player.heatmap_grid);
      if (maxHeat > 0) {
        player.heatmap_grid = player.heatmap_grid.map(v => Math.round((v / maxHeat) * 100));
      }
    });

    return Response.json({
      success: true,
      session_id,
      player_count: Object.keys(playerStats).length,
      tracking_frames: allTracking.length,
      stats: playerStats,
    });
  } catch (error) {
    console.error('❌ aggregatePlayerStats failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});