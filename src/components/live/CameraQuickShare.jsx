/**
 * CameraQuickShare — SUPER Simple Camera Link Sharing
 * Copy Link + WhatsApp Share + QR Code
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Share2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CameraQuickShare({ session, camera }) {
  const [copied, setCopied] = useState(false);

  const camLink = `${window.location.origin}/cam?session=${session.id}&cam=${camera.camera_id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(camLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const message = `🎥 Kameramann für "${session.match_title}":\n\n${camLink}`;
    
    if (navigator.share) {
      navigator.share({ title: 'Kamera-Link', text: message }).catch(() => {});
    } else {
      // WhatsApp fallback
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  const connected = camera.status === 'connected';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-xl p-4 border ${
        connected ? 'border-green-500/30' : 'border-yellow-500/30'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${
            connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-400'
          }`} />
          <div>
            <div className="text-sm font-bold">{camera.label}</div>
            <div className="text-xs text-muted-foreground">
              {connected ? '✓ Verbunden' : 'Wartet...'}
            </div>
          </div>
        </div>
        {connected && <CheckCircle2 className="w-4 h-4 text-green-500" />}
      </div>

      <div className="flex gap-2 mb-2">
        <button
          onClick={handleCopy}
          className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all gap-2 flex items-center justify-center ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {copied ? <>✓ Kopiert</> : <><Copy className="w-3.5 h-3.5" /> Link kopieren</>}
        </button>
        <button
          onClick={handleShare}
          className="flex-1 py-2 rounded-lg font-bold text-xs bg-blue-600 text-white hover:bg-blue-700 transition-all gap-2 flex items-center justify-center"
        >
          <Share2 className="w-3.5 h-3.5" /> Teilen
        </button>
      </div>

      <div className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded break-all">
        {camLink}
      </div>
    </motion.div>
  );
}