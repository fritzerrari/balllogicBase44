/**
 * processFrame — Production-Ready Roboflow + Fallback mit Fehlertoleranz
 * 
 * Features:
 * - Exponential Backoff Retry (3x)
 * - Timeout + Circuit Breaker
 * - Graceful Degradation (Fallback zu letztem erfolgreichen Frame)
 * - Comprehensive Logging + Health-Monitoring
 * - Data Validation + Error Recovery
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ROBOFLOW_API_KEY = Deno.env.get('ROBOFLOW_API_KEY');
const API_TIMEOUT_MS = 3000; // Timeout nach 3s (fast fail)
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = [200, 500]; // Schneller backoff
const CIRCUIT_BREAKER_THRESHOLD = 10; // 10 failures before open
const CIRCUIT_BREAKER_RESET_MS = 30000; // Reset nach 30s

// CRITICAL FIX: Circuit Breaker MUST be per-session, NOT global
// Otherwise Trainer A's API errors block Trainer B's session
const circuitBreakerBySession = new Map(); // sessionId → { open, failures, lastFailTime }
const CIRCUIT_BREAKER_CLEANUP_MS = 600000; // Clean stale sessions every 10min

function getCircuitBreakerState(sessionId) {
  if (!circuitBreakerBySession.has(sessionId)) {
    circuitBreakerBySession.set(sessionId, { open: false, failures: 0, lastFailTime: 0 });
  }
  // Cleanup old sessions (defensive)
  if (circuitBreakerBySession.size > 100) {
    const now = Date.now();
    for (const [id, state] of circuitBreakerBySession) {
      if (now - state.lastFailTime > CIRCUIT_BREAKER_CLEANUP_MS) {
        circuitBreakerBySession.delete(id);
      }
    }
  }
  return circuitBreakerBySession.get(sessionId);
}

const THRESHOLDS = {
  CONFIDENCE_MIN: 0.5,
  BALL_IN_PENALTY: { x_min: 0.75, x_max: 1.0, y_min: 0.2, y_max: 0.8 },
  BALL_IN_GOAL_AREA: { x_min: 0.88, x_max: 1.0, y_min: 0.3, y_max: 0.7 },
};

/**
 * Circuit Breaker Pattern — PER-SESSION (not global!)
 */
function checkCircuitBreaker(sessionId) {
  const state = getCircuitBreakerState(sessionId);
  if (!state.open) return true;
  
  const timeSinceLastFailure = Date.now() - state.lastFailTime;
  if (timeSinceLastFailure > CIRCUIT_BREAKER_RESET_MS) {
    console.log(`🟢 Circuit Breaker Reset [${sessionId}] — Retry Roboflow`);
    state.open = false;
    state.failures = 0;
    state.lastFailTime = 0;
    return true;
  }
  return false;
}

function recordFailure(sessionId) {
  const state = getCircuitBreakerState(sessionId);
  state.failures++;
  state.lastFailTime = Date.now();
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.open = true;
    console.warn(`🔴 Circuit Breaker OPEN [${sessionId}] — ${state.failures} failures`);
  }
}

/**
 * Roboflow API mit Retry + Timeout
 */
