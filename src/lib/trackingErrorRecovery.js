/**
 * trackingErrorRecovery – Robuste Fallback-Strategien
 * 
 * Wenn Frame-Processing fehlschlägt:
 * 1. Versuche letzten Frame
 * 2. Interpoliere zwischen Frames
 * 3. Nutze Simulation
 */

/**
 * Interpoliere Spieler-Positionen zwischen zwei Frames
 */
export function interpolatePositions(frame1, frame2, fraction) {
  if (!frame1?.player_positions || !frame2?.player_positions) {
    return frame1?.player_positions || [];
  }

  return frame1.player_positions.map((player1, idx) => {
    const player2 = frame2.player_positions[idx];
    if (!player2) return player1;

    return {
      ...player1,
      x: Math.round(player1.x + (player2.x - player1.x) * fraction),
      y: Math.round(player1.y + (player2.y - player1.y) * fraction),
      confidence: Math.round((player1.confidence + player2.confidence) / 2),
    };
  });
}

/**
 * Validiere Frame-Qualität
 * Gib Fallback zurück wenn zu viele Fehler
 */
export function validateFrameQuality(tracking) {
  if (!tracking) return { valid: false, issues: ['No tracking data'] };

  const issues = [];

  if (!tracking.player_positions || tracking.player_positions.length < 4) {
    issues.push('Too few players detected');
  }

  if (!tracking.ball_position) {
    issues.push('No ball detected');
  }

  if (tracking.detection_quality < 40) {
    issues.push('Low quality score');
  }

  // Check player position validity (sollten auf Feld sein)
  const invalidPositions = tracking.player_positions.filter(
    p => p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100
  );
  if (invalidPositions.length > tracking.player_positions.length / 2) {
    issues.push('Many invalid positions');
  }

  return {
    valid: issues.length === 0,
    issues,
    confidence: 100 - Math.min(50, issues.length * 10),
  };
}

/**
 * Smooth Player Positions um Jitter zu reduzieren
 */
export function smoothPlayerPositions(positions, prevPositions, alpha = 0.7) {
  if (!prevPositions) return positions;

  return positions.map((pos, idx) => {
    const prevPos = prevPositions[idx];
    if (!prevPos) return pos;

    return {
      ...pos,
      x: Math.round(prevPos.x * alpha + pos.x * (1 - alpha)),
      y: Math.round(prevPos.y * alpha + pos.y * (1 - alpha)),
      confidence: Math.max(pos.confidence, prevPos.confidence),
    };
  });
}

/**
 * Generiere Fallback-Simulation wenn Tracking komplett fehlschlägt
 */
export function generateSimulationFallback(prevTracking) {
  if (!prevTracking?.player_positions) {
    return null;
  }

  // Light jitter + small drift
  return {
    ball_position: prevTracking.ball_position ? {
      ...prevTracking.ball_position,
      x: prevTracking.ball_position.x + (Math.random() - 0.5) * 2,
      y: prevTracking.ball_position.y + (Math.random() - 0.5) * 2,
      confidence: Math.max(50, prevTracking.ball_position.confidence - 10),
    } : null,
    player_positions: prevTracking.player_positions.map(p => ({
      ...p,
      x: p.x + (Math.random() - 0.5) * 3,
      y: p.y + (Math.random() - 0.5) * 3,
      confidence: Math.max(40, p.confidence - 15),
    })),
    detection_quality: Math.max(30, prevTracking.detection_quality - 20),
    source: 'simulation_fallback',
  };
}

/**
 * Batch-Retry für mehrere fehlgeschlagene Frames
 */
export async function retryFailedFrames(base44, sessionId, maxRetries = 2) {
  const failedFrames = await base44.entities.TrackingData.filter({
    session_id: sessionId,
    error: { $exists: true },
  });

  const results = { retried: 0, recovered: 0, failed: 0 };

  for (const frame of failedFrames.slice(0, 10)) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await base44.functions.invoke('processFrame', {
          session_id: sessionId,
          frame_base64: frame.frame_base64,
          frame_number: frame.frame_number,
          elapsed_seconds: frame.elapsed_seconds,
          team: 'home',
        });

        if (res?.tracking_data) {
          await base44.entities.TrackingData.delete(frame.id);
          results.retried++;
          results.recovered++;
          break;
        }
      } catch (_) {
        if (attempt === maxRetries - 1) {
          results.failed++;
        }
      }
    }
  }

  return results;
}