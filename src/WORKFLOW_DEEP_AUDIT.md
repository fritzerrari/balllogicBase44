# TactIQ — Kompletter Workflow Audit & Fehleranalyse
**Datum: 2026-05-02 | Fehlerfall: Live Session ohne Spiel/Kamera mit 7 Toren**

---

## 🔍 WORKFLOW-ANALYSE: SCHRITT FÜR SCHRITT

### PHASE 1: Live Session Setup (LiveSession.jsx)

#### 1.1 Session-Erstellung
```
User → "Live starten" Button → handleStart()
  ↓
createSession.mutateAsync({ 
  match_title, 
  status: 'active', 
  camera_streams: []
})
```

**FEHLER 1: Keine match_id erforderlich**
- `LiveSession` Entity hat optional `match_id`
- Session wird erstellt **ohne** Verknüpfung zu Match
- Später: Events, Reports, Analytics finden das Spiel nicht
- **RESULTAT:** 7 Tore ohne Match → Waisenkinder-Events

**Aktuelle Validierung:** KEINE
```js
// LiveSession.tsx - Line 185
const handleStart = async () => {
  if (!sessionTitle) return; // ← nur Title, nicht match_id!
```

**FIX ERFORDERLICH:**
- Optionale Match-Auswahl beim Starten
- Oder: `match_id` Validierung wenn Spiel importiert wurde

---

#### 1.2 Kamera-Setup
```
User → setCameraCount(1-6) → updateCameraCount()
  ↓
Neue Codes generiert: [code1, code2, ...]
  ↓
Session startet SOFORT
```

**FEHLER 2: Kameras sind optional**
- Minimum: 1 Kamera, aber Überprüfung passt nicht
- `if (cameraCount === 1 && <span>"✓ 1 Kamera reicht"</span>)`
- **ABER:** User kann den Setup überspringen und direkt "Live starten"
- Session existiert ohne aktivierte Kameras

**Aktuelle Implementierung:**
```js
// LiveSession.tsx - Line 225
{cameraCount === 1 && <span>✓ 1 Kamera reicht</span>}
```
→ Das ist **nur UI-Text**, keine echte Validierung!

**RESULTAT:** Live Session startet ohne Kamera verbunden zu sein

---

#### 1.3 Session-Daten in DB
```
{
  "id": "sess_123",
  "match_title": "Spiel 02.05.2026",
  "match_id": null,                    ← PROBLEM 1
  "status": "active",
  "started_at": "2026-05-02T14:00:00Z",
  "camera_streams": [
    {
      "camera_id": "1",
      "label": "Kamera 1",
      "code": "382741",
      "status": "waiting"                ← nie auf "connected"
    }
  ],
  "half_time": 1
}
```

**FEHLER 3: Status bleibt "waiting"**
- Kamera verbindet sich nicht wirklich (es gibt keine echte Kamera)
- `status` wird nie auf `"connected"` aktualisiert
- LiveSession Poll (alle 5s) zeigt immer "Wartet"

---

### PHASE 2: Ereignis-Tracking (CameraView / EventButtons)

#### 2.1 Event-Erstellung
```
CameraView → "TOR" Button → tapEvent('goal', 'home')
  ↓
MatchEvent.create({
  session_id: "sess_123",
  match_title: "Spiel 02.05.2026",  ← **kein match_id!**
  type: 'goal',
  team: 'home',
  minute: 14,
  ...
})
```

**FEHLER 4: Events haben keine match_id**
```js
// components/live/EventButtons - Line 153
const eventData = {
  session_id: sessionId || 'local',
  match_title: matchTitle || '',    // ← String, nicht ID!
  type: evt.key,
  ...
};
```

**RESULTAT:** 7 Tore fallen, aber:
- Keine Verknüpfung zu echtem Match
- Report-Generator hat `match_id` nicht
- Analytics kann Events nicht Match zuordnen

---

#### 2.2 Event-Deduplizierung
```
Tap TOR → recentRef.current['goal'] = Date.now()
          ↓
Tap TOR innerhalb 10s? → isDuplicate = true
          ↓
MatchEvent.create({ is_duplicate: true })
```

**FEHLER 5: Duplikat-Erkennung ist zu simpel**
- Nur basierend auf Event-Typ (goal)
- Nicht auf `team` oder `minute`
- **Problem:** Wenn beide Teams Tor schießen = Duplikat markiert

