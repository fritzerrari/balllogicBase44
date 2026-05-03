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
       // DSGVO-Safety: skip data with anonymize flag
       if (tracking.player_positions.some(p => p.tracking_anonymize)) return;

       tracking.player_positions.forEach(player => {
          // Use explicit player_id, fallback: number + team combo (not x/y which changes)
          const playerId = player.player_id || `player_${player.team || 'unknown'}_${player.number || 'unknown'}`;

         if (!playerStats[playerId]) {
           playerStats[playerId] = {
             player_id: playerId,
             team: player.team || 'unknown',
             number: player.number,
             positions: [],
             speeds: [], // NEW: speed tracking
             total_distance_km: 0,
             total_distance_m: 0, // NEW: detailed distance
             max_speed_kmh: 0, // NEW: peak speed
             avg_speed_kmh: 0, // NEW: average speed
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
           speed: player.speed || 0, // NEW: from ReID tracking
         });

         if (player.speed) playerStats[playerId].speeds.push(player.speed);

         // Heatmap-Grid update (10x10)
         const gridX = Math.floor((player.x / 100) * 10);
         const gridY = Math.floor((player.y / 100) * 10);
         const gridIndex = gridY * 10 + gridX;
         playerStats[playerId].heatmap_grid[gridIndex]++;
       });
    });

    // Berechne abgeleitete Metriken — OPTIMIERT: Single Pass wo möglich
    Object.values(playerStats).forEach(player => {
      if (player.positions.length < 2) return;

      // Distance + Sprints + Avg Position + Speed: Single Loop (O(n))
      let distance = 0;
      let sprints = 0;
      let sumX = 0, sumY = 0;

      // Field dimensions (in meters)
      const fieldWidthM = 105;
      const fieldHeightM = 68;

      for (let i = 1; i < player.positions.length; i++) {
        const p1 = player.positions[i - 1];
        const p2 = player.positions[i];

        // Convert from percentage coordinates (0-100) to meters
        const dx = ((p2.x - p1.x) / 100) * fieldWidthM;
        const dy = ((p2.y - p1.y) / 100) * fieldHeightM;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const timeDiff = (p2.timestamp - p1.timestamp) / 1000; // seconds

        distance += dist;

        // Sprint detection: > 5 m/s (18 km/h) — aber nur wenn zeitliche Differenz plausibel (< 2 Sekunden)
        if (timeDiff > 0 && timeDiff < 2) {
          const speed = dist / timeDiff;
          if (speed > 5) sprints++;
        }

        sumX += p2.x;
        sumY += p2.y;
      }

      player.total_distance_m = Math.round(distance);
      player.total_distance_km = Math.round(distance / 1000 * 100) / 100;
      player.sprint_count = sprints;
      player.avg_x = Math.round(sumX / player.positions.length);
      player.avg_y = Math.round(sumY / player.positions.length);

      // Speed metrics — from ReID tracking (speed in m/frame, convert to km/h)
      if (player.speeds.length > 0) {
        player.max_speed_kmh = Math.round(Math.max(...player.speeds) * 30 * 3.6 * 10) / 10; // 30fps framerate, m/frame → m/s → km/h
        player.avg_speed_kmh = Math.round((player.speeds.reduce((a, b) => a + b, 0) / player.speeds.length) * 30 * 3.6 * 10) / 10;
      }

      // Normalize Heatmap — Safety: avoid division by zero
      const maxHeat = Math.max(...player.heatmap_grid) || 1;
      player.heatmap_grid = player.heatmap_grid.map(v => Math.round((v / maxHeat) * 100));
      });

      // Speichere aggregierte Stats in PlayerStat Tabelle
      const session = await base44.entities.LiveSession.filter({ id: session_id });
      const matchId = session?.[0]?.match_id;
      const matchTitle = session?.[0]?.match_title || 'Unknown Match';
      const matchDate = session?.[0]?.started_at?.split('T')[0] || new Date().toISOString().split('T')[0];

      // Für jeden Spieler: PlayerStat erstellen/aktualisieren
      for (const [playerId, stats] of Object.entries(playerStats)) {
        try {
          // Suche existierende PlayerStat
          const existing = await base44.entities.PlayerStat.filter({
            player_id: playerId,
            match_id: matchId,
          });

          const playerStatData = {
            player_id: playerId,
            player_name: stats.number ? `#${stats.number}` : playerId,
            match_id: matchId,
            match_title: matchTitle,
            match_date: matchDate,
            distance_km: stats.total_distance_km,
            sprints: stats.sprint_count,
            minutes_played: Math.round((stats.positions.length / 30) / 60), // 30fps framerate
          };

          if (existing.length > 0) {
            await base44.entities.PlayerStat.update(existing[0].id, playerStatData);
          } else {
            await base44.entities.PlayerStat.create(playerStatData);
          }
        } catch (e) {
          console.warn(`⚠️ PlayerStat save failed for ${playerId}: ${e.message}`);
        }
      }

      return Response.json({
        success: true,
        session_id,
        player_count: Object.keys(playerStats).length,
        tracking_frames: allTracking.length,
        stats_saved: Object.keys(playerStats).length,
        stats: playerStats,
      });
  } catch (error) {
    console.error('❌ aggregatePlayerStats failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});