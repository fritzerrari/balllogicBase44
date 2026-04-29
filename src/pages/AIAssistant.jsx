import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Zap, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const QUICK_PROMPTS = [
  'Was sind unsere größten taktischen Schwächen?',
  'Welche Formation empfiehlst du gegen starkes Pressing?',
  'Worauf soll ich im Training diese Woche fokussieren?',
  'Wann werden wir am häufigsten ausgekontert?',
  'Wie ist unsere Pressing-Effizienz im Vergleich zu letzten Spielen?',
];

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hallo Coach! Ich bin dein KI-Co-Trainer. Frag mich zu Taktik, Aufstellung, Trainingsplanung oder Gegneranalyse — ich nutze eure Spielhistorie als Basis.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => base44.entities.Match.list('-date', 10),
  });
  const { data: reports = [] } = useQuery({
    queryKey: ['reports-all'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date', 5),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContext = () => {
    const matchSummary = matches.slice(0, 5).map(m =>
      `${m.title} (${m.date}): ${m.score_home ?? '?'}–${m.score_away ?? '?'}, Status: ${m.status}`
    ).join('\n');
    const reportSummary = reports.slice(0, 3).map(r =>
      `${r.match_title}: Formation ${r.formation_home}, Pressing ${r.pressing_index_home}/100, Besitz ${r.possession_home?.toFixed(0)}%`
    ).join('\n');
    return `LETZTE SPIELE:\n${matchSummary || 'Keine Daten'}\n\nANALYSE-DATEN:\n${reportSummary || 'Keine Reports'}`;
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein erfahrener Fußball-Co-Trainer. Antworte kurz und präzise (max 4 Sätze).
Kontext aus der App:\n${buildContext()}\n\nFrage des Trainers: ${msg}`,
    });
    setMessages(prev => [...prev, { role: 'assistant', text: response }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-screen p-6 lg:p-8 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center neon-glow">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-grotesk font-bold text-foreground">KI-Assistent</h1>
        </div>
        <p className="text-sm text-muted-foreground">Dein KI-Co-Trainer — kennt eure Spielhistorie</p>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                msg.role === 'assistant' ? 'bg-primary/20 text-primary' : 'bg-secondary text-foreground'
              }`}>
                {msg.role === 'assistant' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? 'glass border border-border text-foreground'
                  : 'bg-primary text-primary-foreground'
              }`}>
                {msg.text}
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="glass border border-border px-4 py-3 rounded-2xl flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">Denkt nach...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => sendMessage(p)}
              className="text-xs px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Frag deinen Co-Trainer..."
          className="bg-muted border-border flex-1"
          disabled={loading}
        />
        <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} className="bg-primary text-primary-foreground neon-glow">
          <Send className="w-4 h-4" />
        </Button>
        {messages.length > 1 && (
          <Button variant="ghost" onClick={() => setMessages([messages[0]])} className="text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}