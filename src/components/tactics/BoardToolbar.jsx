/**
 * BoardToolbar — Speichern, Formation wählen, Board-Name
 */
import { Save, Trash2, RotateCcw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

const FORMATIONS = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '3-4-3', '5-3-2', '4-1-4-1'];

const DEFAULT_POSITIONS = {
  '4-3-3': [
    { role: 'TW', x: 50, y: 90 },
    { role: 'RV', x: 18, y: 74 }, { role: 'IV', x: 35, y: 78 }, { role: 'IV', x: 65, y: 78 }, { role: 'LV', x: 82, y: 74 },
    { role: 'RM', x: 25, y: 55 }, { role: 'ZM', x: 50, y: 58 }, { role: 'LM', x: 75, y: 55 },
    { role: 'RA', x: 20, y: 30 }, { role: 'ST', x: 50, y: 20 }, { role: 'LA', x: 80, y: 30 },
  ],
  '4-2-3-1': [
    { role: 'TW', x: 50, y: 90 },
    { role: 'RV', x: 18, y: 74 }, { role: 'IV', x: 35, y: 78 }, { role: 'IV', x: 65, y: 78 }, { role: 'LV', x: 82, y: 74 },
    { role: 'DM', x: 38, y: 60 }, { role: 'DM', x: 62, y: 60 },
    { role: 'RA', x: 22, y: 40 }, { role: 'OM', x: 50, y: 40 }, { role: 'LA', x: 78, y: 40 },
    { role: 'ST', x: 50, y: 18 },
  ],
  '4-4-2': [
    { role: 'TW', x: 50, y: 90 },
    { role: 'RV', x: 18, y: 74 }, { role: 'IV', x: 35, y: 78 }, { role: 'IV', x: 65, y: 78 }, { role: 'LV', x: 82, y: 74 },
    { role: 'RM', x: 18, y: 52 }, { role: 'ZM', x: 38, y: 55 }, { role: 'ZM', x: 62, y: 55 }, { role: 'LM', x: 82, y: 52 },
    { role: 'ST', x: 38, y: 22 }, { role: 'ST', x: 62, y: 22 },
  ],
  '3-5-2': [
    { role: 'TW', x: 50, y: 90 },
    { role: 'IV', x: 28, y: 78 }, { role: 'IV', x: 50, y: 80 }, { role: 'IV', x: 72, y: 78 },
    { role: 'RM', x: 12, y: 55 }, { role: 'ZM', x: 32, y: 58 }, { role: 'ZM', x: 50, y: 55 }, { role: 'ZM', x: 68, y: 58 }, { role: 'LM', x: 88, y: 55 },
    { role: 'ST', x: 36, y: 22 }, { role: 'ST', x: 64, y: 22 },
  ],
};

export default function BoardToolbar({ name, formation, onNameChange, onFormationChange, onSave, onClear, onApplyFormation, saving, savedBoards, onLoadBoard }) {
  const [showFormations, setShowFormations] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const handleFormation = (f) => {
    onFormationChange(f);
    const template = DEFAULT_POSITIONS[f];
    if (template) onApplyFormation(template);
    setShowFormations(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Name */}
      <Input value={name} onChange={e => onNameChange(e.target.value)}
        placeholder="Formation benennen..." className="bg-muted border-border text-sm h-9 w-44" />

      {/* Formation Picker */}
      <div className="relative">
        <button onClick={() => setShowFormations(s => !s)}
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-muted border border-border text-sm text-foreground hover:border-primary/40 transition-all">
          {formation || 'Formation'} <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        {showFormations && (
          <div className="absolute top-full left-0 mt-1 glass rounded-xl p-1.5 z-50 min-w-[130px] shadow-xl border border-border">
            {FORMATIONS.map(f => (
              <button key={f} onClick={() => handleFormation(f)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all hover:bg-primary/10 hover:text-primary ${formation === f ? 'text-primary font-bold' : 'text-foreground'}`}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Saved Boards */}
      {savedBoards?.length > 0 && (
        <div className="relative">
          <button onClick={() => setShowSaved(s => !s)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-muted border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
            Gespeichert <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showSaved && (
            <div className="absolute top-full left-0 mt-1 glass rounded-xl p-1.5 z-50 min-w-[180px] shadow-xl border border-border max-h-48 overflow-y-auto">
              {savedBoards.map(b => (
                <button key={b.id} onClick={() => { onLoadBoard(b); setShowSaved(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all hover:bg-primary/10 hover:text-primary text-foreground">
                  <div className="font-medium">{b.name}</div>
                  <div className="text-muted-foreground">{b.formation} · {b.positions?.length || 0} Spieler</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 ml-auto">
        <Button variant="outline" size="sm" onClick={onClear} className="border-border text-muted-foreground gap-1.5 h-9">
          <RotateCcw className="w-3.5 h-3.5" /> Leeren
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground gap-1.5 h-9">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Speichern...' : 'Speichern'}
        </Button>
      </div>
    </div>
  );
}