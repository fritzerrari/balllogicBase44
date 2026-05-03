# SYSTEM REDESIGN — PHASE 2: CRITICAL BUGS & ISSUES

**Datum:** 3. Mai 2026  
**Status:** IN PROGRESS  
**Kritikalität:** 🔴 BLOCKER (Production Failure)

---

## FEHLER #1: Double-File Architecture Problem
**Severity:** 🔴 CRITICAL  
**Impact:** Zwei LiveSession-Dateien führen zu Verwirrung und Duplikat-Code  

### Problem
- `pages/LiveSession.jsx` (Richtig, 540 Zeilen)
- `pages/IntegratedLiveSession.jsx` (Duplikat, 600+ Zeilen)
- Code in BEIDE Dateien geschrieben → Verwirrung
- Trainer nutzt falsche Datei → Features nicht sichtbar

### Lösung
✅ CONSOLIDATE: Eine einzige LiveSession.jsx behalten  
✅ REMOVE: IntegratedLiveSession.jsx löschen  
✅ VERIFY: Alle Features in LiveSession.jsx sein

---

## FEHLER #2: Hardcoded Possession Values
**Severity:** 🔴 CRITICAL  
**Impact:** Possession % ist FAKE (55/45), nicht echte Daten

### Problem  
```jsx
// LiveSession Zeile 507
<LiveStats stats={{ possession: { home: 55, away: 45 } }} />
// → HARDCODED! Nicht aus echten Daten
```

### Lösung
✅ Connect zu echtem `calculatePossession()` Backend  
✅ Real-time Update alle 30 Frames  
✅ Possession % aus TrackingData, nicht Mock

---

## FEHLER #3: Camera Links in WRONG Column
**Severity:** 🔴 CRITICAL  
**Impact:** Links nicht sichtbar auf Trainer-View (Responsive Bug)

### Problem
- LiveSession Zeile 349-388: CENTER Column
- Copy-Button + Share-Button ARE sichtbar
- BUT: Links könnten auf Mobile abgeschnitten sein
- Missing: Responsive Design für Mobile < 768px

### Lösung
✅ Add: Mobile-optimierte Link-Card  
✅ Fix: Grid Layout für Phones (lg:grid-cols-3 → md:grid-cols-1)  
✅ Test: Responsive auf iPhone 12, iPad

---

## FEHLER #4: Possession Change Detection ist FALSCH
**Severity:** 🔴 CRITICAL  
**Impact:** Events werden nicht erkannt, falsch erkannt oder NICHT GESPEICHERT

### Problem  
```jsx
// processFrame Zeile 546-563
if (frameHistory.length >= 2) {
  const prevFrame = frameHistory[frameHistory.length - 2];
  // frameHistory wird NACH diesem Check mit neuem Frame aktualisiert!
  // → Vergleich ist gegen EINEN Frame vorher, nicht gegen Anfang des Spiels
}
```

Issue: `frameHistory` ist MAX 10 Frames (FRAME_HISTORY_SIZE = 10)  
- Frame 1-10: History korrekt  
- Frame 11+: Alte Frames werden geworfen  
- POSSESSION WIRD FALSCH ERKANNT wenn > 10 Frames

### Lösung
✅ Use `SessionState` Entity statt In-Memory Array  
✅ Speichere LETZTEN Ballbesitzer als SESSION-STATE  
✅ Detect Change: curr !== session.last_possession_owner  
✅ Multi-Frame History im DB (SessionState.player_position_history)

---

## FEHLER #5: Auto-Events werden NICHT bei Possession-Change erstellt
**Severity:** 🔴 CRITICAL  
**Impact:** Trainers sehen keine automatischen Events → kein Tracking Feedback

### Problem
```jsx
// processFrame Zeile 682-683
if (possessionChangeEvent) {
  allEvents.push(possessionChangeEvent);
}
// Event saved ABER: Zu wenig Confidence-Filter
// Events mit < 60% confidence werden verworfen (Zeile 690)
// Possession-Events haben oft 50-70% confidence → unreliable
```

### Lösung
✅ Increase Minimum Confidence für Possession zu 50% (nicht 60%)  
✅ Add: Ballbesitz-Bestätigung über 3 Frames (Debouncing)  
✅ Save: Possession Change MIT Stack Trace (wer hat Ball wo)

---

## FEHLER #6: Frame Lock Timeout ist TOO SHORT
**Severity:** 🟡 HIGH  
**Impact:** Multi-Camera Sync bricht zusammen bei Latency > 10s

### Problem
```jsx
// processFrame Zeile 461
timeout_ms: 10000, // ← 10 Sekunden!
```

