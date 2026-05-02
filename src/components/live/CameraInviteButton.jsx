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

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 1500);
  };

  const copyFullLink = async () => {
    await navigator.clipboard.writeText(url);
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
            {/* Dialog — centered auf viewport mit Padding */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-grotesk font-bold text-foreground">Kameramann einladen</div>
                  <div className="text-sm text-muted-foreground mt-1">{position}</div>
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Code Display */}
              <div className="space-y-3 p-5 bg-primary/5 rounded-2xl border-2 border-primary/20">
                <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest">6-stelliger Code:</div>
                <div className="text-5xl font-grotesk font-bold text-primary tracking-[0.3em] text-center select-all py-2">
                  {code}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {/* Copy Code */}
                <button
                  onClick={copyCode}
                  className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-base font-bold transition-all neon-glow"
                >
                  {copied ? <><Check className="w-5 h-5" /> Kopiert!</> : <><Copy className="w-5 h-5" /> Code kopieren</>}
                </button>

                {/* Copy Full Link */}
                <button
                  onClick={copyFullLink}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary/10 border-2 border-primary/30 text-primary hover:bg-primary/20 text-base font-bold transition-all"
                >
                  {copied ? <><Check className="w-5 h-5" /> Link kopiert!</> : <><Copy className="w-5 h-5" /> Link kopieren</>}
                </button>

                {/* WhatsApp */}
                <button
                  onClick={shareWhatsApp}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-base font-bold transition-all border-2 border-[#25D366]/30"
                >
                  <MessageCircle className="w-5 h-5" />
                  Per WhatsApp senden
                </button>

                {/* Native Share (mobile) */}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={shareNative}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-base font-bold transition-all border-2 border-border"
                  >
                    <Share2 className="w-5 h-5" />
                    Systemteilen
                  </button>
                )}
              </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}