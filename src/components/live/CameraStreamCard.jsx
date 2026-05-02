/**
 * CameraStreamCard — Robuster Video-Stream mit Auto-Polling & Fallbacks
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Wifi, WifiOff, X, Share2, Edit2, Check } from 'lucide-react';

export default function CameraStreamCard({
  cam,
  sessionId,
  isConnected,
  onDelete,
  onEdit,
  onShare,
  onCopyCode,
  copied,
}) {
  const [editLabel, setEditLabel] = useState(cam.label);
  const [isEditing, setIsEditing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Auto-poll LiveSession für aktualisierte Kamera-Daten (Thumbnail + Status)
  const { data: session, isLoading } = useQuery({
    queryKey: ['session-camera', sessionId, cam.camera_id],
    queryFn: async () => {
      const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
      return sessions[0];
    },
    refetchInterval: 3000, // Poll alle 3s für Thumbnail-Updates
    staleTime: 1000,
    retry: 2,
  });

  const liveCamera = session?.camera_streams?.find(
    c => String(c.code).trim() === String(cam.code).trim()
  );
  const thumbnail = liveCamera?.thumbnail;
  const lastSeen = liveCamera?.last_seen
    ? Math.round((Date.now() - new Date(liveCamera.last_seen).getTime()) / 1000)
    : null;

  useEffect(() => {
    if (thumbnail) setRetryCount(0);
  }, [thumbnail]);

  const handleSaveLabel = () => {
    if (editLabel.trim()) {
      // Label wird via Parent (LiveSession) aktualisiert
      setIsEditing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl border overflow-hidden flex flex-col transition-all ${
        isConnected ? 'border-primary/60 bg-primary/5' : 'border-border/50 bg-muted/30'
      }`}
    >
      {/* Thumbnail/Stream Area */}
      <div className="aspect-video bg-black relative flex items-center justify-center group/thumb overflow-hidden">
        {/* Live Thumbnail */}
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={cam.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
            {isLoading ? (
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            ) : (
              <div className="text-center text-muted-foreground">
                <div className="text-sm mb-1">Warte auf Stream...</div>
                <div className="text-xs">Code: {cam.code}</div>
              </div>
            )}
          </div>
        )}

        {/* Status Badge */}
        <div
          className={`absolute top-2 left-2 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 ${
            isConnected
              ? 'bg-primary/80 text-primary-foreground'
              : 'bg-black/70 text-muted-foreground'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-white animate-pulse' : 'bg-muted-foreground'
            }`}
          />
          {isConnected
            ? `LIVE${lastSeen !== null && lastSeen < 15 ? ` ${lastSeen}s` : ''}`
            : 'WARTET'}
        </div>

        {/* Quick Actions */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
          <button
            onClick={() => onDelete?.(cam.camera_id)}
            className="w-8 h-8 rounded-lg bg-destructive/60 text-white hover:bg-destructive flex items-center justify-center transition-all"
            title="Kamera löschen"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={() => onShare?.(cam)}
            className="w-8 h-8 rounded-lg bg-primary/60 text-primary-foreground hover:bg-primary flex items-center justify-center transition-all"
            title="Code teilen"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-3 space-y-2">
        {/* Label Edit */}
        <div>
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveLabel();
                  if (e.key === 'Escape') { setIsEditing(false); setEditLabel(cam.label); }
                }}
                className="flex-1 bg-background border border-primary/40 rounded px-2 py-1 text-sm text-foreground focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveLabel}
                className="text-primary hover:text-primary/80"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between group/label">
              <div>
                <div className="text-sm font-medium text-foreground">{cam.label}</div>
                <div className="text-xs text-muted-foreground">Status: {isConnected ? '🟢 Online' : '⚪ Wartet'}</div>
              </div>
              <button
                onClick={() => { setIsEditing(true); setEditLabel(cam.label); }}
                className="opacity-0 group-label-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Code & Actions */}
        <div className="pt-1 border-t border-border/30 flex items-center justify-between">
          <div className="text-lg font-grotesk font-bold text-primary tracking-widest">{cam.code}</div>
          <button
            onClick={() => onCopyCode?.(cam.code)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              copied === cam.code
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'bg-muted border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {copied === cam.code ? '✓ Kopiert' : 'Code'}
          </button>
        </div>
      </div>

      {/* Connection Health */}
      {isConnected && (
        <div className="px-3 pb-2 text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-primary" /> Verbunden
          {lastSeen !== null && lastSeen < 20 && <span className="text-primary">• {lastSeen}s alt</span>}
        </div>
      )}
    </motion.div>
  );
}