Bei 3 Kameras mit:
- Kamera 1: 2s
- Kamera 2: 3s  
- Kamera 3: 8s
- Lock times out nach 10s → Frame 4 von Kamera 3 wird geworfen

### Lösung
✅ Increase to 30000ms (30s) für cold-start Roboflow  
✅ Add: Adaptive timeout (current + 50% buffer)  
✅ Fallback: If no lock in 30s, force release (prevent deadlock)

---

## FEHLER #7: Roboflow Circuit Breaker ist PERMANENT nach Fehler
**Severity:** 🟡 HIGH  
**Impact:** Session bleibt broken für 30s selbst wenn Roboflow back online

### Problem
```jsx
// processFrame Zeile 64-65
if (s.failures >= CIRCUIT_BREAKER_THRESHOLD) {
  s.open = true; // ← STAYS OPEN!
}
// Reset nur nach 30s (CIRCUIT_BREAKER_RESET_MS)
// Während dieser 30s: KEINE Frames verarbeitet!
```

### Lösung
✅ Add: Health-Check Endpoint (quick ping Roboflow)  
✅ If health OK: Reset circuit sofort (nicht nach 30s)  
✅ Fallback: Use CACHED last good frame predictions wenn Circuit open

---

## FEHLER #8: Camera Coverage ist READONLY (kann nicht bearbeitet werden)
**Severity:** 🟡 HIGH  
**Impact:** Kameramann können Feldabdeckung nicht anpassen

### Problem
```jsx
// CameraView Zeile 312-315
<CameraCoverageVisualizer
  cameras={session.camera_streams || []}
  readOnly={true}  // ← HARDCODED!
/>
```

`CameraCoverageSetup` Component existiert (Polygon Editor) ABER:
- Ist NICHT in CameraView importiert  
- Ist NICHT in LiveSession verknüpft  
- Kamera-Männer können Coverage NICHT zeichnen

### Lösung
✅ Integrate: CameraCoverageSetup in CameraView  
✅ Add: Toggle zwischen Readonly (Trainer) vs Edit (Kameramann)  
✅ Save: Coverage Polygon zu LiveSession.camera_streams[i].coverage_polygon

---

## FEHLER #9: Latency Tracking ist FALSCH
**Severity:** 🟡 HIGH  
**Impact:** Latency-Anzeige zeigt Falsch-Werte

### Problem
```jsx
// CameraView Zeile 136-143
const clientSentTime = Date.now();
const res = await base44.functions.invoke('processFrame', { 
  client_sent_timestamp: clientSentTime,  
});
// Server speichert dies NICHT → Latenz nicht messbar
```

Server erhält `client_sent_timestamp` aber:
- Nutzt es nicht (Zeile 418: wird ignoriert)  
- Latency sollte: Server_Response_Time - Client_Sent_Time sein  
- Stattdessen: nur Processing_Time gerechnet

### Lösung
✅ Server: Echo back client_sent_timestamp in Response  
✅ Frontend: Calculate Latency = Date.now() - response.data.client_sent_timestamp  
✅ Save: Latency zu TrackingData (neues Feld: network_latency_ms)

---

## FEHLER #10: Multi-Camera Merging ist NICHT implementiert
**Severity:** 🟡 HIGH  
**Impact:** Mit 3+ Kameras: Spieler werden 3x erkannt (nicht gemergt)

### Problem
- `mergeMultiCameraDetections()` Backend Function existiert  
- ABER: wird NIRGENDS aufgerufen!  
- Jede Kamera speichert eigene TrackingData  
- Spieler 10 wird als 3 verschiedene Spieler erkannt (eine pro Kamera)

### Lösung
✅ Call: mergeMultiCameraDetections() nach JEDEM Frame  
✅ Logic: Match tracker_ids across Kameras (same player?)  
✅ Save: Merged Position (aggregated from 3 cameras)

---

## FEHLER #11: DSGVO Manager ist OPTIONAL (sollte MANDATORY sein)
**Severity:** 🟡 HIGH  
**Impact:** COMPLIANCE RISK — Minderjaährige ohne Einwilligung werden getracked

### Problem
```jsx
// LiveSession Zeile 35
const [showDsgvo, setShowDsgvo] = useState(false);
// Wird NICHT auf true automatisch gesetzt!
// Kein Modal beim Session-Start
// Spieler < 18 können getracked werden ohne Einwilligung
```

### Lösung
✅ Check: Am Session-Start: Gibt es U18-Spieler?  
✅ If yes: Modal ZEIGEN (blockier until Einwilligung/Anonymisierung)  
✅ Fallback: Anonymous-Tracking wenn keine Einwilligung

---

