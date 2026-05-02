# TactIQ System — Tiefenanalyse & Fehlerkorrektur
**Datum: 2026-05-02**

---

## ✅ BEHOBENE FEHLER

### 1. **KRITISCH: CameraFunkPanel konnte nicht geschlossen werden**
**Symptom:** Push-to-Talk-Panel lässt sich nicht schließen, bleibt permanent offen

**Root Cause:** 
- `CameraFunkPanel` erhielt `onClose` Prop aber hatte keinen Close-Button
- Keine UI-Logik zum Schließen des Panels implementiert
- `expanded` State konnte nur durch Icon geöffnet, nicht geschlossen werden

**Fix:**
- ✅ Close-Button (X-Icon) hinzugefügt in expandiertem Panel
- ✅ `handleClose()` Handler implementiert, der `onClose` aufruft und Panel schließt
- ✅ Touch-sichere Implementierung mit `onClose && (...)` Guard

**Datei:** `components/live/CameraFunkPanel`

---

### 2. **KRITISCH: Text-Messages vom Trainer kommen nicht bei Kamera an**
**Symptom:** Trainer sendet Nachrichten, Kameramann sieht sie nicht

**Root Cause:**
- `sessionId` ist beim Laden des Panels oft `undefined` (bis WebRTC-Verbindung etabliert)
- Poll-Loop startet trotzdem, findet aber `session_id: undefined` in der Datenbank
- `FunkMessage` entitäten mit `session_id: undefined` werden nicht gespeichert/abgerufen
- Fehlerbehandlung war nicht vorhanden → stille Fehler

**Fix:**
- ✅ Robuste `sessionId`-Validierung in allen Operationen
- ✅ `sendText()`, `handlePTT()` prüfen jetzt `if (!sessionId) return;`
- ✅ Buttons disabled wenn sessionId nicht verfügbar
- ✅ Try-catch in fetchMsgs() für Fehlerbehandlung
- ✅ Poll-Logik funktioniert auch wenn sessionId delayed ankommt (nach 2-3s)

**Datei:** `components/live/CameraFunkPanel`

---

### 3. **KRITISCH: Kamera-Orientierung (Portrait/Landscape) nicht erkannt**
**Symptom:** Kamera filmt quer, aber Trainer sieht Bild nicht korrekt; Tracking-Features ignorieren Ausrichtung

**Root Cause:**
- System hatte **keine Logik** zur Erkennung von Geräte-Ausrichtung
- Keine Unterscheidung zwischen Portrait/Landscape
- Video-Stream Auflösung wurde nicht analysiert
- CoachingCockpit/FootballPitch können nicht auf Ausrichtung reagieren

**Fix:**
- ✅ **Neuer Hook: `useDeviceOrientation()`** created
  - Nutzt `screen.orientation` API (primär)
  - Fallback auf `window.innerWidth/Height`
  - Analysiert Video-Stream-Auflösung (width/height ratio)
  - Triggt Event-Listener für dynamische Updates

- ✅ **CameraView nutzt Hook**
  - `const { orientation, isPortrait } = useDeviceOrientation(videoRef)`
  - Container trägt `data-orientation` Attribut
  - Video-Element responsive angepasst

- ✅ **LiveSession kann Orientierung tracken** (für spätere Implementierungen)

**Dateien:** `hooks/useDeviceOrientation.js`, `pages/CameraView`

---

### 4. **BUG: PTT Filter fehlerhaft (is_ppt vs is_ptt)**
**Symptom:** PTT-Status-Nachrichten erscheinen nicht richtig

**Root Cause:** Property-Namenskonvention war inkonsistent
- Entity nutzt `is_ppt` 
- Code checking auf `is_ppt` aber Logik war fehlerhaft

**Fix:**
- ✅ Konsistente Verwendung von `is_ppt` in CameraFunkPanel
- ✅ Filter in Message-Rendering: `{messages.filter(m => !m.is_ppt || !m.ppt_active)`
- ✅ PTT-Status-Nachrichten werden korrekt ausgeblendet

**Datei:** `components/live/CameraFunkPanel`

---

### 5. **UX: Refresh-Schutz (bestehend, aber verbessert)**
**Symptom:** Nach versehentlichem Refresh verliert Kameramann Code und muss neu eingeben

**Bestehend:** SessionStorage-Persistierung (aus vorherigem Fix)
**Zusatz:** Fehlerbehandlung robuster gemacht

**Datei:** `pages/CameraView`

---

### 6. **UX: Thumbnail-Latenz**
**Symptom:** Trainer sieht 30 Sekunden lang schwarzes Bild, dann Thumbnail

**Root Cause:** Erster Thumbnail-Push erst nach 30 Sekunden

**Fix:** ✅ Erster Push nach **5 Sekunden**, danach alle 30s

**Datei:** `pages/CameraView`

---

## 🔍 WEITERE FEHLER IDENTIFIZIERT (NOCH OFFEN)

### A. **Datenfluss-Fehler: FunkMessage Polling vs. LiveSession Status**
**Problem:** 
- CameraView pollt `FunkMessage` aber `sessionId` kann sich ändern
- LiveSession kann beendet werden, während CameraView noch pollt
- Keine Synchronisation zwischen session status und UI

**Empfohlene Lösung:**
- Listener auf `LiveSession.status` hinzufügen
- Automatisches Cleanup wenn Session endet
- User-Notification wenn Session beendet wird

---

### B. **Orientierungs-Tracking im CoachingCockpit nicht implementiert**
**Problem:**
- Hook ist definiert, aber CoachingCockpit nutzt es nicht
- FootballPitch-Canvas wird nicht rotiert
- Tracking-Overlays ignorieren Portrait/Landscape

