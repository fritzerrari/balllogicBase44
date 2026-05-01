/**
 * ShareCameraLink — Modal zum Teilen des Kamera-Links
 * Optimierter Einladungsflow mit Position & klaren Anweisungen
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check, Smartphone, ExternalLink, MapPin, Lock } from 'lucide-react';

export default function ShareCameraLink({ cam, liveUrl, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const code = cam.code || cam.camera_id;
  const camUrl = `${liveUrl}?code=${code}&pos=${encodeURIComponent(cam.label || '')}`;

  const whatsappText = encodeURIComponent(
    `📹 *TactIQ Kamera-Assistent*\n\nHallo! Du übernimmst die Kamera für: *${cam.label || 'Kamera'}*\n\n` +
    `*Schritt 1:* Gehe zu deiner Position (steht unten)\n` +
    `*Schritt 2:* Öffne diesen Link auf deinem Handy:\n${camUrl}\n\n` +
    `Oder gib diesen Code manuell ein: *${code}*\n\n` +
    `⚠️ *Wichtig:*\n` +
    `• Kamera auf Stativ/Geländer fixieren\n` +
    `• NICHT schwenken oder wackeln\n` +
    `• Bildschirm nicht sperren\n` +
    `• Quer (Landscape) halten`
  );

  const smsText = encodeURIComponent(`TactIQ Kamera ${cam.label || ''}: ${camUrl} | Code: ${code} | Nicht schwenken!`);

  const copyLink = () => {
    navigator.clipboard.writeText(camUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass rounded-2xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-grotesk font-bold text-foreground">Kameramann einladen</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {cam.label || 'Kamera'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Code — Hauptaktion */}
        <div className="bg-muted rounded-xl p-4 text-center mb-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Zugangscode</div>
          <div className="text-4xl font-grotesk font-bold text-primary tracking-[0.35em] mb-2">{code}</div>
          <button onClick={copyCode}
            className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mx-auto">
            {copiedCode ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            {copiedCode ? 'Code kopiert!' : 'Code kopieren'}
          </button>
        </div>

        {/* Share Buttons */}
        <div className="space-y-2 mb-4">
          <a href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/25 transition-all">
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <div className="text-left">
              <div className="text-sm font-semibold">Per WhatsApp senden</div>
              <div className="text-[10px] opacity-70">Inkl. Position & Anweisungen</div>
            </div>
          </a>

          <a href={`sms:?body=${smsText}`}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-all">
            <Smartphone className="w-5 h-5 flex-shrink-0" />
            <div className="text-left">
              <div className="text-sm font-semibold">Per SMS senden</div>
              <div className="text-[10px] opacity-70">Kurze Version mit Link</div>
            </div>
          </a>

          <button onClick={copyLink}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
            {copied ? <Check className="w-5 h-5 text-primary flex-shrink-0" /> : <Copy className="w-5 h-5 flex-shrink-0" />}
            <div className="text-left">
              <div className="text-sm font-medium">{copied ? 'Link kopiert!' : 'Link kopieren'}</div>
              <div className="text-[10px] text-muted-foreground truncate">{camUrl}</div>
            </div>
          </button>

          <a href={camUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-foreground transition-all">
            <ExternalLink className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">Selbst testen (neuer Tab)</span>
          </a>
        </div>

        {/* Kamera-Regeln Kurzform */}
        <div className="bg-destructive/8 border border-destructive/25 rounded-xl p-3">
          <div className="text-[10px] font-bold text-destructive uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Kameramann-Regeln (in Nachricht enthalten)
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {['❌ Nicht schwenken', '❌ Nicht wackeln', '✅ Stativ nutzen', '✅ Landscape-Modus'].map(r => (
              <div key={r} className="text-[10px] text-foreground/70">{r}</div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}