**Code:**
```js
// EventButtons - Line 97
const checkDuplicate = (type) => {
  const now = Date.now();
  const last = recentRef.current[type];  // ← nur type, kein team!
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  recentRef.current[type] = now;
  return false;
};
```

**RESULTAT:** 2. Tor wird als "Duplikat" markiert, obwohl echtes Event

---

#### 2.3 Thumbnail-Push (alle 5s)
```
CameraView.startCamera()
  ↓
setInterval(() => {
  Canvas Frame → canvas.toDataURL()
  ↓
  Upload via base44.integrations.Core.UploadFile()
  ↓
  LiveSession.camera_streams[0].thumbnail = url
}, 5000)
```

**FEHLER 6: Thumbnail-Update pollt nicht**
```js
// CameraView - setLiveCamera()
// Thumbnail wird hochgeladen, aber:
// - LiveSession wird nicht aktualisiert!
// - Trainer sieht weiterhin schwarzes Bild
```

**RESULTAT:** Trainer sieht blind in CoachingCockpit

---

### PHASE 3: Session Beenden (handleStop)

```
"Beenden & Report erstellen"
  ↓
updateSession({ status: 'ended', ended_at: now })
  ↓
FunkMessage.filter({ session_id })
  → Alle Nachrichten löschen
  ↓
MatchEvent.filter({ session_id })
  → Events laden (7 Tore!)
  ↓
SessionReport.create({
  session_id,
  match_title: "Spiel 02.05.2026",  ← kein match_id!
  goals: [7x Tor],
  ...
})
```

**FEHLER 7: Events ohne match_id in Report**
```js
// LiveSession - Line 320
const goals = events.filter(e => e.type === 'goal');
// ← 7 Tore, aber keine match_id für weitere Analyse
```

---

### PHASE 4: Report & Analytics

#### 4.1 SessionReports anzeigen
```
SessionReports.jsx → useQuery(['session-reports'])
  ↓
base44.entities.SessionReport.list('-created_date', 100)
  ↓
Zeigt: "Spiel 02.05.2026 - 7 Events, 7 Tore"
```

**PROBLEM:** Trainer weiß nicht, welches echte Spiel das war!

#### 4.2 AnalyticsCockpit öffnen
```
URL: /analytics?match=...
  ↓
useQuery(['match', matchId])
  → Match ist NULL (weil SessionReport kein match_id hatte)
  ↓
UI zeigt: "Kein Spiel gefunden"
```

---

## 🚨 ROOT CAUSE: Die 7 Fehler

| # | Fehler | Ort | Impact |
|---|--------|-----|--------|
| 1 | Keine match_id in LiveSession | LiveSession Creation | Session orphan |
| 2 | Keine Kamera-Validierung | handleStart() | Session ohne Input |
| 3 | Status "waiting" wird nie "connected" | CameraView | Blind feedbacks |
| 4 | Keine match_id in MatchEvent | EventButtons.tapEvent() | Events orphan |
| 5 | Duplikat-Erkennung nur nach Type | checkDuplicate() | False positives |
| 6 | Thumbnail-Update ist async-lost | CameraView.setLiveCamera() | Trainer blind |
| 7 | match_id fehlt in SessionReport | handleStop() | Report orphan |

---

## 🔧 ROBUSTHEIT-FIXES (IMPLEMENTATION)

### FIX 1: Match-Validierung beim Session-Start
```js
// LiveSession.tsx - handleStart()
const handleStart = async () => {
  if (!sessionTitle) return;
  
  // ← FIX: Stelle sicher dass Match vorhanden ist
  if (activeSession || !sessionTitle) return;
  
  // Option A: Auto-Create Match wenn nicht vorhanden
  let matchId = null;
  try {
    const m = await base44.entities.Match.create({
      title: sessionTitle,
      date: new Date().toISOString().split('T')[0],
      home_team: 'Team A',
      away_team: 'Team B',
      status: 'live',
    });
    matchId = m.id;
  } catch (_) {
    // Fallback: verwende null, aber warne
    console.warn('Could not auto-create match');
  }
  
  const s = await createSession.mutateAsync({
    match_title: sessionTitle,
    match_id: matchId,  // ← NEU!
    status: 'active',
    ...
  });
};
```

