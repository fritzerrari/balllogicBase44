/**
 * LineupBuilder — 3 Wege zur Aufstellung:
 *  1. Handgeschrieben (Spieler-Namen tippen)
 *  2. Spielerbogen abfotografieren (KI erkennt Namen)
 *  3. Default-Aufstellung laden (meist gespielte Spieler)
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, PenLine, Star, Loader2, Plus, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const POSITIONS = [
  'Torwart', 'Innenverteidiger', 'Außenverteidiger',
  'Defensives Mittelfeld', 'Zentrales Mittelfeld', 'Offensives Mittelfeld',
  'Linksaußen', 'Rechtsaußen', 'Mittelstürmer'
];

const MODES = [
  { id: 'manual', icon: PenLine, label: 'Handschriftlich', desc: 'Namen eingeben' },
  { id: 'photo', icon: Camera, label: 'Foto-Scan', desc: 'Spielerbogen fotografieren' },
  { id: 'default', icon: Star, label: 'Standard-Aufstellung', desc: 'Meist gespielte Spieler' },
];

export default function LineupBuilder({ side, teamName, existingPlayers = [], lineup = [], onLineupChange, apiSquad = [] }) {
  const [mode, setMode] = useState('manual');
  const [scanning, setScanning] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: POSITIONS[4] });
  const fileRef = useRef();

  const addPlayer = (p) => {
    if (!p.name?.trim()) return;
    if (lineup.find(x => x.name === p.name)) return;
    onLineupChange([...lineup, { name: p.name, number: p.number || '', position: p.position || POSITIONS[4] }]);
    setNewPlayer({ name: '', number: '', position: POSITIONS[4] });
  };

  const removePlayer = (i) => {
    onLineupChange(lineup.filter((_, idx) => idx !== i));
  };

  const handlePhotoScan = async (file) => {
    if (!file) return;
    setScanning(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analysiere dieses Bild eines Spielerbogens / handgeschriebenen Aufstellungszettels aus dem Fußball.
Extrahiere alle erkennbaren Spielernamen und Trikotnummern.
Gib nur die Spieler zurück, die du sicher erkennst.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          players: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                number: { type: 'string' },
                position: { type: 'string' }
              }
            }
          }
        }
      }
    });
    const scanned = result.players || [];
    const merged = [...lineup];
    scanned.forEach(p => {
      if (p.name && !merged.find(x => x.name === p.name)) {
        merged.push({ name: p.name, number: p.number || '', position: p.position || POSITIONS[4] });
      }
    });
    onLineupChange(merged);
    setScanning(false);
  };

  const loadDefault = () => {
    if (existingPlayers.length === 0) return;
    // Nehme die häufigsten Spieler aus dem existierenden Kader (bis 11)
    const defaults = existingPlayers.slice(0, 11).map(p => ({
      name: p.name,
      number: p.number ? String(p.number) : '',
      position: p.position || POSITIONS[4],
    }));
    onLineupChange(defaults);
  };

  const loadFromApiSquad = (p) => {
    if (lineup.find(x => x.name === p.name)) return;
    onLineupChange([...lineup, {
      name: p.name,
      number: p.number ? String(p.number) : '',
      position: POSITIONS[4],
    }]);
  };

  const color = side === 'home' ? 'text-primary' : 'text-red-400';
  const bgColor = side === 'home' ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-red-500/15 border-red-500/30 text-red-400';

  return (
    <div className="space-y-3">
      {/* Team Label */}
      <div className={`text-xs font-bold uppercase tracking-widest ${color} flex items-center gap-2`}>
        {side === 'home' ? '🏠' : '✈️'} {teamName} — {lineup.length} Spieler
      </div>

      {/* Current Lineup */}
      {lineup.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lineup.map((p, i) => (
            <span key={i} className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1 text-xs border border-border/50">
              {p.number && <span className={`font-bold ${color}`}>#{p.number}</span>}
              <span className="text-foreground">{p.name}</span>
              <button onClick={() => removePlayer(i)} className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Mode Selector */}
      <div className="grid grid-cols-3 gap-1.5">
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-xs font-medium border transition-all ${mode === m.id ? bgColor : 'bg-muted/60 border-border/50 text-muted-foreground hover:text-foreground'}`}>
            <m.icon className="w-4 h-4" />
            <span className="leading-tight text-center">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Manual Mode */}
      {mode === 'manual' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={newPlayer.number} onChange={e => setNewPlayer(p => ({ ...p, number: e.target.value }))}
              placeholder="#" className="bg-muted border-border text-sm w-14 text-center px-2" />
            <Input value={newPlayer.name} onChange={e => setNewPlayer(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addPlayer(newPlayer)}
              placeholder="Spielername" className="bg-muted border-border text-sm flex-1" />
            <select value={newPlayer.position} onChange={e => setNewPlayer(p => ({ ...p, position: e.target.value }))}
              className="bg-muted border border-input rounded-md px-2 text-xs text-foreground h-9 max-w-24">
              {POSITIONS.map(pos => <option key={pos} value={pos}>{pos.split(' ').slice(-1)[0]}</option>)}
            </select>
            <button onClick={() => addPlayer(newPlayer)}
              className={`px-3 h-9 rounded-lg border transition-all ${bgColor} hover:opacity-80`}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {/* API Squad chips */}
          {apiSquad.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-1.5">Aus Datenbank hinzufügen:</div>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {apiSquad.slice(0, 20).map((p, i) => (
                  <button key={i} onClick={() => loadFromApiSquad(p)}
                    disabled={!!lineup.find(x => x.name === p.name)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-foreground hover:border-primary/40 disabled:opacity-40 disabled:cursor-default transition-all">
                    {p.number ? `#${p.number} ` : ''}{p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Photo Mode */}
      {mode === 'photo' && (
        <div className="space-y-2">
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-all">
              {scanning ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <div className="text-sm text-primary font-medium">KI erkennt Spielernamen...</div>
                </div>
              ) : (
                <>
                  <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <div className="text-sm text-foreground font-medium">Spielerbogen fotografieren</div>
                  <div className="text-xs text-muted-foreground mt-1">Aufstellungszettel, DFB-Bogen, handgeschrieben</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => e.target.files?.[0] && handlePhotoScan(e.target.files[0])} />
          </label>
          <p className="text-[10px] text-muted-foreground text-center">
            KI liest Namen automatisch aus dem Foto — auch handgeschrieben
          </p>
        </div>
      )}

      {/* Default Mode */}
      {mode === 'default' && (
        <div className="space-y-2">
          {existingPlayers.length > 0 ? (
            <>
              <div className="text-xs text-muted-foreground">
                {existingPlayers.length} Spieler im Kader — lädt die ersten 11 als Startaufstellung
              </div>
              <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-y-auto">
                {existingPlayers.slice(0, 11).map((p, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-foreground/70">
                    {p.number ? `#${p.number} ` : ''}{p.name}
                  </span>
                ))}
              </div>
              <Button onClick={loadDefault} size="sm" className={`gap-2 border ${bgColor} bg-transparent hover:opacity-80`}>
                <Star className="w-3.5 h-3.5" /> Standard-Aufstellung laden
              </Button>
            </>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 text-center">
              Noch keine Spieler im Kader gespeichert.<br />
              Füge zuerst Spieler unter <strong>Kader & Performance</strong> hinzu.
            </div>
          )}
        </div>
      )}
    </div>
  );
}