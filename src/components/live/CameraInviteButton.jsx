/**
 * CameraInviteButton — teilt den Kamera-Link per Share-Dialog, WhatsApp oder Zwischenablage
 */
import { useState } from 'react';
import { Share2, Copy, Check, MessageCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function CameraInviteButton({ code, position }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const url = `${window.location.origin}/cam?code=${code}&pos=${encodeURIComponent(position)}`;
  const message = `📹 Kamera-Assistent für "${position}"\n\nÖffne diesen Link auf deinem Handy und starte die Kamera:\n${url}\n\nOder gib Code ein: ${code}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  };

  const shareNative = async () => {
    if (navigator.share) {
      await navigator.share({ title: `Kamera: ${position}`, text: message, url });
      setOpen(false);
    }
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    setOpen(false);
  };

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 transition-all"
        title="Kameramann einladen"
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              className="absolute right-0 top-10 z-50 w-56 bg-card border border-border rounded-xl shadow-xl p-3 space-y-2"
            >
              <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2">
                Kameramann einladen · {position}
              </div>

              {/* URL Preview */}
              <div className="bg-muted rounded-lg px-2.5 py-1.5 text-[10px] text-primary font-mono break-all select-all">
                /cam?code={code}
              </div>

              <div className="space-y-1.5 pt-1">
                {/* Copy Link */}
                <button
                  onClick={copyLink}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary text-sm text-foreground transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Kopiert!' : 'Link kopieren'}
                </button>

                {/* WhatsApp */}
                <button
                  onClick={shareWhatsApp}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-sm transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Per WhatsApp senden
                </button>

                {/* Native Share (mobile) */}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={shareNative}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary text-sm text-foreground transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Teilen (System)
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}