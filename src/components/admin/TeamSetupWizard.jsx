/**
 * TeamSetupWizard — Guided 3-step setup for team color references
 * 
 * Step 1: Foto Team A (Heimtrikot) aufnehmen/hochladen
 * Step 2: Foto Team B (Auswärts) aufnehmen/hochladen  
 * Step 3: Foto Schiedsrichter aufnehmen/hochladen
 * → Extrahiert dominante Farben und speichert in AppSettings
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, Check, ChevronRight, RefreshCw, Loader2, Palette, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const STEPS = [
  { id: 'team_a', label: 'Team A (Heim)', emoji: '🏠', color: 'primary', hint: 'Foto der Heimtrikots – möglichst alle Spieler nebeneinander oder ein einzelner Spieler in Trikot' },
  { id: 'team_b', label: 'Team B (Gäste)', emoji: '✈️', color: 'red', hint: 'Foto der Auswärtstrikots' },
  { id: 'referee', label: 'Schiedsrichter', emoji: '🟡', color: 'yellow', hint: 'Foto des Schiedsrichters in seinem Trikot' },
];

/**
 * Extract dominant color from a base64 image using Canvas
 */
async function extractDominantColor(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Sample middle third of image (torso area)
      const sw = Math.floor(img.width / 3);
      const sh = Math.floor(img.height / 3);
      const sx = Math.floor(img.width / 3);
      const sy = Math.floor(img.height / 3);

      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const imageData = ctx.getImageData(0, 0, sw, sh);
      const data = imageData.data;

      // Average color of sampled region
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }

      resolve({
        r: Math.round(r / count),
        g: Math.round(g / count),
        b: Math.round(b / count),
      });
    };
    img.onerror = () => resolve({ r: 128, g: 128, b: 128 });
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

function ColorSwatch({ color }) {
  if (!color) return null;
  return (
    <div
      className="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg flex-shrink-0"
      style={{ backgroundColor: `rgb(${color.r},${color.g},${color.b})` }}
      title={`RGB(${color.r}, ${color.g}, ${color.b})`}
    />
  );
}

