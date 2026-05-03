/**
 * CoveragePitchOverlay — Zeichnet Kamera-Abdeckungsbereiche auf Spielfeld
 * 
 * Zeigt pro Kamera ein Polygon mit:
 * - Unterschiedliche Farben pro Kamera
 * - Transparenz für Overlap-Bereiche
 * - Labels mit Kamera-Namen
 */

import { useEffect, useRef } from 'react';

export default function CoveragePitchOverlay({ 
  cameras = [], 
  canvasWidth = 700,
  canvasHeight = 460,
}) {
  const canvasRef = useRef(null);

  const cameraColors = {
    '1': 'rgba(52, 211, 153, 0.2)',   // primary grün
    '2': 'rgba(59, 130, 246, 0.2)',   // blue
    '3': 'rgba(249, 115, 22, 0.2)',   // orange
    '4': 'rgba(168, 85, 247, 0.2)',   // purple
  };

  const cameraBorders = {
    '1': 'rgba(52, 211, 153, 0.6)',
    '2': 'rgba(59, 130, 246, 0.6)',
    '3': 'rgba(249, 115, 22, 0.6)',
    '4': 'rgba(168, 85, 247, 0.6)',
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cameras.length === 0) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    cameras.forEach((cam, idx) => {
      if (!cam.coverage_polygon || cam.coverage_polygon.length < 3) return;

      const polygonPoints = cam.coverage_polygon.map(p => ({
        x: (p.x / 100) * canvasWidth,
        y: (p.y / 100) * canvasHeight,
      }));

      const camId = cam.camera_id || (idx + 1).toString();
      const fillColor = cameraColors[camId] || `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.2)`;
      const borderColor = cameraBorders[camId] || 'rgba(255, 255, 255, 0.6)';

      // Polygon zeichnen
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
      polygonPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Kamera-Label
      const centerX = polygonPoints.reduce((sum, p) => sum + p.x, 0) / polygonPoints.length;
      const centerY = polygonPoints.reduce((sum, p) => sum + p.y, 0) / polygonPoints.length;

      ctx.fillStyle = borderColor;
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cam.label || `Kamera ${camId}`, centerX, centerY);
    });
  }, [cameras, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}