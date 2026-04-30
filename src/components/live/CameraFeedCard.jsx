/**
 * CameraFeedCard — Einzelne Kamera-Kachel im Coaching Cockpit
 * Zeigt Feed-Status, Chat-Overlay, Mikro-Steuerung
 */
import { useState } from 'react';
import { Camera, Mic, MicOff, Send, MessageSquare, Share2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CameraFeedCard({
  cam, isSelected, onSelect, onShare, onCopyCode, copied, liveUrl,
  messages, inputMsg, onInputChange, onSend, micActive, onMicToggle
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const statusColor = cam.status === 'connected' ? 'text-primary' : 'text-yellow-400';
  const statusDot = cam.status === 'connected' ? 'bg-primary' : 'bg-yellow-400';

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${isSelected ? 'border-primary/50 shadow-lg shadow-primary/10' : 'border-border'} bg-card`}>
      {/* Video area */}
      <div className="aspect-video relative bg-black cursor-pointer" onClick={onSelect}>
        {cam.status === 'connected' ? (
          <>
            {/* Simulated video feed background */}
            <div className="absolute inset-0 pitch-bg opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Camera className="w-8 h-8 text-primary/50 mx-auto" />
                <div className="text-[10px] text-muted-foreground mt-1">Live-Feed</div>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
              <div className="text-[10px] text-muted-foreground">Wartet auf Verbindung...</div>
              <div className="text-xs text-yellow-400 font-bold mt-1">{cam.code || cam.camera_id}</div>
            </div>
          </div>
        )}

        {/* Status badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${statusDot} animate-pulse`} />
          <span className={`text-[9px] font-bold ${statusColor}`}>{cam.status === 'connected' ? 'LIVE' : 'WARTE'}</span>
        </div>

        {/* Cam label */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <span className="text-[10px] text-white/80 bg-black/60 rounded px-1.5 py-0.5">{cam.label}</span>
          <div className="flex gap-1">
            <button onClick={e => { e.stopPropagation(); onMicToggle(); }}
              className={`p-1 rounded ${micActive ? 'bg-primary text-primary-foreground' : 'bg-black/60 text-white/70'}`}>
              {micActive ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
            </button>
            <button onClick={e => { e.stopPropagation(); onShare(); }}
              className="p-1 rounded bg-black/60 text-white/70 hover:text-white">
              <Share2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat toggle */}
      <div className="border-t border-border">
        <button onClick={() => setChatOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" />
            Chat {messages.length > 0 && <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{messages.length}</span>}
          </span>
          {chatOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <AnimatePresence>
          {chatOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="overflow-hidden border-t border-border">
              <div className="p-2 max-h-24 overflow-y-auto space-y-1">
                {messages.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground text-center py-2">Noch keine Nachrichten</div>
                ) : messages.map((m, i) => (
                  <div key={i} className="text-[10px] bg-primary/10 rounded px-2 py-1 text-foreground flex justify-between gap-2">
                    <span>{m.text}</span><span className="text-muted-foreground flex-shrink-0">{m.time}</span>
                  </div>
                ))}
              </div>
              <div className="p-2 flex gap-1 border-t border-border">
                <input
                  value={inputMsg}
                  onChange={e => onInputChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onSend()}
                  placeholder="Nachricht..."
                  className="flex-1 text-[10px] bg-muted border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary"
                />
                <button onClick={onSend} className="p-1.5 bg-primary text-primary-foreground rounded">
                  <Send className="w-2.5 h-2.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}