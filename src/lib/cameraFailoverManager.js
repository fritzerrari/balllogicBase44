/**
 * cameraFailoverManager — Automatischer Kamera-Wechsel bei Ausfall
 */

export const getCameraStatus = async (sessionId, base44) => {
  try {
    const cameras = await base44.entities.CameraConnection.filter({
      session_id: sessionId,
    });
    
    return cameras.map(cam => {
      const lastSeenMs = cam.last_heartbeat 
        ? Date.now() - new Date(cam.last_heartbeat).getTime() 
        : Infinity;
      
      return {
        camera_id: cam.camera_id,
        label: cam.label,
        online: lastSeenMs < 15000,
        stale: lastSeenMs >= 15000 && lastSeenMs < 60000,
        offline: lastSeenMs >= 60000,
        lastSeenMs,
      };
    });
  } catch (e) {
    console.warn('[cameraFailover] Status check failed:', e.message);
    return [];
  }
};

/**
 * Wähle beste verfügbare Kamera aus
 * Priority: Online > Stale > Offline
 */
export const selectBestAvailableCamera = (cameras) => {
  const online = cameras.find(c => c.online);
  if (online) return online;
  
  const stale = cameras.find(c => c.stale);
  if (stale) return stale;
  
  return cameras[0] || null;
};

/**
 * Monitor Kamera-Gesundheit und switch bei Ausfall
 */
export const monitorCameraHealth = (sessionId, currentCameraId, onFailover, base44) => {
  const checkInterval = setInterval(async () => {
    const cameras = await getCameraStatus(sessionId, base44);
    const current = cameras.find(c => c.camera_id === currentCameraId);
    
    if (current?.offline) {
      const best = selectBestAvailableCamera(cameras);
      if (best && best.camera_id !== currentCameraId) {
        console.warn(`🔄 Failover: ${currentCameraId} → ${best.camera_id}`);
        onFailover(best.camera_id, best.label);
      }
    }
  }, 5000);

  return () => clearInterval(checkInterval);
};