export default function TeamSetupWizard({ appSettings, onSave, onClose }) {
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState({ team_a: null, team_b: null, referee: null });
  const [colors, setColors] = useState({ team_a: null, team_b: null, referee: null });
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const currentStep = STEPS[step];

  // Check if already configured
  const existing = appSettings?.find(s => s.key === 'team_references');
  const existingRefs = existing ? (() => { try { return JSON.parse(existing.value); } catch { return null; } })() : null;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1];
      const color = await extractDominantColor(base64);

      setPhotos(p => ({ ...p, [currentStep.id]: base64 }));
      setColors(c => ({ ...c, [currentStep.id]: color }));
      setProcessing(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    setProcessing(true);
    try {
      const references = {
        team_a_color: colors.team_a,
        team_b_color: colors.team_b,
        referee_color: colors.referee,
        configured_at: new Date().toISOString(),
      };

      await onSave('team_references', JSON.stringify(references), 'Team-Farb-Referenzen für Tracking');
      setDone(true);
      toast({ title: '✅ Team-Setup gespeichert!', description: 'Tracking verwendet jetzt diese Farben zur Team-Zuordnung.' });
    } catch (err) {
      toast({ title: 'Fehler beim Speichern', description: err.message });
    }
    setProcessing(false);
  };

  const handleReset = async () => {
    setPhotos({ team_a: null, team_b: null, referee: null });
    setColors({ team_a: null, team_b: null, referee: null });
    setStep(0);
    setDone(false);
  };

  const allDone = colors.team_a && colors.team_b && colors.referee;
  const currentPhoto = photos[currentStep?.id];
  const currentColor = colors[currentStep?.id];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-grotesk font-bold text-foreground flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" /> Team-Farben Setup
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Damit das KI-Tracking weiß, welches Team welche Farbe hat
          </p>
        </div>
        {existingRefs && (
          <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            <Check className="w-3 h-3" /> Konfiguriert
          </div>
        )}
      </div>

      {/* Existing config preview */}
      {existingRefs && !done && (
        <div className="glass rounded-xl p-4 border border-primary/20">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Aktuelle Konfiguration</div>
          <div className="flex gap-4 flex-wrap">
            {[
              { label: 'Team A (Heim)', color: existingRefs.team_a_color, emoji: '🏠' },
              { label: 'Team B (Gäste)', color: existingRefs.team_b_color, emoji: '✈️' },
              { label: 'Schiedsrichter', color: existingRefs.referee_color, emoji: '🟡' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <ColorSwatch color={item.color} />
                <div>
                  <div className="text-xs text-foreground font-medium">{item.emoji} {item.label}</div>
                  {item.color && <div className="text-[10px] text-muted-foreground font-mono">
                    rgb({item.color.r},{item.color.g},{item.color.b})
                  </div>}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleReset}
            className="mt-3 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Neu konfigurieren
          </button>
        </div>
      )}

      {/* Wizard */}
      {(!existingRefs || done === false) && (
        <>
          {/* Step indicators */}
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  i < step ? 'bg-primary text-primary-foreground' :
                  i === step ? 'bg-primary/20 border-2 border-primary text-primary' :
                  'bg-muted border border-border text-muted-foreground'
                }`}>
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <div className="min-w-0">
                  <div className={`text-[10px] font-bold truncate ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.emoji} {s.label}
                  </div>
                </div>
                {i < STEPS.length - 1 && <div className="w-4 h-px bg-border flex-shrink-0" />}
              </div>
            ))}
          </div>

          {/* Current step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass rounded-xl p-5 border border-border"
            >
              <div className="text-sm font-bold text-foreground mb-1">
                {currentStep.emoji} {currentStep.label}
              </div>
              <p className="text-xs text-muted-foreground mb-4">{currentStep.hint}</p>

              {/* Photo preview or upload */}
              {currentPhoto ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-muted aspect-video max-h-48">
                    <img
                      src={`data:image/jpeg;base64,${currentPhoto}`}
                      alt="Referenzfoto"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => { setPhotos(p => ({ ...p, [currentStep.id]: null })); setColors(c => ({ ...c, [currentStep.id]: null })); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {currentColor && (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <ColorSwatch color={currentColor} />
                      <div>
                        <div className="text-xs font-bold text-foreground">Dominante Farbe erkannt</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          rgb({currentColor.r}, {currentColor.g}, {currentColor.b})
                        </div>
                      </div>
                      <Check className="w-4 h-4 text-primary ml-auto" />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  {processing ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                  ) : (
                    <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  )}
                  <div className="text-sm font-medium text-foreground mb-1">
                    {processing ? 'Farbe wird extrahiert...' : 'Foto aufnehmen oder hochladen'}
                  </div>
                  <div className="text-xs text-muted-foreground">JPG, PNG — Trikotfarbe muss gut sichtbar sein</div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="border-border">
                Zurück
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!currentColor || processing}
              className="flex-1 bg-primary text-primary-foreground gap-2"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : step === STEPS.length - 1 ? (
                <><Check className="w-4 h-4" /> Speichern</>
              ) : (
                <>Weiter <ChevronRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>

          {/* Color summary */}
          {Object.values(colors).some(Boolean) && (
            <div className="flex items-center gap-3 px-1">
              <span className="text-[10px] text-muted-foreground">Erkannte Farben:</span>
              {STEPS.map(s => (
                <div key={s.id} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{s.emoji}</span>
                  <ColorSwatch color={colors[s.id]} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {done && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-xl p-6 border border-primary/30 text-center">
          <div className="text-4xl mb-2">✅</div>
          <div className="font-grotesk font-bold text-foreground mb-1">Team-Setup abgeschlossen!</div>
          <p className="text-xs text-muted-foreground mb-4">
            Das Tracking verwendet jetzt diese Farben zur automatischen Team-Zuordnung.
          </p>
          <div className="flex justify-center gap-4 mb-4">
            {STEPS.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <ColorSwatch color={colors[s.id]} />
                <span className="text-xs text-muted-foreground">{s.emoji}</span>
              </div>
            ))}
          </div>
          <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mx-auto">
            <RefreshCw className="w-3 h-3" /> Neu konfigurieren
          </button>
        </motion.div>
      )}
    </div>
  );
}