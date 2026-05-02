/**
 * CameraInviteButton — teilt den Kamera-Link per Share-Dialog, WhatsApp oder Zwischenablage
 */
import { useState } from 'react';
import { Share2, Copy, Check, MessageCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function CameraInviteButton({ code, position }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const url = `${window.location.origin}/cam?code=${code}&pos=${encodeURIComponent(position)}`;
  const message = `📹 Kamera-Assistent für "${position}"\n\nÖffne diesen Link auf deinem Handy und starte die Kamera:\n${url}\n\nOder gib Code ein: ${code}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 1500);
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
    <div className="flex-shrink-0">
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
            <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
            {/* Dialog — centered auf viewport */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-96 bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-grotesk font-bold text-foreground">Kameramann einladen</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{position}</div>
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* URL Preview */}
              <div className="space-y-2 p-3 bg-muted rounded-lg border border-border/50">
                <div className="text-[10px] text-muted-foreground font-bold">6-stelliger Code:</div>
                <div className="text-2xl font-grotesk font-bold text-primary tracking-widest text-center select-all">
                  {code}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {/* Copy Code */}
                <button
                  onClick={copyLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all"
                >
                  {copied ? <><Check className="w-4 h-4" /> Kopiert!</> : <><Copy className="w-4 h-4" /> Code kopieren</>}
                </button>

                {/* WhatsApp */}
                <button
                  onClick={shareWhatsApp}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-sm font-bold transition-all border border-[#25D366]/20"
                >
                  <MessageCircle className="w-4 h-4" />
                  Per WhatsApp senden
                </button>

                {/* Native Share (mobile) */}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={shareNative}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-sm font-bold transition-all border border-border"
                  >
                    <Share2 className="w-4 h-4" />
                    Systemteilen
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