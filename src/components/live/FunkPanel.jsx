/**
 * FunkPanel — Walkie-Talkie / Push-to-Talk zwischen Trainer und Kameras
 * Jetzt mit Real-Time WebSocket Subscription (fallback: polling)
 * Trainer-Seite: in LiveSession + CoachingCockpit eingebettet
 */
import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Send, Mic, MicOff, X, Zap } from 'lucide-react';
import useFunkSubscription from '@/hooks/useFunkSubscription';
import AudioWaveform from './AudioWaveform';

export default function FunkPanel({ sessionId, onClose }) {
  const [text, setText] = useState('');
  const [pttActive, setPttActive] = useState(false);
  const listRef = useRef(null);

  // Real-time subscription (WebSocket or polling fallback)
  const { messages, isSubscribed, activeSpeaker } = useFunkSubscription(sessionId);

  const sendText = async () => {
    if (!text.trim()) return;
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from: 'coach',
      from_label: 'Trainer',
      text: text.trim(),
      is_ppt: false,
      timestamp_ms: Date.now(),
    });
    setText('');
  };

  const handlePTT = async (active) => {
    setPttActive(active);
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from: 'coach',
      from_label: 'Trainer',
      text: active ? '🎙 Trainer spricht...' : '📻 Trainer fertig',
      is_ppt: true,
      ppt_active: active,
      timestamp_ms: Date.now(),
    });
  };

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (!listRef.current) return;
    requestAnimationFrame(() => {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  // Scroll when messages change
  useState(() => {
    scrollToBottom();
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <span className="font-grotesk font-bold text-sm text-foreground">Funk-Kanal</span>
          
          {/* Connection Status Badge */}
          <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 border border-primary/20 text-primary">
            {isSubscribed ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                WebSocket
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                Polling
              </>
            )}
          </div>

          {/* Active Speaker */}
          {activeSpeaker && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="flex items-center gap-1 bg-primary/15 border border-primary/30 text-primary text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {activeSpeaker} spricht
              </span>
            </div>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Message List */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            <Radio className="w-4 h-4 mx-auto mb-2 opacity-50" />
            Funk-Kanal aktiv — warte auf Nachrichten...
          </div>
        )}
        {messages.map((msg, i) => {
          const isCoach = msg.from === 'coach';
          return (
            <motion.div key={msg.id || i}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-1.5 rounded-xl text-xs ${
                msg.is_ppt
                  ? 'bg-primary/10 border border-primary/20 text-primary italic'
                  : isCoach
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground border border-border'
              }`}>
                {!isCoach && (
                  <div className="text-[9px] font-bold text-muted-foreground mb-0.5 uppercase tracking-wider">
                    {msg.from_label || msg.from}
                  </div>
                )}
                <div>{msg.text}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Waveform wenn Kamera spricht */}
      {activeSpeaker && (
        <div className="px-3 py-1.5 border-t border-border/30 bg-primary/5">
          <AudioWaveform isActive={true} />
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-border space-y-2">
        {/* Text Input */}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendText()}
            placeholder="Nachricht an alle Kameras..."
            className="flex-1 bg-muted border border-input rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={sendText} disabled={!text.trim()}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-all active:scale-95">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Waveform während PTT */}
        {pttActive && <AudioWaveform isActive={pttActive} />}

        {/* PTT Button */}
        <button
          onMouseDown={() => handlePTT(true)}
          onMouseUp={() => handlePTT(false)}
          onTouchStart={e => { e.preventDefault(); handlePTT(true); }}
          onTouchEnd={e => { e.preventDefault(); handlePTT(false); }}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all select-none touch-manipulation ${
            pttActive
              ? 'bg-primary text-primary-foreground neon-glow scale-[0.98]'
              : 'bg-muted border border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
          }`}>
          {pttActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          {pttActive ? 'SPRECHEN...' : 'Push-to-Talk halten'}
        </button>
      </div>
    </div>
  );
}