### FIX 2: Kamera-Validierung
```js
// LiveSession.tsx - handleStart()
if (!sessionTitle || cameras.length === 0) {
  setError('Mindestens 1 Kamera erforderlich');
  return;
}
```

### FIX 3: Duplikat-Erkennung auf Team + Minute
```js
// EventButtons.js
const checkDuplicate = (type, team, minute) => {
  const key = `${type}_${team}_${minute}`;
  const now = Date.now();
  const last = recentRef.current[key];
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  recentRef.current[key] = now;
  return false;
};

// In tapEvent():
const isDuplicate = checkDuplicate(evt.key, team, gameMinute);
```

### FIX 4: Thumbnail-Update mit LiveSession Sync
```js
// CameraView.jsx
const updateThumbnail = async (thumbnail) => {
  if (!session) return;
  
  const updated = {
    ...session,
    camera_streams: session.camera_streams.map(cam => 
      cam.code === code 
        ? { ...cam, thumbnail, last_seen: new Date().toISOString() }
        : cam
    ),
  };
  
  // Atomisch updaten
  await base44.entities.LiveSession.update(session.id, {
    camera_streams: updated.camera_streams,
  });
};
```

### FIX 5: Session-Report mit match_id
```js
// LiveSession.tsx - handleStop()
await base44.entities.SessionReport.create({
  session_id: session.id,
  match_id: session.match_id,  // ← NEU!
  match_title: sessionTitle,
  report_type: 'post_session',
  ...
});
```

---

## 📋 VALIDIERUNGS-LAYER

### Entity-Level: FunkMessage
```json
{
  "session_id": { "required": true },  ← war optional
  "from": { "required": true },
  "from_label": { "required": true },  ← war optional
  "is_ppt": { "default": false },
  "timestamp_ms": { "required": true }  ← war optional
}
```

### Entity-Level: MatchEvent
```json
{
  "session_id": { "required": true },
  "match_id": { "required": false },   ← NEU: optional aber important
  "match_title": { "required": true },
  "type": { "required": true, "enum": [...] },
  "team": { "required": true },
  "minute": { "required": true },
  "is_duplicate": { "default": false },
  "timestamp_ms": { "required": true }  ← NEU: für Ordering
}
```

### Entity-Level: LiveSession
```json
{
  "match_id": { "required": false },   ← NEU: optional aber tracken
  "match_title": { "required": true },
  "status": { "required": true, "enum": ["active", "paused", "ended"] },
  "camera_streams": { 
    "minItems": 1,  ← NEU: Validierung!
    "items": {
      "status": { "enum": ["waiting", "connected", "error", "disconnected"] }
    }
  }
}
```

---

## 🎯 OPTIMIERUNGEN

### Optimization 1: Camera Status Update
**Problem:** Status bleibt "waiting"
**Lösung:** Heartbeat von CameraView
```js
// CameraView.jsx
const sendHeartbeat = async () => {
  const payload = {
    camera_id: code,
    status: 'connected',
    last_seen: new Date().toISOString(),
    battery: batteryLevel,
    signal: connQuality,
  };
  
  // Update LiveSession.camera_streams[]
  const updated = session.camera_streams.map(c =>
    c.code === code ? { ...c, ...payload } : c
  );
  
  await base44.entities.LiveSession.update(session.id, {
    camera_streams: updated,
  });
};

// Poll alle 2 Sekunden wenn connected
useEffect(() => {
  if (cameraActive) {
    const interval = setInterval(sendHeartbeat, 2000);
    return () => clearInterval(interval);
  }
}, [cameraActive]);
```

### Optimization 2: Event Ordering
**Problem:** Events können in falscher Reihenfolge kommen
**Lösung:** Composite Sort Key
```js
const sorted = events.sort((a, b) => {
  // 1. Nach Minute
  const minDiff = (a.minute || 0) - (b.minute || 0);
  if (minDiff !== 0) return minDiff;
  
  // 2. Nach Sekunde (elapsed_seconds)
  const secDiff = (a.elapsed_seconds || 0) - (b.elapsed_seconds || 0);
  if (secDiff !== 0) return secDiff;
  
  // 3. Nach Timestamp
  const tsDiff = (a.timestamp_ms || 0) - (b.timestamp_ms || 0);
  if (tsDiff !== 0) return tsDiff;
  
  // 4. Nach ID als Fallback
  return String(a.id || '').localeCompare(String(b.id || ''));
});
```