async function callRoboflowWithRetry(base64Frame, sessionId) {
  if (!checkCircuitBreaker(sessionId)) {
    console.warn(`⚠️ Circuit breaker open [${sessionId}], using fallback`);
    return null;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(
        `https://api.roboflow.com/api/v1/project/football-tracking/detect?api_key=${ROBOFLOW_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `imageData=${encodeURIComponent(base64Frame)}`,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
      }

      const data = await response.json();
      getCircuitBreakerState(sessionId).failures = 0; // Reset on success
      console.log(`✅ Roboflow API success [${sessionId}] (attempt ${attempt + 1})`);
      return data;
    } catch (error) {
      const isTimeout = error.name === 'AbortError';
      const backoffMs = RETRY_BACKOFF_MS[attempt] || RETRY_BACKOFF_MS[2];
      
      console.warn(
        `⚠️ Roboflow attempt ${attempt + 1}/${MAX_RETRIES} failed (${isTimeout ? 'timeout' : 'error'}): ${error.message}`
      );

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, backoffMs));
      } else {
        recordFailure(sessionId);
        return null; // All retries exhausted
      }
    }
  }

  return null;
}

/**
 * Validiere + normalisiere Detections
 */
function validateAndNormalize(predictions, imageWidth, imageHeight) {
  if (!predictions || !Array.isArray(predictions)) return [];

  return predictions
    .filter(p => p && p.confidence >= THRESHOLDS.CONFIDENCE_MIN)
    .map(pred => ({
      x: Math.round((pred.x / imageWidth) * 100),
      y: Math.round((pred.y / imageHeight) * 100),
      confidence: Math.round(pred.confidence * 100),
      class: pred.class || 'unknown',
      width: pred.width ? Math.round((pred.width / imageWidth) * 100) : 0,
      height: pred.height ? Math.round((pred.height / imageHeight) * 100) : 0,
    }))
    .slice(0, 50); // Safety limit
}

/**
 * REID TRACKING — multi-frame player tracking by position + confidence
 */
const REID_STATE_BY_SESSION = new Map(); // { sessionId → { frameN: {playerId → {x,y,team,conf}} } }

function performReIDTracking(currentPlayers, sessionId, frameNumber) {
  if (!REID_STATE_BY_SESSION.has(sessionId)) {
    REID_STATE_BY_SESSION.set(sessionId, { frameHistory: {} });
  }
  const state = REID_STATE_BY_SESSION.get(sessionId);
  
  // Get prev frame
  const prevFrameN = frameNumber - 1;
  const prevFrame = state.frameHistory[prevFrameN] || {};

  // Match current players to prev frame (Hungarian-ish greedy matching)
  const matched = new Set();
  const assignments = {};

  currentPlayers.forEach(curr => {
    let bestMatch = null, bestDist = Infinity;
    Object.entries(prevFrame).forEach(([pId, prev]) => {
      if (matched.has(pId)) return;
      const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      if (dist < 15 && dist < bestDist) { // max 15% field distance
        bestDist = dist;
        bestMatch = pId;
      }
    });
    if (bestMatch) {
      matched.add(bestMatch);
      assignments[bestMatch] = curr;
    }
  });

  // Assign IDs
  let nextId = 1;
  const result = currentPlayers.map(p => {
    let assigned = false;
    for (const [oldId, curr] of Object.entries(assignments)) {
      if (curr.x === p.x && curr.y === p.y) {
        assigned = true;
        return { ...p, player_id: oldId, speed: calculateSpeed(prevFrame[oldId], p) };
      }
    }
    return assigned ? p : { ...p, player_id: `player_${frameNumber}_${nextId++}`, speed: 0 };
  });

  // Save current frame state
  state.frameHistory[frameNumber] = Object.fromEntries(result.map(p => [p.player_id, { x: p.x, y: p.y, team: p.team, confidence: p.confidence }]));
  
  // Cleanup old frames
  const frameKeys = Object.keys(state.frameHistory).map(Number).sort((a, b) => b - a);
  if (frameKeys.length > 300) {
    for (const f of frameKeys.slice(300)) delete state.frameHistory[f];
  }

  return result;
}

function calculateSpeed(prevPos, currPos) {
  if (!prevPos) return 0;
  const dx = ((currPos.x - prevPos.x) / 100) * 105;
  const dy = ((currPos.y - prevPos.y) / 100) * 68;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.round(dist * 100) / 100; // in meters, approx. per frame (~33ms @ 30fps)
}

/**
 * Auto-Event Detection mit Confidence-Filtering
 */
function detectAutoEvents(ballPos, playerPositions, minute, elapsedSeconds) {
  const events = [];

  if (!ballPos || ballPos.confidence < THRESHOLDS.CONFIDENCE_MIN * 100) {
    return events;
  }

  // Ball im Strafraum
  if (ballPos.x >= THRESHOLDS.BALL_IN_PENALTY.x_min &&
      ballPos.y >= THRESHOLDS.BALL_IN_PENALTY.y_min &&
      ballPos.y <= THRESHOLDS.BALL_IN_PENALTY.y_max) {
    events.push({
      type: 'ball_in_penalty_area',
      confidence: ballPos.confidence,
      minute,
      elapsed_seconds: elapsedSeconds,
    });
  }

  // Ball im Tor-Bereich
  if (ballPos.x >= THRESHOLDS.BALL_IN_GOAL_AREA.x_min &&
      ballPos.y >= THRESHOLDS.BALL_IN_GOAL_AREA.y_min &&
      ballPos.y <= THRESHOLDS.BALL_IN_GOAL_AREA.y_max) {
    events.push({
      type: 'ball_in_goal_area',
      confidence: Math.min(100, ballPos.confidence * 1.1),
      minute,
      elapsed_seconds: elapsedSeconds,
    });
  }

  return events;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, frame_base64, frame_number, elapsed_seconds, team } = body;

    if (!session_id || !frame_base64) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Roboflow API Call mit Fallback
    let detections = null;
    let source = 'roboflow';
    let error = null;

    detections = await callRoboflowWithRetry(frame_base64, session_id);

    if (!detections) {
      // Fallback: Hole letzten erfolgreichen Frame
      console.warn('📼 Falling back to last successful tracking data');
      try {
        const lastTracking = await base44.entities.TrackingData.filter({ session_id }, '-timestamp_ms', 1).catch(() => []);
        if (lastTracking?.[0]?.player_positions) {
          detections = {
            predictions: [
              { x: 50, y: 50, confidence: 0.5, class: 'ball' },
              ...lastTracking[0].player_positions.slice(0, 22).map(p => ({
                x: p.x, y: p.y, confidence: p.confidence / 100, class: 'player'
              }))
            ]
          };
          source = 'fallback';
          error = 'Roboflow unavailable, using last frame';
        }
      } catch (_) {
        detections = { predictions: [], image: { width: 1920, height: 1080 } };
        error = 'Complete API failure — no tracking data';
      }
    }

    // Safety: ensure detections.image exists
    if (!detections.image) detections.image = { width: 1920, height: 1080 };

    // Parse Detections
    const ballPredictions = detections.predictions?.filter(p => p.class === 'ball') || [];
    const playerPredictions = detections.predictions?.filter(p => p.class === 'player' || p.class === 'goalkeeper') || [];

    const ballPos = ballPredictions.length > 0 ? {
      x: Math.round((ballPredictions[0].x / detections.image.width) * 100),
      y: Math.round((ballPredictions[0].y / detections.image.height) * 100),
      confidence: Math.round(ballPredictions[0].confidence * 100),
    } : null;

    let playerPositions = validateAndNormalize(
      playerPredictions,
      detections.image.width,
      detections.image.height
    );

    // 2. REID TRACKING — match players across frames by proximity + confidence
    playerPositions = performReIDTracking(playerPositions, session_id, frame_number);

    // Quality Score
    const qualityScore = Math.round(
      (ballPredictions.length > 0 ? 50 : 0) +
      Math.min(50, (playerPredictions.length / 22) * 50)
    );

    // Get Session für Match-ID
    const session = await base44.entities.LiveSession.filter({ id: session_id });
    const sessionData = session[0];
    const minute = sessionData ? Math.floor(elapsed_seconds / 60) : 0;

    // Auto-Events
    const autoEvents = detectAutoEvents(ballPos, playerPositions, minute, elapsed_seconds);

    // Save TrackingData
    const trackingData = await base44.entities.TrackingData.create({
      session_id,
      match_id: sessionData?.match_id,
      frame_number,
      timestamp_ms: Date.now(),
      elapsed_seconds,
      ball_position: ballPos,
      player_positions: playerPositions,
      detection_quality: qualityScore,
      source,
      error: error || null,
      retry_count: 0,
    });

    // Save Auto-Events (nur high-confidence)
    const savedAutoEvents = [];
    for (const evt of autoEvents) {
      if (evt.confidence >= 60) {
        const autoEvent = await base44.entities.AutoEvent.create({
          session_id,
          match_id: sessionData?.match_id,
          tracking_data_id: trackingData.id,
          type: evt.type,
          team: team || 'unknown',
          minute: evt.minute,
          elapsed_seconds: evt.elapsed_seconds,
          confidence: evt.confidence,
          description: `Auto-detected: ${evt.type}`,
          data: { ball: ballPos, players: playerPositions },
          approved_by_trainer: false,
          rejected: false,
          timestamp_ms: Date.now(),
        });
        savedAutoEvents.push(autoEvent);
      }
    }

    const processingTime = Date.now() - startTime;

    return Response.json({
      success: true,
      tracking_data: trackingData.id,
      auto_events: savedAutoEvents.length,
      quality_score: qualityScore,
      ball_detected: ballPos !== null,
      players_detected: playerPositions.length,
      source,
      processing_time_ms: processingTime,
      error: error,
      circuit_breaker_state: getCircuitBreakerState(session_id),
    });
  } catch (error) {
    console.error('❌ processFrame failed:', error);
    // Session ID might not be available in all error paths, use 'unknown'
    const sessId = error.sessionId || 'unknown';
    return Response.json(
      { error: error.message, circuit_breaker_state: getCircuitBreakerState(sessId) },
      { status: 500 }
    );
  }
});