## FEHLER #12: Possession Percentage wird NICHT updated
**Severity:** 🔴 CRITICAL  
**Impact:** LiveStats zeigt immer 55/45 (nicht real)

### Problem
```jsx
// LiveStats Component erhält STATISCHE Props:
<LiveStats stats={{ possession: { home: 55, away: 45 } }} />
// Ist hardcoded, NICHT dynamisch
```

Backend-Funktionen:
- `calculatePossession()` ✓  
- `assignBallPossession()` ✓  
- ABER: Frontend nutzt sie NICHT

### Lösung
✅ Create: usePossession Hook (subscribes zu TrackingData)  
✅ Real-time: Update possession% alle 30 Frames  
✅ Save: Possession zu SessionState (letzte 5-minute Rolling Average)

---

## FEHLER #13: Field Coverage Detection ist UNRELIABLE
**Severity:** 🟡 HIGH  
**Impact:** Coverage wird nicht erkannt → Blind spots nicht sichtbar

### Problem
```jsx
// CameraView Zeile 156-157
if (!fieldBoundsDetected && frameNumber === 1) {
  // Nur beim ersten Frame!
  // Wenn Frame 1 fehlschlägt → nie wieder versucht
}
```

`detectCameraFieldBounds()` wird nur EINMAL aufgerufen:
- Kann fehlschlagen (bad lighting, camera not ready)  
- Wird dann NICHT wiederholt  
- Coverage bleibt unbekannt

### Lösung
✅ Retry: Versuche bis Frame 30 (wenn noch nicht detected)  
✅ Fallback: Use Heuristics (Kamera Position + Angle)  
✅ Save: Coverage_Polygon mit Confidence (0-100)

---

## FEHLER #14: Event Deduplication ist TOO AGGRESSIVE
**Severity:** 🟡 MEDIUM  
**Impact:** Echte Events werden als Duplikate markiert

### Problem
```jsx
// EventButtons Zeile 32
const DEDUP_WINDOW_MS = 10000; // 10 Sekunden
```

Zwei echte Corner-Kicks mit 8s Abstand:
- Erste: Gespeichert ✓  
- Zweite: Duplikat-Flag (weil innerhalb 10s)  
- Trainer muss manuell korrigieren

### Lösung
✅ Context-based: Dedup nur gleicher type + team + minute  
✅ Smart: Wenn Ball Position sich ändert → KEIN Duplikat  
✅ Increase: DEDUP_WINDOW auf 20s (aber smarter Logic)

---

## FEHLER #15: Tracking Data wird NICHT Live an UI gefeedback
**Severity:** 🟡 HIGH  
**Impact:** Trainer sieht Tracking erst nach 15-20s Delay

### Problem
```jsx
// LiveTrackingPanel Zeile 21-27
const { data: autoEvents = [] } = useQuery({
  queryFn: () => base44.entities.AutoEvent.filter({ session_id: sessionId }),
  refetchInterval: 15000, // ← 15s!
  staleTime: 10000,
});
```

Polling-Interval ist 15 Sekunden:
- Neue Events erscheinen erst nach bis zu 15s  
- Heatmaps werden erst nach 20s aktualisiert  
- Trainer verliert zeitliche Beziehung zu Match

### Lösung
✅ WebSocket: Real-time Subscription (nicht Polling)  
✅ Fallback Polling: 2-3s wenn WebSocket nicht verfügbar  
✅ Instant: Push Updates sobald Frame processed

---

## ZUSAMMENFASSUNG DER FIXES

| # | Issue | Fix | Time |
|---|-------|-----|------|
| 1 | Double-File | Consolidate zu 1 LiveSession | 10min |
| 2 | Hardcoded Possession | Connect zu Backend | 20min |
| 3 | Camera Links | Mobile Responsive Fix | 15min |
| 4 | Possession Change Detection | SessionState Database | 30min |
| 5 | Auto-Events | Confidence & Debouncing | 25min |
| 6 | Frame Lock Timeout | Increase + Adaptive | 15min |
| 7 | Circuit Breaker | Health-Check Reset | 20min |
| 8 | Camera Coverage | Integration + Editor | 40min |
| 9 | Latency Tracking | Echo Timestamp | 20min |
| 10 | Multi-Camera Merge | Call Function | 15min |
| 11 | DSGVO Manager | Auto-trigger at Session | 25min |
| 12 | Possession Stats | usePossession Hook | 20min |
| 13 | Field Detection | Retry Logic | 20min |
| 14 | Event Dedup | Smart Context Logic | 20min |
| 15 | Real-time Tracking | WebSocket + Polling | 45min |

**TOTAL: ~5-6 Stunden intensive Fehlerbe­hebung**

---

**NEXT:** Beginne mit Fehler #1-15 SOFORT