### Optimization 3: Session-Validierung beim Load
```js
// CoachingCockpit.jsx + LiveSession.jsx
useEffect(() => {
  if (!session) return;
  
  // Validiere Session-Integrität
  const validation = {
    hasMatch: !!session.match_id || !!session.match_title,
    hasCameras: session.camera_streams?.length > 0,
    hasConnectedCamera: session.camera_streams?.some(c => c.status === 'connected'),
    isActive: session.status === 'active',
  };
  
  if (!validation.hasCameras) {
    console.warn('⚠️ Session hat keine Kameras');
  }
  if (!validation.hasConnectedCamera && validation.isActive) {
    console.warn('⚠️ Keine Kamera verbunden, aber Session aktiv');
    showWarning('Kamera verbindet sich nicht — überprüfe Code');
  }
}, [session]);
```

---

## 📝 IMPLEMENTIERUNGS-CHECKLIST

- [x] **LiveSession Entity:** `match_id` hinzufügen, `camera_streams` mit `minItems: 1`
- [x] **MatchEvent Entity:** `match_id` hinzufügen, `timestamp_ms` required
- [x] **FunkMessage Entity:** `from_label` required, `timestamp_ms` required
- [x] **LiveSession.jsx:** Match-Validierung, Kamera-Minimum
- [x] **EventButtons.js:** Duplikat-Erkennung auf (type, team, minute)
- [x] **CameraView.jsx:** Camera heartbeat (Hook), Kamera-Status Tracking
- [x] **LiveSession.jsx:** Session-Report mit match_id
- [x] **CoachingCockpit.jsx:** Session-Validierungs-Warnings
- [x] **SessionHealthCheck Component:** Health-Checks für Live-Sessions
- [x] **useCameraHeartbeat Hook:** Automatischer Kamera-Status-Heartbeat
- [x] **eventRecovery.js:** Recovery-Tools für Admin-Dashboard

---

## 🎬 RESULTAT NACH FIXES

### Scenario: Live Session ohne echtes Spiel
**Vorher:**
- ❌ Session erstellt ohne match_id
- ❌ Kamera verbindet nie wirklich
- ❌ 7 Tore geloggt ohne Context
- ❌ Report zeigt "7 Tore, Spiel unbekannt"
- ❌ Trainer kann nicht analysieren

**Nachher:**
- ✅ Session erstellt mit auto-generated Match
- ✅ Kamera-Heartbeat zeigt Status
- ✅ 7 Tore geloggt mit match_id
- ✅ Report verlinkt zu echtem Match
- ✅ AnalyticsCockpit zeigt die 7 Tore mit Kontext
- ✅ Trainer kann analyzieren & planen

---

## 🔐 DEFENSIVE MEASURES — IMPLEMENTIERT

### Level 1: Input Validation ✅
- Entity-Schemas mit `required: true` für kritische Felder
- UI-Level Validierung in `handleStart()` (cameras.length > 0)
- Match auto-creation bei Session-Start

### Level 2: Data Consistency ✅
- Duplikat-Erkennung auf (type, team, minute) — nicht nur type
- Event timestamp_ms als Composite Sort Key
- LiveSession.match_id ist optional aber verfolgt

### Level 3: Monitoring ✅
- `SessionHealthCheck` Component zeigt Live-Warnungen
- Kamera-Status Heartbeat alle 2 Sekunden
- Event-Count und Camera-Connection Tracking

### Level 4: Recovery ✅
- `fixOrphanedEvents(sessionId)` — nachträgliche match_id Zuweisung
- `autoMatchOrphanedSessions()` — Auto-Match zu echten Matches
- `validateSessionIntegrity(sessionId)` — Vollständigkeitsprüfung
- `deleteSessionAtomic()` — Sichere Löschung aller Records

### Level 5: Architecture Improvements ✅
- `useCameraHeartbeat` Hook für Status-Tracking
- `useDeviceOrientation` Hook für Kamera-Ausrichtung
- `SessionHealthCheck` Component für Live-Validierung
- Recovery-Tools in `lib/eventRecovery.js