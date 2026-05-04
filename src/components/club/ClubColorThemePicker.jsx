/**
 * ClubColorThemePicker — Vereinsfarben auf System-Theme anwenden + Reset
 */
import { useState, useEffect } from 'react';
import { applyClubTheme, resetTheme, getSavedTheme } from '@/lib/clubTheme';
import { Palette, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function ClubColorThemePicker({ club, onUpdate }) {
  const [primary, setPrimary] = useState(club?.primary_color || '#22c55e');
  const [secondary, setSecondary] = useState(club?.secondary_color || '#16a34a');
  const [accent, setAccent] = useState(club?.accent_color || '#15803d');
  const [applied, setApplied] = useState(false);
  const { toast } = useToast();

  const savedTheme = getSavedTheme();
  const isThemeActive = !!savedTheme;

  // Sync wenn club-Daten sich ändern
  useEffect(() => {
    if (club?.primary_color) setPrimary(club.primary_color);
    if (club?.secondary_color) setSecondary(club.secondary_color);
    if (club?.accent_color) setAccent(club.accent_color);
  }, [club?.primary_color, club?.secondary_color, club?.accent_color]);

  const handleApply = () => {
    applyClubTheme(primary, secondary, accent);
    if (onUpdate) onUpdate({ primary_color: primary, secondary_color: secondary, accent_color: accent, colors_applied_to_theme: true });
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
    toast({ title: '🎨 Vereinsfarben angewendet!', description: 'Das Interface passt sich jetzt an Ihren Verein an.' });
  };

  const handleReset = () => {
    resetTheme();
    if (onUpdate) onUpdate({ colors_applied_to_theme: false });
    toast({ title: 'Standardfarben wiederhergestellt' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Palette className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Vereinsfarben & System-Theme</h3>
        {isThemeActive && (
          <span className="ml-auto text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
            AKTIV
          </span>
        )}
      </div>

      {/* Color Pickers */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Primärfarbe', value: primary, setter: setPrimary },
          { label: 'Sekundärfarbe', value: secondary, setter: setSecondary },
          { label: 'Akzentfarbe', value: accent, setter: setAccent },
        ].map(({ label, value, setter }) => (
          <div key={label} className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground block">{label}</label>
            <div className="relative">
              <input
                type="color"
                value={value || '#22c55e'}
                onChange={e => setter(e.target.value)}
                className="w-full h-10 rounded-lg border border-border cursor-pointer bg-muted p-1"
              />
              <div className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-mono text-muted-foreground pb-0.5 pointer-events-none">
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Swatches */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-muted-foreground">Vorschau:</span>
        <div className="flex gap-1.5">
          {[primary, secondary, accent].filter(Boolean).map((c, i) => (
            <div key={i} className="w-8 h-8 rounded-lg shadow border border-border/50 transition-transform hover:scale-110"
              style={{ backgroundColor: c }} />
          ))}
          <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center"
            style={{ backgroundColor: primary, opacity: 0.15 }}>
            <span className="text-[8px]" style={{ color: primary }}>Aa</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button onClick={handleApply} className="flex-1 gap-2 bg-primary text-primary-foreground h-9 text-sm">
          {applied ? <Check className="w-4 h-4" /> : <Palette className="w-4 h-4" />}
          {applied ? 'Angewendet!' : 'Farben anwenden'}
        </Button>
        {isThemeActive && (
          <Button onClick={handleReset} variant="outline" className="gap-2 border-border text-muted-foreground h-9 text-sm">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Das gesamte Interface (Buttons, Highlights, Sidebar) wird an Ihre Vereinsfarben angepasst. Mit "Reset" kehren Sie zu den Standard-Farben zurück.
      </p>
    </div>
  );
}