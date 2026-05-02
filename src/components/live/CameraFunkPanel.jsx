/**
 * CameraFunkPanel — Walkie-Talkie für Kameramann (CameraView)
 * Kompakt, optimiert für Mobile-Vollbild-Overlay
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Send, Mic, MicOff, ChevronDown } from 'lucide-react';

const POLL_MS = 2000;
const MAX_MSGS = 20;

export default function CameraFunkPanel({ sessionId, camLabel, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [pttActive, setPttActive] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [unread, setUnread] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const pollRef = useRef(null);
  const listRef = useRef(null);
  const seenCountRef = useRef(0);

  const from = `camera_${camLabel || '1'}`;
  const fromLabel = camLabel ? `Kamera ${camLabel}` : 'Kamera';

  useEffect(() => {
    if (!sessionId) return;

    const fetchMsgs = async () => {
      const all = await base44.entities.FunkMessage.filter({ session_id: sessionId });
      const sorted = all.sort((a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0)).slice(-MAX_MSGS);
      setMessages(sorted);

      // Unread counter (Nachrichten vom Trainer die neu sind)
      const newFromCoach = sorted.filter(m => m.from === 'coach' && !m.is_ptt).length;
      if (newFromCoach > seenCountRef.current && !expanded) {
        setUnread(newFromCoach - seenCountRef.current);
      }
      if (expanded) {
        seenCountRef.current = newFromCoach;
        setUnread(0);
      }

      // Aktiver Sprecher
      const pttMsg = sorted.slice().reverse().find(m => m.is_ptt && m.ptt_active);
      if (pttMsg && Date.now() - (pttMsg.timestamp_ms || 0) < 5000) {
        setActiveSpeaker(pttMsg.from_label || pttMsg.from);
      } else {
        setActiveSpeaker(null);
      }
    };

    fetchMsgs();
    pollRef.current = setInterval(fetchMsgs, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [sessionId, expanded]);

  useEffect(() => {
    if (expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
      seenCountRef.current = messages.filter(m => m.from === 'coach' && !m.is_ptt).length;
      setUnread(0);
    }
  }, [expanded, messages]);

  const sendText = async () => {
    if (!text.trim()) return;
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from,
      from_label: fromLabel,
      text: text.trim(),
      is_ptt: false,
      timestamp_ms: Date.now(),
    });
    setText('');
  };

  const handlePTT = async (active) => {
    setPttActive(active);
    await base44.entities.FunkMessage.create({
      session_id: sessionId,
      from,
      from_label: fromLabel,
      text: active ? `🎙 ${fromLabel} spricht...` : `📻 ${fromLabel} fertig`,
      is_ptt: true,
      ptt_active: active,
      timestamp_ms: Date.now(),
    });
  };

  return (
    <div className="w-full">
      {/* Toggle Row */}
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-black/80 backdrop-blur border-t border-white/10"
      >
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${activeSpeaker ? 'text-primary animate-pulse' : 'text-white/60'}`} />
          <span className="text-white text-xs font-bold">📻 Funk</span>
          {activeSpeaker && (
            <span className="text-[10px] text-primary animate-pulse">{activeSpeaker} spricht</span>
          )}
          {unread > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {unread}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 280 }} exit={{ height: 0 }}
            className="overflow-hidden bg-black/90 backdrop-blur border-t border-white/10 flex flex-col"
          >
            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {messages.filter(m => !m.is_ptt || !m.ptt_active).length === 0 && (
                <div className="text-center text-[11px] text-white/30 py-4">Noch keine Nachrichten</div>
              )}
              {messages.map((msg, i) => {
                if (msg.is_ptt && msg.ptt_active) return null;
                const isMe = msg.from === from;
                return (
                  <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-2.5 py-1 rounded-xl text-xs ${
                      msg.is_ptt
                        ? 'text-primary/70 italic text-[10px]'
                        : isMe
                          ? 'bg-primary/80 text-white'
                          : 'bg-white/10 text-white border border-white/10'
                    }`}>
                      {!isMe && !msg.is_ptt && (
                        <div className="text-[9px] text-white/40 mb-0.5 font-bold uppercase">{msg.from_label || msg.from}</div>
                      )}
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="px-3 py-2 border-t border-white/10 space-y-2">
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendText()}
                  placeholder="Nachricht an Trainer..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60"
                />
                <button onClick={sendText} disabled={!text.trim()}
                  className="px-3 rounded-lg bg-primary/80 text-white disabled:opacity-40 active:scale-95 transition-all">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* PTT */}
              <button
                onMouseDown={() => handlePTT(true)}
                onMouseUp={() => handlePTT(false)}
                onTouchStart={e => { e.preventDefault(); handlePTT(true); }}
                onTouchEnd={e => { e.preventDefault(); handlePTT(false); }}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all select-none touch-manipulation ${
                  pttActive
                    ? 'bg-primary text-white scale-[0.98]'
                    : 'bg-white/10 border border-white/20 text-white/70'
                }`}>
                {pttActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                {pttActive ? 'SPRECHEN...' : 'Push-to-Talk halten'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}