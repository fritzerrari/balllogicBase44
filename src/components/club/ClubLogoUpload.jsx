/**
 * ClubLogoUpload — Logo hochladen + KI-Erkennung + Farbextraktion
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Loader2, Sparkles, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ClubLogoUpload({ onIdentified, existingLogo }) {
  const [uploading, setUploading] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [preview, setPreview] = useState(existingLogo || null);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(false);

    setIdentifying(true);
    const res = await base44.functions.invoke('identifyClub', { logo_url: file_url });
    setIdentifying(false);

    if (res.data?.identification) {
      setResult({ ...res.data, logo_url: file_url });
      if (onIdentified) onIdentified({ ...res.data, logo_url: file_url });
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onClick={() => fileRef.current?.click()}
        className="relative border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-all group"
      >
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        {preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={preview} alt="Logo" className="w-24 h-24 object-contain rounded-xl shadow-lg" />
            <div className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
              Anderes Logo auswählen
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
            <Upload className="w-10 h-10" />
            <div className="font-medium">Vereins-Logo hochladen</div>
            <div className="text-xs">PNG, JPG — KI erkennt den Verein automatisch</div>
          </div>
        )}
      </div>

      {/* Status */}
      <AnimatePresence>
        {(uploading || identifying) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
            <div className="text-sm text-primary font-medium">
              {uploading ? 'Logo wird hochgeladen...' : '🔍 KI analysiert das Logo und sucht Vereinsdaten...'}
            </div>
          </motion.div>
        )}

        {result && !identifying && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-3">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">Verein erkannt!</span>
              {result.identification?.confidence && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {Math.round(result.identification.confidence)}% Konfidenz
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Verein:</span> <span className="text-foreground font-medium">{result.identification.name}</span></div>
              <div><span className="text-muted-foreground">Liga:</span> <span className="text-foreground font-medium">{result.identification.league}</span></div>
              <div><span className="text-muted-foreground">Land:</span> <span className="text-foreground font-medium">{result.identification.country}</span></div>
              <div><span className="text-muted-foreground">Stadt:</span> <span className="text-foreground font-medium">{result.identification.city}</span></div>
            </div>

            {/* Farben */}
            {result.identification.primary_color && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Vereinsfarben:</span>
                {[result.identification.primary_color, result.identification.secondary_color, result.identification.accent_color]
                  .filter(Boolean)
                  .map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border border-border shadow-sm" style={{ backgroundColor: c }} title={c} />
                  ))
                }
              </div>
            )}

            {(result.api_matches?.length > 0 || result.api_players?.length > 0) && (
              <div className="text-xs text-muted-foreground flex gap-4">
                {result.api_matches?.length > 0 && <span>📅 {result.api_matches.length} Spiele gefunden</span>}
                {result.api_players?.length > 0 && <span>👤 {result.api_players.length} Spieler gefunden</span>}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}