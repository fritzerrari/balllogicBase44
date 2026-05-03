# Automation Setup für Auto-Tracking

## Scheduled Automations (erstellen Sie diese im Admin-Panel)

### 1. Apply Tracking Corrections
**Name:** Apply Tracking Corrections  
**Type:** Scheduled  
**Function:** applyTrackingCorrections  
**Interval:** Alle 60 Sekunden  
**Payload:**
```json
{
  "session_id": "$active_session_id"
}
```

### 2. Calculate Possession Streaming (Real-time)
**Name:** Calculate Possession Streaming  
**Type:** Scheduled  
**Function:** calculatePossessionStreaming  
**Interval:** Alle 3 Frames (~1-2 Sekunden)  
**Payload:**
```json
{
  "session_id": "$active_session_id",
  "lookback_frames": 50
}
```

### 3. Update Heatmap Cache (Real-time)
**Name:** Update Heatmap Cache  
**Type:** Scheduled  
**Function:** updateHeatmapStreamingCache  
**Interval:** Alle 10 Frames (~3-5 Sekunden)  
**Payload:**
```json
{
  "session_id": "$active_session_id"
}
```

### 4. Validate Tracking Quality
**Name:** Validate Tracking Quality  
**Type:** Scheduled  
**Function:** validateTrackingQuality  
**Interval:** Alle 30 Sekunden  
**Payload:**
```json
{
  "session_id": "$active_session_id",
  "alert_threshold": 40
}
```

---

## Entity Automations (Auto-triggered)

### 5. On TrackingCorrection Created
**Name:** On Tracking Correction  
**Type:** Entity  
**Entity:** TrackingCorrection  
**Events:** create  
**Function:** applyTrackingCorrections  

Wird automatisch ausgelöst wenn neue Korrektur erstellt wird.

---

## Manual Control Points

**AutomationControlPanel** ermöglicht dem Trainer:
- ✅ Possession-Automations an/aus
- ✅ Event-Automations an/aus
- ✅ Formation-Erkennung an/aus
- ✅ Heatmap-Generation an/aus
- ✅ Manuelle Korrektionen eingeben mit Grund

**EventApprovalPanel** zeigt:
- ✅ Auto-erkannte Events (nur unapproved)
- ✅ Approve/Reject Buttons
- ✅ Confidence Score
- ✅ Event-Details

---

## Correction Workflow

1. **Trainer sieht falsch erkanntes Event** in EventApprovalPanel
2. **Klickt "Nein" oder "Abbrechen"** → Event als rejected markiert
3. **Oder: Event ignorieren** und später in AutomationControlPanel Korrektur hinzufügen
4. **applyTrackingCorrections** läuft alle 60s und wendet alle ausstehenden Korrektionen an
5. **SessionState wird mit Korrektionen aktualisiert** für künftige Frames
6. **Audit Trail:** Alle Korrektionen werden in TrackingCorrection Entity gespeichert mit:
   - Original-Wert
   - Korrigierter Wert
   - Grund
   - Trainer E-Mail
   - Timestamp

---

## Performance

- **Real-time Tracking:** Keine Verzögerung (läuft in processFrame)
- **Possession Updates:** 3 Sekunden (calculatePossessionStreaming)
- **Heatmap Updates:** 5 Sekunden (updateHeatmapStreamingCache)
- **Correction Application:** 60 Sekunden (applyTrackingCorrections)
- **Event Approval:** Sofort sichtbar (keine Verzögerung)

---

## Deaktivieren von Automations

Trainer kann per Toggle in AutomationControlPanel ausschalten:
- `automations.possession` = false → Keine Possession-Updates
- `automations.events` = false → Keine Auto-Events
- `automations.formation` = false → Keine Formation-Erkennung
- `automations.heatmap` = false → Keine Heatmap-Updates

Diese Settings sollten in SessionState gespeichert werden für persistency.