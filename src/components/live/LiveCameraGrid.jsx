/**
 * LiveCameraGrid — Zeigt alle Kameras als Live-Feed-Grid
 * Thumbnail-Polling, Status-Badges, Share-Links, QR-Code
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Copy, Share2, Wifi, WifiOff, CheckCircle2, Smartphone } from 'lucide-react';
import AdaptiveStreamViewer from '@/components/live/AdaptiveStreamViewer';

function CameraFeed({ cam, sessionId, sessionTitle }) {
  const [copied, setCopied] = useState(false);
  const [connection, setConnection] = useState(null);

  // Subscribe to CameraConnection — Direct + Simple
  useEffect(() => {
    try {
      const unsubscribe = base44.entities.CameraConnection.subscribe((event) => {
        if (event.data?.session_id === sessionId && String(event.data?.camera_id) === String(cam.camera_id)) {
          console.log(`[CameraFeed ${cam.camera_id}] ✅ Heartbeat received:`, new Date(event.data.last_heartbeat).toLocaleTimeString());
          setConnection(event.data);
        }
      });
      return () => unsubscribe?.();
    } catch (err) {
      console.error('[CameraFeed] ❌ Subscribe failed:', err.message);
    }
  }, [sessionId, cam.camera_id]);

  // Initial load mit Retry
  useEffect(() => {
    const loadConnection = async () => {
      try {
        console.log(`[CameraFeed] 🔍 Loading connection for cam ${cam.camera_id} in session ${sessionId?.slice(0, 8)}...`);
        const c = await base44.entities.CameraConnection.filter({
          session_id: sessionId,
          camera_id: cam.camera_id,
        });
        if (c.length > 0) {
          console.log(`[CameraFeed ${cam.camera_id}] ✅ Found connection record`);
          setConnection(c[0]);
        } else {
          console.log(`[CameraFeed ${cam.camera_id}] ⏳ No connection record yet — waiting for first heartbeat...`);
        }
      } catch (err) {
        console.error(`[CameraFeed ${cam.camera_id}] ❌ Load failed:`, err.message);
      }
    };

    if (sessionId && cam.camera_id) {
      loadConnection();
      // Retry nach 5s falls noch nicht registriert
      const timeout = setTimeout(loadConnection, 5000);
      return () => clearTimeout(timeout);
    }
  }, [sessionId, cam.camera_id]);

  const thumbnail = connection?.thumbnail;
  const lastHeartbeatMs = connection?.last_heartbeat ? Date.now() - new Date(connection.last_heartbeat).getTime() : null;
  const isOnline = lastHeartbeatMs !== null && lastHeartbeatMs < 15000;
  const waitingForFirst = !connection && !thumbnail;
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
        isOnline ? 'border-green-500/40 bg-green-500/5' : waitingForFirst ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-border bg-muted/10'
      }`}
    >
      {/* Thumbnail oder Status */}
      <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {thumbnail ? (
          <img src={thumbnail} alt={cam.label} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-muted to-black">
            <Smartphone className="w-8 h-8 text-muted-foreground/60 mb-2" />
            <div className="text-xs text-muted-foreground text-center px-2">
              {isOnline ? 'Kamera aktiv' : waitingForFirst ? '⏳ Registrierung läuft...' : '⏳ Warte auf Heartbeat...'}
            </div>
          </div>
        )}
        {isOnline && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-600/90 text-white text-[10px] font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      {/* Info & Actions */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-foreground">{cam.label}</div>
            <div className="flex items-center gap-1 mt-0.5">
              {isOnline
                ? <><Wifi className="w-3 h-3 text-green-400" /><span className="text-[10px] text-green-400">✅ Verbunden</span></>
                : waitingForFirst
                  ? <><Wifi className="w-3 h-3 text-yellow-400 animate-pulse" /><span className="text-[10px] text-yellow-400">⏳ Registriert sich...</span></>
                  : <><WifiOff className="w-3 h-3 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">❌ Kein Signal</span></>
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

        {connection && (
          <div className="text-[10px] text-muted-foreground bg-muted/40 rounded p-1.5">
            {isOnline
              ? `✅ Heartbeat vor ${(lastHeartbeatMs / 1000).toFixed(0)}s`
              : `⏳ Letzter Heartbeat vor ${(lastHeartbeatMs / 1000).toFixed(0)}s`
            }
          </div>
        )}
        {waitingForFirst && (
          <div className="text-[10px] text-yellow-400 bg-yellow-500/10 rounded p-1.5 border border-yellow-500/20">
            💡 Kamera sollte auf den Link gehen: <code className="text-[9px] bg-black/30 px-1 rounded">{cam.code || 'CODE'}</code>
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