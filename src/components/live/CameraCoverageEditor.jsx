/**
 * CameraCoverageEditor — Interactive Polygon Editor für Feldabdeckung
 * Kameramann können ihre Feldabdeckung auf dem Spielfeld zeichnen
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, RotateCcw, Check } from 'lucide-react';

export default function CameraCoverageEditor({ 
  sessionId, 
  cameraId,
  initialPolygon = [],
  onSave,
  onCancel
}) {
  const canvasRef = useRef(null);
  const [polygon, setPolygon] = useState(initialPolygon || []);
  const [saving, setSaving] = useState(false);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    // Clamp to field bounds
    const point = {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };

    setPolygon([...polygon, point]);
  };

  const handleUndo = () => {
    setPolygon(polygon.slice(0, -1));
  };

  const handleReset = () => {
    setPolygon([]);
  };

  const handleSave = async () => {
    if (polygon.length < 3) {
      alert('⚠️ Mindestens 3 Punkte erforderlich');
      return;
    }

    setSaving(true);
    try {
      const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
      if (sessions[0]) {
        const updated = sessions[0].camera_streams.map(s =>
          String(s.camera_id) === String(cameraId)
            ? { ...s, coverage_polygon: polygon }
            : s
        );
        await base44.entities.LiveSession.update(sessions[0].id, { camera_streams: updated });
        onSave?.(polygon);
      }
    } catch (err) {
      alert('❌ Fehler beim Speichern: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Draw canvas
  useState(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Field background
    ctx.fillStyle = '#0d260d';
    ctx.fillRect(0, 0, w, h);

    // Field lines
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 15, w - 40, h - 30);
    ctx.beginPath();
    ctx.moveTo(w / 2, 15);
    ctx.lineTo(w / 2, h - 15);
    ctx.stroke();

    // Draw polygon
    if (polygon.length > 0) {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;

      ctx.beginPath();
      polygon.forEach((p, i) => {
        const px = (p.x / 100) * w;
        const py = (p.y / 100) * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      if (polygon.length > 2) {
        ctx.lineTo((polygon[0].x / 100) * w, (polygon[0].y / 100) * h);
      }
      ctx.fill();
      ctx.stroke();

      // Draw points
      polygon.forEach((p, i) => {
        const px = (p.x / 100) * w;
        const py = (p.y / 100) * h;
        ctx.fillStyle = i === polygon.length - 1 ? '#4ade80' : 'rgba(76, 175, 80, 0.7)';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Number
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), px, py);
      });
    }
  });

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-muted-foreground">
        Klick auf das Spielfeld um Feldabdeckung zu zeichnen ({polygon.length}/4 Punkte)
      </div>

      <canvas
        ref={canvasRef}
        width={400}
        height={260}
        onClick={handleCanvasClick}
        className="w-full border border-green-500/40 rounded-lg cursor-crosshair bg-black"
      />

      <div className="flex gap-2 text-xs">
        <Button
          onClick={handleUndo}
          disabled={polygon.length === 0}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          ↶ Zurück
        </Button>
        <Button
          onClick={handleReset}
          disabled={polygon.length === 0}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          <X className="w-3 h-3" /> Abbrechen
        </Button>
        <Button
          onClick={handleSave}
          disabled={polygon.length < 3 || saving}
          className="flex-1 bg-green-600"
        >
          <Check className="w-3 h-3" /> Speichern
        </Button>
      </div>

      {polygon.length > 0 && (
        <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
          Punkte: {polygon.map(p => `(${p.x},${p.y})`).join(' → ')}
        </div>
      )}
    </div>
  );
}