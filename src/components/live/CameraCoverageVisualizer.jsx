/**
 * CameraCoverageVisualizer — Zeigt Kamera-Positionen + Feldabdeckung grafisch
 * 
 * Speichert in LiveSession.camera_streams:
 * - position_x, position_y (Kamera-Position auf Spielfeld %)
 * - view_angle (Blickwinkel 0-180°)
 * - coverage_polygon (Auto-detected oder manuell definiert)
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CameraCoverageVisualizer({ cameras, onSave, readOnly = true }) {
  const canvasRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [selectedCam, setSelectedCam] = useState(null);
  const [editData, setEditData] = useState({});

  // Draw pitch + camera positions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Pitch background
    ctx.fillStyle = '#0d260d';
    ctx.fillRect(0, 0, W, H);

    // Field lines
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.beginPath();
    ctx.moveTo(W / 2, 20);
    ctx.lineTo(W / 2, H - 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 40, 0, Math.PI * 2);
    ctx.stroke();

    // Draw camera positions + coverage
    cameras.forEach((cam, idx) => {
      const px = (cam.position_x ?? 50) / 100 * W;
      const py = (cam.position_y ?? 50) / 100 * H;
      const angle = (cam.view_angle ?? 60) * Math.PI / 180;

      // Coverage polygon
      if (cam.coverage_polygon?.length > 0) {
        ctx.fillStyle = `rgba(${52 + idx * 30}, ${211 - idx * 20}, ${100}, 0.15)`;
        ctx.beginPath();
        cam.coverage_polygon.forEach((pt, i) => {
          const x = pt.x / 100 * W;
          const y = pt.y / 100 * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
      }

      // Camera position
      ctx.fillStyle = selectedCam?.camera_id === cam.camera_id ? '#fbbf24' : '#4ade80';
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = 'white';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(cam.label.split(' ')[1] || cam.camera_id, px, py - 15);
    });
  }, [cameras, selectedCam]);

  const handleSave = () => {
    const updatedCameras = cameras.map(cam =>
      cam.camera_id === selectedCam?.camera_id
        ? { ...cam, ...editData }
        : cam
    );
    onSave?.(updatedCameras);
    setEditing(false);
    setSelectedCam(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass rounded-xl p-4 space-y-3"
    >
      <div className="text-sm font-grotesk font-semibold text-foreground flex items-center gap-2">
        📍 Feldabdeckung (Kamera-Positionen)
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="w-full border border-border rounded-lg cursor-pointer"
        onClick={(e) => {
          if (readOnly) return;
          const canvas = canvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          setEditData({ position_x: Math.round(x), position_y: Math.round(y) });
        }}
      />

      {/* Kamera-Liste */}
      <div className="space-y-2">
        {cameras.map(cam => (
          <div
            key={cam.camera_id}
            onClick={() => setSelectedCam(cam)}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedCam?.camera_id === cam.camera_id
                ? 'bg-primary/20 border-primary/40'
                : 'bg-muted border-border hover:border-primary/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold">{cam.label}</div>
              {!readOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCam(cam);
                    setEditData({ position_x: cam.position_x, position_y: cam.position_y, view_angle: cam.view_angle });
                    setEditing(true);
                  }}
                  className="text-primary hover:text-primary/80"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Position: {cam.position_x}% × {cam.position_y}% | Winkel: {cam.view_angle}°
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && selectedCam && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="glass rounded-xl p-6 max-w-sm w-full space-y-4">
            <div className="text-sm font-bold">{selectedCam.label} – Position bearbeiten</div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Position X: {editData.position_x}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editData.position_x || 50}
                  onChange={e => setEditData({ ...editData, position_x: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Position Y: {editData.position_y}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editData.position_y || 50}
                  onChange={e => setEditData({ ...editData, position_y: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Blickwinkel: {editData.view_angle || 60}°
                </label>
                <input
                  type="range"
                  min="30"
                  max="180"
                  value={editData.view_angle || 60}
                  onChange={e => setEditData({ ...editData, view_angle: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground gap-2">
                <Save className="w-4 h-4" /> Speichern
              </Button>
              <Button onClick={() => setEditing(false)} variant="outline">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}