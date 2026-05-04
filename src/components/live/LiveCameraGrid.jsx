/**
 * LiveCameraGrid — Zeigt alle Kameras als Live-Feed-Grid
 * Thumbnail-Polling, Status-Badges, Share-Links, QR-Code
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Copy, Share2, Wifi, WifiOff, CheckCircle2, Smartphone } from 'lucide-react';
import AdaptiveStreamViewer from '@/components/live/AdaptiveStreamViewer';

function CameraFeed({ cam, sessionId, sessionTitle }) {
  const [copied, setCopied] = useState(false);

  const { data: liveSession } = useQuery({
    queryKey: ['cam-feed', sessionId, cam.camera_id],
    queryFn: () => base44.entities.LiveSession.filter({ id: sessionId }).then(r => r[0]),
    refetchInterval: 20000,
    staleTime: 15000,
  });

  const liveCam = liveSession?.camera_streams?.find(c => String(c.camera_id) === String(cam.camera_id));
  const thumbnail = liveCam?.thumbnail;
  const lastSeenMs = liveCam?.last_seen ? Date.now() - new Date(liveCam.last_seen).getTime() : null;
  const isOnline = lastSeenMs !== null && lastSeenMs < 15000;
  const camLink = `${window.location.origin}/cam?session=${sessionId}&cam=${cam.camera_id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(camLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const msg = `🎥 Kamera-Link für "${sessionTitle}":\n${camLink}`;
    if (navigator.share) {
      navigator.share({ title: 'Kamera-Link', text: msg }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl overflow-hidden border flex flex-col ${
        isOnline ? 'border-green-500/40 bg-green-500/5' : 'border-border bg-muted/10'
      }`}
    >
      {/* Adaptive Frame Capture — Stable Streaming */}
      <AdaptiveStreamViewer
        sessionId={sessionId}
        cameraId={cam.camera_id}
        onStatusChange={(status) => {
          if (status.status === 'streaming') {
            // Kamera erfolgreich aktiv
          }
        }}
      />

      {/* Info & Actions */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-foreground">{cam.label}</div>
            <div className="flex items-center gap-1 mt-0.5">
              {isOnline
                ? <><Wifi className="w-3 h-3 text-green-400" /><span className="text-[10px] text-green-400">Verbunden</span></>
                : <><WifiOff className="w-3 h-3 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Nicht verbunden</span></>
              }
            </div>
          </div>
          {isOnline && <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />}
        </div>

        {/* Code + Buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={handleCopy}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              copied ? 'bg-green-600 text-white' : 'bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25'
            }`}
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Kopiert!' : 'Link'}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-blue-600/15 text-blue-400 border border-blue-600/30 hover:bg-blue-600/25 transition-all"
          >
            <Share2 className="w-3 h-3" />
            Teilen
          </button>
        </div>

        {!isOnline && (
          <div className="text-[10px] text-muted-foreground bg-muted/40 rounded p-1.5 break-all font-mono">
            {camLink}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function LiveCameraGrid({ session }) {
  const cameras = session?.camera_streams || [];

  if (cameras.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center border border-border">
        <Smartphone className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <div className="text-sm font-medium text-muted-foreground">Keine Kameras konfiguriert</div>
        <div className="text-xs text-muted-foreground/60 mt-1">Session neu starten und Kameraanzahl wählen</div>
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${cameras.length === 1 ? 'grid-cols-1' : cameras.length === 2 ? 'grid-cols-2' : cameras.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {cameras.map(cam => (
        <CameraFeed
          key={cam.camera_id}
          cam={cam}
          sessionId={session.id}
          sessionTitle={session.match_title}
        />
      ))}
    </div>
  );
}