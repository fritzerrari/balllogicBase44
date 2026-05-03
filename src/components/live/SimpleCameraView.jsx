/**
 * SimpleCameraView — Vereinfachte Kamera-Anzeige ohne interner State-Verwaltung
 * 
 * Props kommen von CameraStreamManager (parent)
 * Nur noch Darstellung + Kopieren von Links
 */
import { Camera, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function SimpleCameraView({ camera, status = 'waiting', liveUrl, sessionId }) {
  const [copied, setCopied] = useState(false);

  const camUrl = `${liveUrl}?session=${sessionId}&cam=${camera.camera_id}`;

  const copyLink = () => {
    navigator.clipboard.writeText(camUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = {
    connected: 'bg-primary text-primary-foreground border-primary/50',
    waiting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    offline: 'bg-red-500/20 text-red-400 border-red-500/40',
  }[status] || 'bg-muted border-border text-muted-foreground';

  const statusText = {
    connected: '🟢 Verbunden',
    waiting: '🟡 Wartet',
    offline: '🔴 Offline',
  }[status] || 'Status unbekannt';

  return (
    <div className="glass rounded-xl p-3 border border-border space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Camera className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground truncate">
              {camera.label || `Kamera ${camera.camera_id}`}
            </div>
            <div className={`text-[10px] font-mono truncate`}>
              {camUrl.replace('http://', '').replace('https://', '')}
            </div>
          </div>
        </div>
        <button
          onClick={copyLink}
          className="p-1.5 rounded-lg bg-background border border-border text-muted-foreground hover:text-primary transition-all flex-shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs font-bold ${statusColor}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-current animate-pulse' : 'bg-current'}`} />
        {statusText}
      </div>
    </div>
  );
}