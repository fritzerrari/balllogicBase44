/**
 * PitchBoard — Drag-and-Drop Spielfeld-Komponente
 * Spieler können frei auf dem Feld positioniert werden.
 */
import { useRef } from 'react';
import { motion } from 'framer-motion';

const PITCH_COLOR = '#1a3d1a';

export default function PitchBoard({ positions, onPositionChange, onPlayerClick, selectedPlayerId }) {
  const pitchRef = useRef(null);

  const handleDragEnd = (playerId, event, info) => {
    const pitch = pitchRef.current;
    if (!pitch) return;
    const rect = pitch.getBoundingClientRect();
    const x = ((info.point.x - rect.left) / rect.width) * 100;
    const y = ((info.point.y - rect.top) / rect.height) * 100;
    const clamped = {
      x: Math.max(2, Math.min(98, x)),
      y: Math.max(2, Math.min(98, y)),
    };
    onPositionChange(playerId, clamped.x, clamped.y);
  };

  return (
    <div
      ref={pitchRef}
      className="relative w-full rounded-xl overflow-hidden select-none"
      style={{ aspectRatio: '68/105', background: PITCH_COLOR }}
    >
      {/* Pitch markings */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 68 105" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer border */}
        <rect x="1" y="1" width="66" height="103" stroke="white" strokeOpacity="0.4" strokeWidth="0.5" fill="none"/>
        {/* Center line */}
        <line x1="1" y1="52.5" x2="67" y2="52.5" stroke="white" strokeOpacity="0.4" strokeWidth="0.5"/>
        {/* Center circle */}
        <circle cx="34" cy="52.5" r="9.15" stroke="white" strokeOpacity="0.4" strokeWidth="0.5" fill="none"/>
        <circle cx="34" cy="52.5" r="0.5" fill="white" fillOpacity="0.5"/>
        {/* Penalty area home (top) */}
        <rect x="13.85" y="1" width="40.3" height="16.5" stroke="white" strokeOpacity="0.4" strokeWidth="0.5" fill="none"/>
        <rect x="24.85" y="1" width="18.3" height="5.5" stroke="white" strokeOpacity="0.4" strokeWidth="0.5" fill="none"/>
        {/* Penalty area away (bottom) */}
        <rect x="13.85" y="87.5" width="40.3" height="16.5" stroke="white" strokeOpacity="0.4" strokeWidth="0.5" fill="none"/>
        <rect x="24.85" y="98.5" width="18.3" height="5.5" stroke="white" strokeOpacity="0.4" strokeWidth="0.5" fill="none"/>
        {/* Penalty spots */}
        <circle cx="34" cy="12" r="0.5" fill="white" fillOpacity="0.5"/>
        <circle cx="34" cy="93" r="0.5" fill="white" fillOpacity="0.5"/>
        {/* Corner arcs */}
        <path d="M1,3 A2,2 0 0,0 3,1" stroke="white" strokeOpacity="0.3" strokeWidth="0.5" fill="none"/>
        <path d="M65,1 A2,2 0 0,0 67,3" stroke="white" strokeOpacity="0.3" strokeWidth="0.5" fill="none"/>
        <path d="M1,102 A2,2 0 0,1 3,104" stroke="white" strokeOpacity="0.3" strokeWidth="0.5" fill="none"/>
        <path d="M65,104 A2,2 0 0,1 67,102" stroke="white" strokeOpacity="0.3" strokeWidth="0.5" fill="none"/>
        {/* Grass stripes */}
        {[0,1,2,3,4,5,6].map(i => (
          <rect key={i} x="1" y={1 + i * 14.7} width="66" height="7.35"
            fill={i % 2 === 0 ? 'white' : 'transparent'} fillOpacity="0.03" />
        ))}
      </svg>

      {/* Players */}
      {positions.map((p) => (
        <PlayerToken
          key={p.player_id}
          player={p}
          isSelected={selectedPlayerId === p.player_id}
          onDragEnd={(e, info) => handleDragEnd(p.player_id, e, info)}
          onClick={() => onPlayerClick?.(p.player_id)}
        />
      ))}
    </div>
  );
}

function PlayerToken({ player, isSelected, onDragEnd, onClick }) {
  const isHome = player.team !== 'away';
  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={onDragEnd}
      onClick={onClick}
      whileDrag={{ scale: 1.2, zIndex: 50 }}
      className="absolute cursor-grab active:cursor-grabbing"
      style={{
        left: `${player.x}%`,
        top: `${player.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isSelected ? 30 : 10,
      }}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-grotesk font-bold border-2 shadow-lg transition-all ${
        isHome
          ? isSelected
            ? 'bg-primary border-white text-primary-foreground shadow-primary/40'
            : 'bg-primary/80 border-primary text-primary-foreground'
          : isSelected
            ? 'bg-red-500 border-white text-white shadow-red-400/40'
            : 'bg-red-500/80 border-red-400 text-white'
      }`}>
        {player.player_number || player.player_name?.[0] || '?'}
      </div>
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 whitespace-nowrap text-[9px] text-white font-medium bg-black/60 rounded px-1 py-0.5">
        {player.player_name?.split(' ').slice(-1)[0]}
      </div>
    </motion.div>
  );
}