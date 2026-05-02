/**
 * footballTracker.js
 * ==================
 * Core tracking engine for TactIQ.
 * 
 * Two modes:
 * 1. ROBOFLOW MODE — Real detections via Roboflow Hosted API (RF-DETR / YOLOv11)
 *    Detects: player, goalkeeper, referee, ball
 *    Returns bounding boxes + confidence
 * 
 * 2. SIMULATION MODE — Physics-based simulation for demo / fallback
 * 
 * Team assignment via jersey color clustering (canvas pixel analysis).
 * Event detection: goal, corner, foul, offside-candidate.
 * Kalman-style smoothing for stable trajectories.
 */

// ─── Roboflow API ────────────────────────────────────────────────────────────
const ROBOFLOW_MODEL = 'football-players-detection-3zvbc-4bgah/2';
const ROBOFLOW_URL = `https://detect.roboflow.com/${ROBOFLOW_MODEL}`;

/**
 * Run RF-DETR / YOLO detection on a canvas frame.
 * @param {HTMLCanvasElement} canvas
 * @param {string} apiKey
 * @returns {Promise<Detection[]>}
 */
export async function detectFrame(canvas, apiKey) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7));
  const base64 = await blobToBase64(blob);
  const dataOnly = base64.split(',')[1];

  const res = await fetch(`${ROBOFLOW_URL}?api_key=${apiKey}&confidence=35&overlap=30`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: dataOnly,
  });
  const data = await res.json();

  return (data.predictions || []).map(p => ({
    id: `${p.class}-${Math.round(p.x)}-${Math.round(p.y)}`,
    class: p.class, // 'player' | 'goalkeeper' | 'referee' | 'ball'
    x: p.x / data.image.width * 100,
    y: p.y / data.image.height * 100,
    width: p.width / data.image.width * 100,
    height: p.height / data.image.height * 100,
    confidence: p.confidence,
    team: null, // assigned later by color clustering
  }));
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// ─── Team Color Assignment ────────────────────────────────────────────────────
/**
 * Assign team by sampling jersey color from canvas.
 * Clusters players into 2 teams by dominant hue.
 */
export function assignTeamsByColor(canvas, detections) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const playersWithColor = detections
    .filter(d => d.class === 'player' || d.class === 'goalkeeper')
    .map(d => {
      // Sample center-top of bounding box (jersey area)
      const px = Math.round(d.x / 100 * W);
      const py = Math.round((d.y - d.height * 0.2) / 100 * H);
      const sw = Math.max(4, Math.round(d.width / 100 * W * 0.4));
      const sh = Math.max(4, Math.round(d.height / 100 * H * 0.3));
      const x0 = Math.max(0, px - sw / 2);
      const y0 = Math.max(0, py - sh / 2);

      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      try {
        const imgData = ctx.getImageData(x0, y0, sw, sh);
        for (let i = 0; i < imgData.data.length; i += 4) {
          rSum += imgData.data[i];
          gSum += imgData.data[i + 1];
          bSum += imgData.data[i + 2];
          count++;
        }
      } catch (e) { /* CORS */ }

      const r = count ? rSum / count : 128;
      const g = count ? gSum / count : 128;
      const b = count ? bSum / count : 128;
      const hue = rgbToHue(r, g, b);

      return { ...d, hue, r, g, b };
    });

  if (playersWithColor.length < 2) {
    return detections.map(d => ({ ...d, team: d.team || 'home' }));
  }

  // K-means with k=2 on hue
  const hues = playersWithColor.map(p => p.hue);
  const [c1, c2] = kMeans2(hues);

  const result = detections.map(d => {
    if (d.class === 'referee') return { ...d, team: 'referee' };
    if (d.class === 'ball') return { ...d, team: 'ball' };

    const p = playersWithColor.find(p => p.id === d.id);
    if (!p) return { ...d, team: 'home' };

    const distToC1 = Math.abs(hueDiff(p.hue, c1));
    const distToC2 = Math.abs(hueDiff(p.hue, c2));
    return { ...d, team: distToC1 < distToC2 ? 'home' : 'away' };
  });

  return result;
}

function rgbToHue(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  let h;
  const d = max - min;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return h * 360;
}