**Empfohlene Lösung:**
- CoachingCockpit Hook integrieren
- FootballPitch Canvas mit CSS transform bei Bedarf rotieren
- Tracking-Spieler-Koordinaten neu-mappern bei Orientierungswechsel

---

### C. **Fehler bei schnellen Kameraperspektiven-Wechseln**
**Problem:**
- `flipCamera()` in CameraView kann Race-Conditions verursachen
- Mehrfacher Wechsel innerhalb von Sekunden führt zu Fehlern
- Stream ist nicht vollständig initialisiert bevor gewechselt wird

**Empfohlene Lösung:**
```js
const [flipping, setFlipping] = useState(false);
const flipCamera = async () => {
  if (flipping) return; // Guard
  setFlipping(true);
  const next = facingMode === 'environment' ? 'user' : 'environment';
  setFacingMode(next);
  await startCamera(next);
  setFlipping(false);
};
```

---

### D. **TrainerUI (FunkPanel) zeigt Cameras-Nachrichten ohne Labels**
**Problem:**
- `msg.from_label` wird manchmal nicht gespeichert
- Nachrichten erscheinen als "camera_1" statt "Kamera 1"
- Kamera-Label-Zuordnung ist fragil

**Empfohlene Lösung:**
- Entity-Constraint: `from_label` ist `required`
- Beim Speichern immer Fallback: `from_label = from.replace('camera_', 'Kamera ')`

---

### E. **Message-Order bei gleichzeitigen Sendevorgängen**
**Problem:**
- Wenn Trainer & Kamera gleichzeitig senden, kann Reihenfolge falsch sein
- `timestamp_ms` ist nicht atomisch
- UI sortiert nur nach timestamp, nicht nach ID

**Empfohlene Lösung:**
```js
const sorted = all.sort((a, b) => {
  const diff = (a.timestamp_ms || 0) - (b.timestamp_ms || 0);
  if (diff !== 0) return diff;
  return String(a.id || '').localeCompare(String(b.id || ''));
});
```

---

### F. **Audio-Erkennung (Auto-Goal) ist fragile**
**Problem:**
- `startAudioDetection()` erstellt neuen AudioContext
- Nur 1 Goal pro 30s erkannt, was zu Fehlern führt
- Kein Feedback wenn Audio-Zugriff verweigert wird

**Empfohlene Lösung:**
- Audio-Anfrage vorher prüfen, nicht erst bei startAudioDetection
- Mehrere Goals pro Minute erlauben
- Error-Handler mit UI-Feedback

---

### G. **Session beenden (handleStop) ist nicht atomar**
**Problem:**
- Session wird in DB markiert `status: 'ended'`
- Aber FunkMessages werden getrennt gelöscht
- Race Condition wenn Trainer gleichzeitig Nachricht sendet
- Kam erst beim Stoppen raus, aber könnte Daten verlieren

**Empfohlene Lösung:**
```js
// Atomic: Session + alle zugehörigen Daten auf einmal löschen
const cleanup = async (sessionId) => {
  const [messages, events] = await Promise.all([
    base44.entities.FunkMessage.filter({ session_id: sessionId }),
    base44.entities.MatchEvent.filter({ session_id: sessionId }),
  ]);
  await Promise.all([
    ...messages.map(m => base44.entities.FunkMessage.delete(m.id)),
    ...events.map(e => base44.entities.MatchEvent.delete(e.id)),
  ]);
};
```

---

### H. **CameraView: `overscroll-behavior` Fehler**
**Problem:**
- iOS Safari: Pull-to-refresh kann passieren
- Verursacht versehentliche Seite-Reloads
- CameraView-State wird verloren

**Empfohlene Lösung:**
```jsx
useEffect(() => {
  document.body.style.overscrollBehavior = 'none';
  return () => { document.body.style.overscrollBehavior = 'auto'; };
}, []);
```

---

## 📊 ZUSAMMENFASSUNG

| Fehler | Severity | Status | Datei |
|--------|----------|--------|-------|
| PTT nicht schließbar | KRITISCH | ✅ BEHOBEN | CameraFunkPanel |
| Messages kommen nicht an | KRITISCH | ✅ BEHOBEN | CameraFunkPanel |
| Orientierung nicht erkannt | KRITISCH | ✅ BEHOBEN | useDeviceOrientation Hook |
| PTT Filter falsch | HOCH | ✅ BEHOBEN | CameraFunkPanel |
| Session Sync Fehler | HOCH | ⏳ OFFEN | CameraView, LiveSession |
| Orientierung im Cockpit | MITTEL | ⏳ OFFEN | CoachingCockpit |
| Kamera-Wechsel Race Condition | MITTEL | ⏳ OFFEN | CameraView |
| Message-Label fehlt | MITTEL | ⏳ OFFEN | FunkMessage Entity |
| Message-Order fragil | NIEDRIG | ⏳ OFFEN | FunkPanel |
| Audio-Fehlerbehandlung | NIEDRIG | ⏳ OFFEN | CameraView |
| Session-Cleanup nicht atomar | NIEDRIG | ⏳ OFFEN | LiveSession |
| iOS Pull-to-refresh | NIEDRIG | ⏳ OFFEN | CameraView |

---

## 🚀 NÄCHSTE SCHRITTE (PRIORITÄT)

1. **SOFORT:**
   - Session Sync implementieren (B)
   - Orientierung im CoachingCockpit integrieren (B)
   - iOS overscroll-behavior fixen (H)

2. **SEHR BALD:**
   - Kamera-Wechsel Race Condition (C)
   - Message-Order atomar machen (E)
   - Audio-Fehlerbehandlung (F)

3. **SPÄTER:**
   - Session-Cleanup Atomizität (G)
   - Message-Label Validation (D)