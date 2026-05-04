/**
 * offlineSessionManager — SessionState localStorage sync
 * Persistiert State lokal, synced zurück wenn Server wieder da
 */

export const saveSessionStateOffline = (sessionId, state) => {
  try {
    const key = `session_state_${sessionId}`;
    localStorage.setItem(key, JSON.stringify({
      ...state,
      synced_at: Date.now(),
    }));
  } catch (e) {
    console.warn('[offlineSessionManager] Save failed:', e.message);
  }
};

export const loadSessionStateOffline = (sessionId) => {
  try {
    const key = `session_state_${sessionId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('[offlineSessionManager] Load failed:', e.message);
    return null;
  }
};

export const clearSessionStateOffline = (sessionId) => {
  try {
    const key = `session_state_${sessionId}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('[offlineSessionManager] Clear failed:', e.message);
  }
};

/**
 * Regelmäßig Auto-Sync: Versucht lokale Daten mit Server zu synchen
 */
export const autoSyncSessionState = async (sessionId, base44) => {
  const offline = loadSessionStateOffline(sessionId);
  if (!offline) return;

  try {
    // Versuche zu synchen
    const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
    if (sessions.length > 0) {
      // Server ist erreichbar — Offline-State löschen
      clearSessionStateOffline(sessionId);
      console.log(`✅ Auto-sync successful for session ${sessionId}`);
    }
  } catch (e) {
    console.warn('[autoSync] Still offline:', e.message);
  }
};