function hueDiff(a, b) {
  let d = a - b;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function kMeans2(values, iterations = 10) {
  if (values.length === 0) return [0, 180];
  let c1 = values[0];
  let c2 = values[Math.floor(values.length / 2)];
  for (let iter = 0; iter < iterations; iter++) {
    const g1 = [], g2 = [];
    for (const v of values) {
      Math.abs(hueDiff(v, c1)) < Math.abs(hueDiff(v, c2)) ? g1.push(v) : g2.push(v);
    }
    if (g1.length) c1 = g1.reduce((s, v) => s + v, 0) / g1.length;
    if (g2.length) c2 = g2.reduce((s, v) => s + v, 0) / g2.length;
  }
  return [c1, c2];
}

// ─── Event Detection ──────────────────────────────────────────────────────────
/**
 * Rule-based football event detection.
 * @param {Detection[]} detections - current frame
 * @param {Detection[]} prevDetections - previous frame
 * @param {object} pitchBounds - {left, right, top, bottom} in % coords
 */
export function detectEvents(detections, prevDetections, pitchBounds = { left: 2, right: 98, top: 2, bottom: 98 }) {
  const events = [];
  const ball = detections.find(d => d.class === 'ball');
  const prevBall = prevDetections?.find(d => d.class === 'ball');

  if (!ball) return events;

  // GOAL — ball crosses goal line (x < 5 or x > 95, inside goal y range 35-65)
  const inGoalY = ball.y > 35 && ball.y < 65;
  if (ball.x < 5 && inGoalY) {
    events.push({ type: 'goal', team: 'away', description: 'Ball im Tor — Gäste-Seite!', minute: null });
  }
  if (ball.x > 95 && inGoalY) {
    events.push({ type: 'goal', team: 'home', description: 'Ball im Tor — Heim-Seite!', minute: null });
  }

  // CORNER — ball near corner flags (x<5 or x>95) AND (y<5 or y>95)
  const nearCorner = (ball.x < 6 || ball.x > 94) && (ball.y < 6 || ball.y > 94);
  if (nearCorner) {
    events.push({ type: 'corner', team: ball.x < 50 ? 'away' : 'home', description: 'Eckstoß erkannt', minute: null });
  }

  // FOUL — player cluster with referee nearby
  const referee = detections.find(d => d.class === 'referee');
  if (referee) {
    const nearRefPlayers = detections.filter(d =>
      (d.class === 'player' || d.class === 'goalkeeper') &&
      Math.hypot(d.x - referee.x, d.y - referee.y) < 8
    );
    if (nearRefPlayers.length >= 3) {
      events.push({ type: 'foul', team: null, description: `Spieler-Cluster beim Schiedsrichter (${nearRefPlayers.length} Spieler)`, minute: null });
    }
  }

  // FAST BREAK / TRANSITION — ball moved > 25% pitch in one frame
  if (prevBall) {
    const dist = Math.hypot(ball.x - prevBall.x, ball.y - prevBall.y);
    if (dist > 25) {
      events.push({ type: 'transition', team: null, description: `Schneller Ballverlust / Konter (${dist.toFixed(0)}% Spielfeld)`, minute: null });
    }
  }

  return events;
}

// ─── Kalman-style Smoother — SESSION-SCOPED (no global state leakage) ────────
const SMOOTH_STATE_BY_SESSION = new Map(); // Key: sessionId, Value: smoothState object
const MAX_SMOOTH_STATE_SIZE = 150;

export function smoothDetections(detections, alpha = 0.6, sessionId = 'default') {
  if (!SMOOTH_STATE_BY_SESSION.has(sessionId)) {
    SMOOTH_STATE_BY_SESSION.set(sessionId, {});
  }
  
  let smoothState = SMOOTH_STATE_BY_SESSION.get(sessionId);
  
  // Cleanup old entries if too large (FIFO eviction)
  if (Object.keys(smoothState).length > MAX_SMOOTH_STATE_SIZE) {
    const keys = Object.keys(smoothState);
    for (let i = 0; i < keys.length - MAX_SMOOTH_STATE_SIZE + 50; i++) {
      delete smoothState[keys[i]];
    }
  }

  return detections.map(d => {
    const key = d.id || `${d.class}-${d.team}`;
    const prev = smoothState[key];
    if (!prev) {
      smoothState[key] = { x: d.x, y: d.y };
      return d;
    }
    const sx = prev.x * (1 - alpha) + d.x * alpha;
    const sy = prev.y * (1 - alpha) + d.y * alpha;
    smoothState[key] = { x: sx, y: sy };
    return { ...d, x: sx, y: sy };
  });
}

// Cleanup session state when done
export function clearSessionSmoothing(sessionId) {
  SMOOTH_STATE_BY_SESSION.delete(sessionId);
}

// ─── Simulation Mode (fallback / demo) ───────────────────────────────────────

/**
 * @param {number} tick
 * @param {object} options
 * @param {number} options.playersPerTeam - 1–11 (default 11 for GK+10)
 * @param {boolean} options.includeReferee - default true (disable for training)
 * @param {'full'|'half'|'small'|'training'} options.pitchType - constrains player positions
 */
export function simulateDetections(tick, options = {}) {
  const {
    playersPerTeam = 11,
    includeReferee = true,
    pitchType = 'full',
  } = options;

  const seed = (n, offset = 0) => (Math.sin(tick * 0.04 + n + offset) * 0.5 + 0.5);

  // Constrain x range based on pitch type
  const xMin = pitchType === 'half' ? 5 : 5;
  const xMax = pitchType === 'half' ? 50 : pitchType === 'small' ? 90 : 90;
  const xRange = xMax - xMin;

  const players = [];
  const outfield = playersPerTeam - 1; // minus GK

  // Home
  players.push({ id: 'gk-home', class: 'goalkeeper', team: 'home', x: xMin + seed(0) * 3, y: 40 + seed(1) * 20, confidence: 0.95, speed: (seed(0) * 5).toFixed(1) });
  for (let i = 0; i < outfield; i++) {
    players.push({
      id: `home-${i}`, class: 'player', team: 'home',
      x: xMin + 10 + seed(i * 3) * (xRange * 0.55),
      y: 5 + seed(i * 7) * 90,
      confidence: 0.82 + seed(i) * 0.15,
      number: i + 2,
      speed: (seed(i * 11) * 28).toFixed(1),
    });
  }

  // Away
  const awayXBase = pitchType === 'half' ? xMin + 10 : xMax - 10;
  players.push({ id: 'gk-away', class: 'goalkeeper', team: 'away', x: xMax - seed(20) * 3, y: 40 + seed(21) * 20, confidence: 0.95, speed: (seed(20) * 5).toFixed(1) });
  for (let i = 0; i < outfield; i++) {
    players.push({
      id: `away-${i}`, class: 'player', team: 'away',
      x: pitchType === 'half' ? xMin + 5 + seed(i * 2 + 30) * (xRange * 0.8) : (xMax - 10) - seed(i * 2 + 30) * (xRange * 0.55),
      y: 5 + seed(i * 5 + 30) * 90,
      confidence: 0.82 + seed(i + 30) * 0.15,
      number: i + 2,
      speed: (seed(i * 9 + 30) * 28).toFixed(1),
    });
  }

  if (includeReferee) {
    players.push({ id: 'ref', class: 'referee', team: 'referee', x: xMin + xRange * 0.4 + seed(50) * xRange * 0.25, y: 25 + seed(51) * 50, confidence: 0.91 });
  }

  const ball = { id: 'ball', class: 'ball', team: 'ball', x: xMin + 10 + seed(99) * (xRange * 0.8), y: 15 + seed(88) * 70, confidence: 0.88 };

  return { players: [...players, ball], ball };
}

// ─── Stats Computation ───────────────────────────────────────────────────────
export function computeStats(history) {
  if (!history || history.length < 2) return null;

  const home = history.flatMap(f => f.filter(d => d.team === 'home'));
  const away = history.flatMap(f => f.filter(d => d.team === 'away'));
  const balls = history.flatMap(f => f.filter(d => d.class === 'ball'));

  // Ball possession by proximity
  let homePoss = 0, awayPoss = 0;
  history.forEach(frame => {
    const ball = frame.find(d => d.class === 'ball');
    if (!ball) return;
    const homeD = frame.filter(d => d.team === 'home').map(p => Math.hypot(p.x - ball.x, p.y - ball.y));
    const awayD = frame.filter(d => d.team === 'away').map(p => Math.hypot(p.x - ball.x, p.y - ball.y));
    const minHome = homeD.length ? Math.min(...homeD) : 999;
    const minAway = awayD.length ? Math.min(...awayD) : 999;
    minHome < minAway ? homePoss++ : awayPoss++;
  });

  const total = homePoss + awayPoss || 1;
  const homePct = Math.round(homePoss / total * 100);

  // Avg pressing line (average X of home players)
  const avgX = home.length ? home.reduce((s, p) => s + p.x, 0) / home.length : 50;

  // Compactness (std dev of Y positions)
  const homeY = home.map(p => p.y);
  const compactness = homeY.length > 1
    ? Math.round(100 - Math.sqrt(homeY.reduce((s, y) => s + Math.pow(y - homeY.reduce((a, b) => a + b, 0) / homeY.length, 2), 0) / homeY.length))
    : 70;

  return {
    possession_home: homePct,
    possession_away: 100 - homePct,
    pressing_line_home: Math.round(avgX),
    compactness_home: compactness,
    player_count_home: [...new Set(home.map(p => p.id))].length,
    player_count_away: [...new Set(away.map(p => p.id))].length,
  };
}