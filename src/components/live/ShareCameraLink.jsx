/**
 * ShareCameraLink — Modal zum Teilen des Kamera-Links
 * Per WhatsApp, SMS, QR-Code oder direktem Link
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check, MessageSquare, Smartphone, QrCode, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ShareCameraLink({ cam, liveUrl, onClose }) {
  const [copied, setCopied] = useState(false);
  const code = cam.code || cam.camera_id;
  const camUrl = `${liveUrl}?code=${code}`;

  const whatsappText = encodeURIComponent(
    `📹 *TactIQ Kamera-Assistent*\n\nHallo! Du wirst als Kameramann eingesetzt für: *${cam.label}*\n\n👉 Öffne diesen Link auf deinem Handy:\n${camUrl}\n\nOder gib diesen Code ein:\n🔢 *${code}*\n\nBitte halte das Handy stabil und sperr den Bildschirm nicht!`
  );

  const smsText = encodeURIComponent(`TactIQ Kamera: ${camUrl} Code: ${code}`);

  const copyLink = () => {
    navigator.clipboard.writeText(camUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="glass rounded-2xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-grotesk font-bold text-foreground">Kamera einladen</h2>
            <p className="text-xs text-muted-foreground">{cam.label}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Code display */}
        <div className="bg-muted rounded-xl p-4 text-center mb-5">
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">6-stelliger Code</div>
          <div className="text-4xl font-grotesk font-bold text-primary tracking-[0.3em]">{code}</div>
          <div className="text-xs text-muted-foreground mt-2">Assistent gibt diesen Code auf TactIQ ein</div>
        </div>

        {/* Share buttons */}
        <div className="space-y-2 mb-4">
          {/* WhatsApp */}
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/25 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <span className="text-sm font-medium">Per WhatsApp senden</span>
          </a>

          {/* SMS */}
          <a
            href={`sms:?body=${smsText}`}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-all"
          >
            <Smartphone className="w-5 h-5" />
            <span className="text-sm font-medium">Per SMS senden</span>
          </a>

          {/* Copy link */}
          <button
            onClick={copyLink}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          >
            {copied ? <Check className="w-5 h-5 text-primary" /> : <Copy className="w-5 h-5" />}
            <span className="text-sm font-medium">{copied ? 'Link kopiert!' : 'Link kopieren'}</span>
          </button>

          {/* Open in new tab (for testing) */}
          <a
            href={camUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-all"
          >
            <ExternalLink className="w-5 h-5" />
            <span className="text-sm font-medium">Link öffnen (Test)</span>
          </a>
        </div>

        {/* URL preview */}
        <div className="bg-muted rounded-lg px-3 py-2">
          <div className="text-[10px] text-muted-foreground mb-0.5">Direkt-Link</div>
          <div className="text-xs text-primary break-all font-mono">{camUrl}</div>
        </div>

        <div className="mt-4 text-[10px] text-muted-foreground text-center">
          💡 Assistent muss kein Konto haben · Einfach Link öffnen & Code eingeben
        </div>
      </motion.div>
    </motion.div>
  );
}