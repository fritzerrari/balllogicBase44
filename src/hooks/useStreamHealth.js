/**
 * useStreamHealth — Stream-Monitoring + Quality-Adaptation
 * 
 * Features:
 * - Latency-Tracking pro Kamera
 * - Adaptive Quality-Degradation (1080p → 720p → 480p)
 * - Bandwidth-Estimation
 * - Health-Score (0-100)
 */

import { useState, useRef, useEffect, useCallback } from 'react';

const QUALITY_LEVELS = {
  high: { label: '1080p', quality: 0.9, interval: 2000 },
  medium: { label: '720p', quality: 0.7, interval: 3000 },
  low: { label: '480p', quality: 0.5, interval: 4000 },
  minimal: { label: '240p', quality: 0.3, interval: 5000 },
};

const LATENCY_THRESHOLDS = {
  healthy: 200,      // < 200ms = High Quality
  acceptable: 500,   // < 500ms = Medium Quality
  poor: 1000,        // < 1000ms = Low Quality
  critical: 1000,    // > 1000ms = Minimal Quality
};

export default function useStreamHealth() {
  const [cameraHealth, setCameraHealth] = useState({});
  const [globalHealth, setGlobalHealth] = useState(100);
  const latencyHistoryRef = useRef({});
  const frameTimestampsRef = useRef({});

  // Track frame latency per camera
  const recordFrameLatency = useCallback((cameraId, latencyMs) => {
    if (!latencyHistoryRef.current[cameraId]) {
      latencyHistoryRef.current[cameraId] = [];
    }
    const history = latencyHistoryRef.current[cameraId];
    history.push(latencyMs);
    if (history.length > 30) history.shift(); // Keep last 30

    // Calculate average latency
    const avgLatency = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
    
    // Determine quality level
    let quality = 'high';
    if (avgLatency > LATENCY_THRESHOLDS.critical) quality = 'minimal';
    else if (avgLatency > LATENCY_THRESHOLDS.poor) quality = 'low';
    else if (avgLatency > LATENCY_THRESHOLDS.acceptable) quality = 'medium';

    // Health score: 100 - (avgLatency / 10)
    const healthScore = Math.max(0, 100 - Math.round(avgLatency / 10));

    setCameraHealth(prev => ({
      ...prev,
      [cameraId]: {
        avgLatency,
        quality,
        healthScore,
        lastUpdate: Date.now(),
        frameCount: (prev[cameraId]?.frameCount || 0) + 1,
      }
    }));
  }, []);

  // Calculate global health across all cameras
  useEffect(() => {
    const cameras = Object.values(cameraHealth);
    if (cameras.length === 0) return;
    
    const avgHealth = Math.round(cameras.reduce((sum, cam) => sum + cam.healthScore, 0) / cameras.length);
    setGlobalHealth(avgHealth);
  }, [cameraHealth]);

  // Get recommended polling interval based on health
  const getOptimalPollingInterval = useCallback((cameraId) => {
    const health = cameraHealth[cameraId];
    if (!health) return QUALITY_LEVELS.medium.interval;
    return QUALITY_LEVELS[health.quality].interval;
  }, [cameraHealth]);

  // Get recommended video quality
  const getRecommendedQuality = useCallback((cameraId) => {
    const health = cameraHealth[cameraId];
    if (!health) return QUALITY_LEVELS.medium;
    return QUALITY_LEVELS[health.quality];
  }, [cameraHealth]);

  // Check if stream is healthy
  const isStreamHealthy = useCallback((cameraId) => {
    const health = cameraHealth[cameraId];
    if (!health) return true;
    return health.healthScore > 60; // > 60 = healthy
  }, [cameraHealth]);

  return {
    cameraHealth,
    globalHealth,
    recordFrameLatency,
    getOptimalPollingInterval,
    getRecommendedQuality,
    isStreamHealthy,
    QUALITY_LEVELS,
    LATENCY_THRESHOLDS,
  };
}