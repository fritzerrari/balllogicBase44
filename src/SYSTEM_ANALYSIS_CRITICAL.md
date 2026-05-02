# 🔴 TactIQ System — KRITISCHE ANALYSE & FIXES

**Status**: 5/10 Funktionalität. Mehrere **Datenbankfluss-Fehler** und **State-Management-Probleme**.

---

## 🎯 PRIORISIERTE PROBLEME

### 🔴 P1: LIVE-Banner verschwindet nicht (Aktuell gemeldet)
**Problem**: `pages/Dashboard.jsx` zählt `liveCount` aus `Match.status === 'live'`
- Session endet → Match.status bleibt `'live'` 
- Dashboard zeigt immer noch "Live Sessions aktiv"

**Root Cause**: `LiveSession.jsx` beim `handleStop()` updated nicht das verknüpfte Match

**Fix**: Match-Status on session.end() → 'analyzed'

---

### 🔴 P2: Session-Match Lifecycle unklar
**Ablauf ist kaputt**:
```
1. LiveSession.jsx: handleStart() → auto-create Match (status='live')
2. Coach tapped Events → MatchEvent.create()
3. handleStop() → SessionReport.create()
   ❌ Match.status bleibt 'live' 
   ❌ match_id wird nicht aktualisiert
```

**Fix**: 
- handleStop() muss Match.status → 'analyzed' updaten
- SessionReport muss match_id enthalten

---

### 🔴 P3: Event-Duplikate trotz Deduplication
**Problem**: `EventButtons.js` nutzt Dedup-Fenster von 10s
- Events gleicher Minute/Team werden später akzeptiert
- Spieler drücken 2x schnell: 1x gespeichert, 1x "Duplikat"
- Aber im Log sichtbar → konfus

**Fix**: Ändern auf (type, team, minute) + visual feedback (nicht speichern wenn duplikat)

---

### 🟡 P4: Camera Status Tracking fehlerhaft
**Problem**: `useCameraHeartbeat` sendet status updates, aber:
- Session wird gepullt alle 5s → Race condition mit Heartbeat (2s)
- last_seen wird nicht konsistent aktualisiert
- Thumbnail-Push verzögert (5s initial → 30s interval)

**Fix**: Zentralisiertes Camera-State-Management

---

### 🟡 P5: SessionReport Daten unvollständig
**Problem**: `LiveSession.jsx` erstellt SessionReport mit:
```js
await base44.entities.SessionReport.create({
  session_id: session.id,
  match_id: session.match_id,    // ❌ KANN NULL SEIN
  match_title: sessionTitle,
  report_type: 'post_session',
  event_count: events.length,
  goals: [...],
  // ❌ Kein match_id auf Report → Cannot filter/analyze
})
```

**Fix**: SessionReport REQUIRES match_id (wie MatchEvent)

---

### 🟡 P6: Recovery fehlende Daten
**Problem**: Wenn Session crashed:
- Events sind orphaned (session_id existiert nicht mehr)
- SessionReport zeigt aber kein error
- Admin-Recovery Tools (`eventRecovery.js`) sind nur Backend

**Fix**: Automatische Recovery oder Admin-UI für Repair

---

### 🟡 P7: Event Ordering ist zu simpel
**Problem**: `MatchEvent` nutzt nur timestamp_ms
- Events von 2 Kameras gleichzeitig → Reihenfolge unklar
- Duplikat-Check braucht aber Reihenfolge

**Fix**: Composite Key (session_id, timestamp_ms, source)

---

### 🟡 P8: DSGVO-Gate blockiert Tracking
**Problem**: `CoachingCockpit.jsx`
- Spieler mit ausstehender Einwilligung → Tracking blocked
- Aber ohne Tracking = keine Events → nutzlos

**Fix**: Anonymisiertes Tracking ohne Namen (schon implementiert, aber nicht erzwungen)

---

### 🟡 P9: Funk (PTT) zu wenig robust
**Problem**: `FunkPanel` + `CameraFunkPanel`
- Filter auf is_ppt fehlerhaft (Zeile: Filter auf is_ppt NOT is_ptt)
- Nachrichten-Sync alle 2s → 4s Latenz möglich
- PTT-Status läuft aus nach 5s (hart codiert)

**Fix**: WebSocket-like polling oder subscribes

---

### 🟢 P10: UI-Überflutung
**Problem**: `CoachingCockpit` zeigt alles auf einmal
- 3 Kameras + Pitch + Tracking + Stats + Funk + Events = 40% screen
- Mobile: unmöglich zu nutzen

**Fix**: Tabbed/Modal Layout für Mobile

---

## 📋 IMPLEMENTIERUNGS-ROADMAP

### SOFORT (heute):
1. ✅ Dashboard "LIVE" Banner fix (Match.status update)
2. ✅ SessionReport.match_id required validieren
3. ✅ Event-Duplikat visual feedback

### DIESE WOCHE:
4. Camera-Status zentralisieren
5. Event-Ordering Composite Key
6. SessionReport Recovery-UI

### NÄCHSTE WOCHE:
7. Funk-Robustheit (WebSocket??)
8. DSGVO-Automatisierung
9. Mobile Layout für CoachingCockpit

---

## 🏗️ ARCHITEKTUR-PROBLEME

### Fehlende Zentrale Koordination
```
Aktuell:
  LiveSession.jsx ← → CoachingCockpit.jsx ← → CameraView.jsx
  ↓ (separate polls)
  base44.entities.LiveSession (alle 3-5s)

Besser:
  CentralSessionManager (React Context/Redux)
    ├─ Session State (status, cameras, events)
    ├─ Real-time Updates (subscribers)
    └─ Auto-Cleanup on end()
```

### State Management Spagetti
- SessionInfo in 5+ komponenten State
- sessionCodeRef + sessionInfoRef in CameraView (warum refs?)
- pollRef + heartbeatRef + uptimeRef = zu viele Intervals

**Besser**: Context-API + useReducer oder Zustand

### Keine Automated Tests
- Keine Unit-Tests für Recovery-Logik
- Keine Integration-Tests für Session → Report flow

---

## 🔧 QUICK WINS (30 min)

1. **Dashboard Fix**: Match.update() on session.end()
2. **Duplikat-Flag**: Visual feedback "DUPL" badge in log
3. **SessionReport.match_id**: Required in schema
4. **Cleanup on unmount**: CameraView cleanup besser
5. **Polling Interval reduce**: 5s → 3s für schnellere Updates

---

## 📊 METRIKEN

| Aspekt | Status | Impact |
|--------|--------|--------|
| Session → Match | ❌ Broken | 🔴 Critical |
| Event Recording | ✅ Works (with dupes) | 🟡 Medium |
| Camera Status | ⚠️ Unreliable | 🟡 Medium |
| SessionReport | ❌ Incomplete | 🔴 Critical |
| DSGVO Compliance | ✅ Implemented | 🟢 Low |
| Funk (Chat) | ⚠️ Works but slow | 🟡 Medium |
| Mobile UX | ❌ Broken | 🔴 Critical |

---

## 🎯 NEXT STEPS

1. **Jetzt**: Fix P1-P3 (30 min)
2. **Dann**: Test mit realen Sessions
3. **Review**: Feedback-Loop mit User