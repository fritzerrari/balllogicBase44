/**
 * TacticsBoard — Interaktives Drag-and-Drop Taktik-Board
 * Trainer können Spieler aus dem Kader auf das Spielfeld ziehen,
 * Formationen wählen und Boards speichern.
 */
import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import PitchBoard from '@/components/tactics/PitchBoard';
import PlayerBench from '@/components/tactics/PlayerBench';
import BoardToolbar from '@/components/tactics/BoardToolbar';

const DEFAULT_SPAWN = { x: 50, y: 50 };

// Spawn-Positionen nach Spieler-Position
const SPAWN_BY_POSITION = {
  'Torwart': { x: 50, y: 90 },
  'Innenverteidiger': { x: 45, y: 78 },
  'Außenverteidiger': { x: 20, y: 74 },
  'Defensives Mittelfeld': { x: 50, y: 62 },
  'Zentrales Mittelfeld': { x: 50, y: 55 },
  'Offensives Mittelfeld': { x: 50, y: 42 },
  'Linksaußen': { x: 78, y: 35 },
  'Rechtsaußen': { x: 22, y: 35 },
  'Mittelstürmer': { x: 50, y: 22 },
};

export default function TacticsBoard() {
  const [boardName, setBoardName] = useState('Meine Formation');
  const [formation, setFormation] = useState('');
  const [positions, setPositions] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('-created_date', 50),
  });

  const { data: savedBoards = [] } = useQuery({
    queryKey: ['tactics-boards'],
    queryFn: () => base44.entities.TacticsBoard.list('-updated_date', 20),
  });

  const placedIds = positions.map(p => p.player_id);

  const handleAddPlayer = useCallback((player) => {
    const spawn = SPAWN_BY_POSITION[player.position] || DEFAULT_SPAWN;
    // Slight random offset so players don't stack exactly
    const offset = () => (Math.random() - 0.5) * 6;
    setPositions(prev => [...prev, {
      player_id: player.id,
      player_name: player.name,
      player_number: player.number ? String(player.number) : '',
      position_label: player.position || '',
      x: Math.max(3, Math.min(97, spawn.x + offset())),
      y: Math.max(3, Math.min(97, spawn.y + offset())),
      team: 'home',
    }]);
  }, []);

  const handleRemovePlayer = useCallback((playerId) => {
    setPositions(prev => prev.filter(p => p.player_id !== playerId));
    if (selectedPlayerId === playerId) setSelectedPlayerId(null);
  }, [selectedPlayerId]);

  const handlePositionChange = useCallback((playerId, x, y) => {
    setPositions(prev => prev.map(p =>
      p.player_id === playerId ? { ...p, x, y } : p
    ));
  }, []);

  const handleApplyFormation = useCallback((template) => {
    // Keep existing players, reassign positions
    setPositions(prev => {
      const updated = [...prev];
      template.forEach((slot, i) => {
        if (updated[i]) {
          updated[i] = { ...updated[i], x: slot.x, y: slot.y };
        }
      });
      return updated;
    });
  }, []);

  const handleSave = async () => {
    if (!boardName.trim()) {
      toast({ title: 'Bitte einen Namen eingeben', variant: 'destructive' });
      return;
    }
    setSaving(true);
    await base44.entities.TacticsBoard.create({
      name: boardName,
      formation,
      positions,
    });
    queryClient.invalidateQueries({ queryKey: ['tactics-boards'] });
    toast({ title: `✓ "${boardName}" gespeichert` });
    setSaving(false);
  };

  const handleLoadBoard = (board) => {
    setBoardName(board.name);
    setFormation(board.formation || '');
    setPositions(board.positions || []);
    toast({ title: `Board "${board.name}" geladen` });
  };

  const handleClear = () => {
    setPositions([]);
    setSelectedPlayerId(null);
    setFormation('');
  };

  return (
    <div className="p-4 lg:p-6 min-h-screen">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <h1 className="text-2xl font-grotesk font-bold text-foreground">Taktik-Board</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Spieler per Drag-and-Drop auf dem Feld positionieren</p>
      </motion.div>

      {/* Toolbar */}
      <div className="glass rounded-xl p-3 mb-4">
        <BoardToolbar
          name={boardName}
          formation={formation}
          onNameChange={setBoardName}
          onFormationChange={setFormation}
          onSave={handleSave}
          onClear={handleClear}
          onApplyFormation={handleApplyFormation}
          saving={saving}
          savedBoards={savedBoards}
          onLoadBoard={handleLoadBoard}
        />
      </div>

      {/* Main layout */}
      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">

        {/* Player bench — left sidebar */}
        <div className="w-52 flex-shrink-0 glass rounded-xl p-3 overflow-hidden flex flex-col">
          <div className="flex items-center gap-1.5 mb-3">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Kader</span>
          </div>
          {players.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Keine Spieler.<br />Zuerst Kader anlegen.</p>
              </div>
            </div>
          ) : (
            <PlayerBench
              players={players}
              placedIds={placedIds}
              onAddPlayer={handleAddPlayer}
              onRemovePlayer={handleRemovePlayer}
            />
          )}
        </div>

        {/* Pitch */}
        <div className="flex-1 glass rounded-xl p-3 overflow-hidden flex items-center justify-center">
          <div className="h-full max-h-full" style={{ aspectRatio: '68/105' }}>
            <PitchBoard
              positions={positions}
              onPositionChange={handlePositionChange}
              onPlayerClick={setSelectedPlayerId}
              selectedPlayerId={selectedPlayerId}
            />
          </div>
        </div>

        {/* Right info panel */}
        <div className="w-44 flex-shrink-0 glass rounded-xl p-3 flex flex-col gap-3">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Info</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Spieler:</span>
              <span className="text-foreground font-bold">{positions.length}/11</span>
            </div>
            {formation && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Formation:</span>
                <span className="text-primary font-bold">{formation}</span>
              </div>
            )}
            <div className={`text-center py-1.5 rounded-lg text-[11px] font-medium ${
              positions.length === 11 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {positions.length === 11 ? '✓ Vollständig' : `${11 - positions.length} fehlen`}
            </div>
          </div>

          {/* Position legend */}
          <div className="border-t border-border pt-3 space-y-1">
            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1.5">Legende</div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-4 h-4 rounded-full bg-primary/80 border border-primary flex-shrink-0" />
              <span className="text-muted-foreground">Heim</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-4 h-4 rounded-full bg-red-500/80 border border-red-400 flex-shrink-0" />
              <span className="text-muted-foreground">Gäste</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="border-t border-border pt-3 mt-auto">
            <div className="text-[10px] text-muted-foreground space-y-1.5">
              <div>① Spieler links antippen → Feld</div>
              <div>② Spieler auf Feld ziehen</div>
              <div>③ Formation wählen → Auto-Positionen</div>
              <div>④ Speichern</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}