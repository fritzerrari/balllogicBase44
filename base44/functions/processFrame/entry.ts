/**
 * processFrame — Robuste Frame-Processing mit Roboflow DETR
 * 
 * Input: Base64 Frame + Session-Kontext
 * Output: TrackingData + Auto-Events erkannt
 * 
 * Fehlerbehandlung: Retry-Logic, Fallback, Logging
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ROBOFLOW_API_KEY = Deno.env.get('ROBOFLOW_API_KEY');
const ROBOFLOW_PROJECT = 'football-tracking'; // anpassbar
const ROBOFLOW_VERSION = 1; // Model-Version
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Threshold für Event-Erkennung
const THRESHOLDS = {
  BALL_IN_PENALTY: { x_min: 0.75, x_max: 1.0, y_min: 0.2, y_max: 0.8 },
  BALL_IN_GOAL_AREA: { x_min: 0.88, x_max: 1.0, y_min: 0.3, y_max: 0.7 },
  OFFSIDE_TOLERANCE: 0.05,
  CONFIDENCE_MIN: 0.6,
};

/**
 * Ruft Roboflow DETR API mit Retry-Logic auf
 */
async function callRoboflowAPI(base64Frame, retryCount = 0) {
  try {
    const response = await fetch(
      `https://api.roboflow.com/api/v1/project/${ROBOFLOW_PROJECT}/detect?api_key=${ROBOFLOW_API_KEY}&version=${ROBOFLOW_VERSION}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `imageData=${encodeURIComponent(base64Frame)}`,
      }
    );

    if (!response.ok) {
      throw new Error(`Roboflow API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`Roboflow retry ${retryCount + 1}/${MAX_RETRIES}: ${error.message}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (retryCount + 1)));
      return callRoboflowAPI(base64Frame, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Normalisiert Predictions zu 0-100 Koordinaten
 */
function normalizePositions(predictions, imageWidth, imageHeight) {
  return predictions.map(pred => ({
    x: Math.round((pred.x / imageWidth) * 100),
    y: Math.round((pred.y / imageHeight) * 100),
    width: Math.round((pred.width / imageWidth) * 100),
    height: Math.round((pred.height / imageHeight) * 100),
    confidence: Math.round(pred.confidence * 100),
    class: pred.class,
  }));
}

/**
 * Erkennt Auto-Events basierend auf Ball + Player-Positionen
 */
function detectAutoEvents(ballPos, playerPositions, minute, elapsedSeconds, team) {
  const events = [];

  if (!ballPos || ballPos.confidence < THRESHOLDS.CONFIDENCE_MIN) {
    return events;
  }

  // Ball im Strafraum (Gefahr)?
  if (ballPos.x >= THRESHOLDS.BALL_IN_PENALTY.x_min &&
      ballPos.y >= THRESHOLDS.BALL_IN_PENALTY.y_min &&
      ballPos.y <= THRESHOLDS.BALL_IN_PENALTY.y_max) {
    events.push({
      type: 'ball_in_penalty_area',
      team: team || 'unknown',
      confidence: ballPos.confidence,
      description: `🎯 Ball im Strafraum (x:${ballPos.x}, y:${ballPos.y})`,
      minute,
      elapsed_seconds: elapsedSeconds,
    });
  }

  // Ball im Tor-Bereich (direkter Schuss)?
  if (ballPos.x >= THRESHOLDS.BALL_IN_GOAL_AREA.x_min &&
      ballPos.y >= THRESHOLDS.BALL_IN_GOAL_AREA.y_min &&
      ballPos.y <= THRESHOLDS.BALL_IN_GOAL_AREA.y_max) {
    events.push({
      type: 'ball_in_goal_area',
      team: team || 'unknown',
      confidence: ballPos.confidence * 1.1, // höhere confidence
      description: `⚽ Ball im Tor-Bereich (kritische Gefahr!)`,
      minute,
      elapsed_seconds: elapsedSeconds,
    });
  }

  // Schneller Ballwechsel (Transition)?
  if (playerPositions.length > 0) {
    const avgPlayerSpeed = playerPositions.reduce((sum, p) => sum + (p.speed || 0), 0) / playerPositions.length;
    if (avgPlayerSpeed > 80) {
      events.push({
        type: 'high_speed_transition',
        team: team || 'unknown',
        confidence: Math.min(100, avgPlayerSpeed),
        description: `⚡ Schneller Ballverlust/Konter erkannt`,
        minute,
        elapsed_seconds: elapsedSeconds,
      });
    }
  }

  return events;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, frame_base64, frame_number, elapsed_seconds, team } = body;

    if (!session_id || !frame_base64) {
      return Response.json({ error: 'Missing session_id or frame_base64' }, { status: 400 });
    }

    // 1. ROBOFLOW DETECTION
    let detections = null;
    let error = null;

    try {
      detections = await callRoboflowAPI(frame_base64);
    } catch (err) {
      error = err.message;
      console.error(`❌ Roboflow failed after retries: ${error}`);
      // Fallback: Return empty tracking aber nicht crashen
      detections = { predictions: [] };
    }

    // 2. PARSE DETECTIONS
    const ballPredictions = detections.predictions.filter(p => p.class === 'ball');
    const playerPredictions = detections.predictions.filter(p => p.class === 'player');

    const ballPos = ballPredictions.length > 0 ? {
      x: ballPredictions[0].x,
      y: ballPredictions[0].y,
      confidence: Math.round(ballPredictions[0].confidence * 100),
    } : null;

    const playerPositions = normalizePositions(playerPredictions, detections.image?.width || 1920, detections.image?.height || 1080);

    // 3. CALCULATE DETECTION QUALITY
    const qualityScore = Math.round(
      (ballPredictions.length > 0 ? 50 : 0) +
      Math.min(50, (playerPredictions.length / 22) * 50)
    );

    // 4. AUTO-EVENTS ERKENNEN
    const session = await base44.entities.LiveSession.filter({ id: session_id });
    const sessionData = session[0];
    const minute = sessionData ? Math.floor(elapsed_seconds / 60) : 0;

    const autoEvents = detectAutoEvents(ballPos, playerPositions, minute, elapsed_seconds, team);

    // 5. TRACKINGDATA SPEICHERN
    const trackingData = await base44.entities.TrackingData.create({
      session_id,
      match_id: sessionData?.match_id,
      frame_number,
      timestamp_ms: Date.now(),
      elapsed_seconds,
      ball_position: ballPos,
      player_positions: playerPositions,
      detection_quality: qualityScore,
      source: error ? 'manual' : 'roboflow',
      error: error || null,
      retry_count: 0,
    });

    // 6. AUTO-EVENTS SPEICHERN (aber nur wenn highconf)
    const savedAutoEvents = [];
    for (const evt of autoEvents) {
      if (evt.confidence >= THRESHOLDS.CONFIDENCE_MIN * 100) {
        const autoEvent = await base44.entities.AutoEvent.create({
          session_id,
          match_id: sessionData?.match_id,
          tracking_data_id: trackingData.id,
          type: evt.type,
          team: evt.team,
          minute: evt.minute,
          elapsed_seconds: evt.elapsed_seconds,
          confidence: evt.confidence,
          description: evt.description,
          data: { ball: ballPos, players: playerPositions },
          approved_by_trainer: false,
          rejected: false,
          timestamp_ms: Date.now(),
        });
        savedAutoEvents.push(autoEvent);
      }
    }

    return Response.json({
      success: true,
      tracking_data: trackingData,
      auto_events: savedAutoEvents,
      quality_score: qualityScore,
      ball_detected: ballPos !== null,
      players_detected: playerPositions.length,
      error: error,
    });
  } catch (error) {
    console.error('❌ processFrame failed:', error);
    return Response.json({ error: error.message, status: 500 }, { status: 500 });
  }
});