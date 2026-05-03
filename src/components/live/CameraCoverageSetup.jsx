/**
 * CameraCoverageSetup — Grafisches Setup für Kamerabereiche auf dem Spielfeld
 * Trainer kann Kameras positionieren + deren Blickfelder zeichnen
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Save, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CameraCoverageSetup({ cameras, onSave }) {
  const canvasRef = useRef(null);
  const [selectedCam, setSelectedCam] = useState(null);
  const [drawMode, setDrawMode] = useState(null); // 'position' | 'polygon'
  const [tempPoints, setTempPoints] = useState([]);
  const [showPreview, setShowPreview] = useState(true);
  const [camConfig, setCamConfig] = useState(
    cameras.reduce((acc, cam) => ({
      ...acc,
      [cam.id]: {
        position_x: cam.position_x || 50,
        position_y: cam.position_y || 10,
        view_angle: cam.view_angle || 90,
        coverage_polygon: cam.coverage_polygon || [],
      },
    }), {})
  );

  // Canvas zeichnen
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Spielfeld Hintergrund
    ctx.fillStyle = '#0d260d';
    ctx.fillRect(0, 0, W, H);

    // Spielfeld-Linien
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 15, W - 40, H - 30);
    ctx.beginPath();
    ctx.moveTo(W / 2, 15);
    ctx.lineTo(W / 2, H - 15);
    ctx.stroke();

    // Zentrum
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Alle Kameras zeichnen
    cameras.forEach((cam) => {
      const cfg = camConfig[cam.id] || {};
      const px = (cfg.position_x / 100) * W;
      const py = (cfg.position_y / 100) * H;

      // Abdeckungsbereich (Polygon)
      if (cfg.coverage_polygon && cfg.coverage_polygon.length > 2) {
        ctx.fillStyle = 'rgba(142, 210, 100, 0.15)';
        ctx.beginPath();
        ctx.moveTo((cfg.coverage_polygon[0].x / 100) * W, (cfg.coverage_polygon[0].y / 100) * H);
        cfg.coverage_polygon.forEach((pt) => {
          ctx.lineTo((pt.x / 100) * W, (pt.y / 100) * H);
        });
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = selectedCam === cam.id ? 'rgba(142, 210, 100, 0.8)' : 'rgba(142, 210, 100, 0.4)';
        ctx.lineWidth = selectedCam === cam.id ? 2 : 1;
        ctx.stroke();
      }

      // Kamera-Position (Kreis + Nummer)
      ctx.fillStyle = selectedCam === cam.id ? '#4ade80' : '#6b7280';
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cam.id.toString(), px, py);

      // Blickwinkel andeuten
      if (cfg.view_angle && cfg.view_angle > 0) {
        const angle = (cfg.view_angle * Math.PI) / 180;
        const rayLength = 80;
        const leftAngle = -angle / 2;
        const rightAngle = angle / 2;

        ctx.strokeStyle = selectedCam === cam.id ? 'rgba(142, 210, 100, 0.6)' : 'rgba(142, 210, 100, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(
          px + Math.cos(leftAngle) * rayLength,
          py + Math.sin(leftAngle) * rayLength
        );
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(
          px + Math.cos(rightAngle) * rayLength,
          py + Math.sin(rightAngle) * rayLength
        );
        ctx.stroke();
      }
    });

    // Temporary polygon (während Zeichnen)
    if (tempPoints.length > 0) {
      ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo((tempPoints[0].x / 100) * W, (tempPoints[0].y / 100) * H);
      tempPoints.forEach((pt) => {
        ctx.lineTo((pt.x / 100) * W, (pt.y / 100) * H);
      });
      ctx.stroke();

      tempPoints.forEach((pt, i) => {
        ctx.fillStyle = 'rgba(255, 200, 100, 1)';
        ctx.beginPath();
        ctx.arc((pt.x / 100) * W, (pt.y / 100) * H, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [camConfig, cameras, selectedCam, tempPoints]);

  const handleCanvasClick = (e) => {
    if (!selectedCam || !drawMode) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (drawMode === 'position') {
      setCamConfig((prev) => ({
        ...prev,
        [selectedCam]: { ...prev[selectedCam], position_x: x, position_y: y },
      }));
      setDrawMode(null);
    } else if (drawMode === 'polygon') {
      setTempPoints((prev) => [...prev, { x, y }]);
    }
  };

  const finishPolygon = () => {
    if (tempPoints.length > 2) {
      setCamConfig((prev) => ({
        ...prev,
        [selectedCam]: { ...prev[selectedCam], coverage_polygon: tempPoints },
      }));
    }
    setTempPoints([]);
    setDrawMode(null);
  };

  const handleSave = () => {
    const updatedCameras = cameras.map((cam) => ({
      ...cam,
      ...camConfig[cam.id],
    }));
    onSave(updatedCameras);
  };

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div className="glass rounded-xl p-4 border border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-grotesk font-bold text-foreground">Spielfeld & Kamerabereiche</h3>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors"
          >
            {showPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
        {showPreview && (
          <canvas
            ref={canvasRef}
            width={700}
            height={460}
            onClick={handleCanvasClick}
            className="w-full border border-border/50 rounded-lg cursor-crosshair"
          />
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Klick auf Kamera → Position setzen → Abdeckungsbereich zeichnen
        </p>
      </div>

      {/* Kamera-Einstellungen */}
      <div className="glass rounded-xl p-4">
        <h3 className="font-grotesk font-bold text-foreground mb-3">Kameras konfigurieren</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {cameras.map((cam) => {
            const cfg = camConfig[cam.id] || {};
            return (
              <div
                key={cam.id}
                onClick={() => setSelectedCam(cam.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedCam === cam.id
                    ? 'bg-primary/10 border-primary/40'
                    : 'bg-muted/50 border-border hover:border-primary/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">#{cam.id} {cam.label}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawMode(drawMode === 'position' ? null : 'position');
                      }}
                      className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                        drawMode === 'position'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted border border-border text-muted-foreground'
                      }`}
                    >
                      📍 Position
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (drawMode === 'polygon') {
                          finishPolygon();
                        } else {
                          setDrawMode('polygon');
                          setTempPoints([]);
                        }
                      }}
                      className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                        drawMode === 'polygon'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted border border-border text-muted-foreground'
                      }`}
                    >
                      {drawMode === 'polygon' ? '✓ Fertig' : '📐 Bereich'}
                    </button>
                  </div>
                </div>

                {/* Inputs */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-muted-foreground block mb-0.5">X %</label>
                    <input
                      type="number"
                      value={Math.round(cfg.position_x || 0)}
                      onChange={(e) =>
                        setCamConfig((prev) => ({
                          ...prev,
                          [cam.id]: { ...prev[cam.id], position_x: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full bg-background border border-input rounded px-2 py-1 text-xs"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-0.5">Y %</label>
                    <input
                      type="number"
                      value={Math.round(cfg.position_y || 0)}
                      onChange={(e) =>
                        setCamConfig((prev) => ({
                          ...prev,
                          [cam.id]: { ...prev[cam.id], position_y: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full bg-background border border-input rounded px-2 py-1 text-xs"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-0.5">Winkel °</label>
                    <input
                      type="number"
                      value={Math.round(cfg.view_angle || 90)}
                      onChange={(e) =>
                        setCamConfig((prev) => ({
                          ...prev,
                          [cam.id]: { ...prev[cam.id], view_angle: parseFloat(e.target.value) || 90 },
                        }))
                      }
                      className="w-full bg-background border border-input rounded px-2 py-1 text-xs"
                      min="30"
                      max="180"
                    />
                  </div>
                </div>

                {cfg.coverage_polygon && cfg.coverage_polygon.length > 0 && (
                  <div className="mt-2 text-[10px] text-primary">
                    ✓ Abdeckungsbereich mit {cfg.coverage_polygon.length} Punkten definiert
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <Button onClick={handleSave} className="w-full bg-primary text-primary-foreground gap-2">
        <Save className="w-4 h-4" /> Kamerabereiche speichern
      </Button>
    </div>
  );
}