/**
 * OpponentAnalysisModal – Detaillierte KI-Analyse eines Gegner-Spielers
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OpponentAnalysisModal({ player, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Analysiere diesen Gegner-Spieler taktisch und gib konkrete Deckungsempfehlungen:

Name: ${player.name}
Position: ${player.position}
Nummer: ${player.number}
Alter: ${player.age}
Fuß: ${player.dominant_foot}
Gefährlichkeit: ${player.danger_rating}/10
Stärken: ${player.strengths}
Schwächen: ${player.weaknesses}
Spezielle Fähigkeiten: ${player.special_skills}

Antworte im JSON-Format mit:
{
  "tactics": "3-4 Sätze taktische Analyse",
  "coverage": "Konkrete Deckungsempfehlung (wie viele Spieler, Formation)",
  "threats": ["Bedrohung 1", "Bedrohung 2", "Bedrohung 3"],
  "defensive_focus": "Was sollte verteidigt werden"
}`,
          response_json_schema: {
            type: 'object',
            properties: {
              tactics: { type: 'string' },
              coverage: { type: 'string' },
              threats: { type: 'array', items: { type: 'string' } },
              defensive_focus: { type: 'string' },
            },
          },
        });
        setAnalysis(result.data || result);
      } catch (err) {
        console.error('Analysis failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [player]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="glass rounded-2xl w-full max-w-2xl border border-primary/20 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-b from-card to-card/80 px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-grotesk font-bold text-lg text-foreground">
                Spieler-Analyse: {player.name}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                #{player.number} · {player.position}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
                <p className="text-sm text-muted-foreground">KI-Analyse lädt...</p>
              </div>
            ) : analysis ? (
              <>
                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="glass rounded-lg p-3 text-center border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Alter</div>
                    <div className="font-bold text-foreground">{player.age}</div>
                  </div>
                  <div className="glass rounded-lg p-3 text-center border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Fuß</div>
                    <div className="font-bold text-foreground">{player.dominant_foot}</div>
                  </div>
                  <div className="glass rounded-lg p-3 text-center border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Gefahr</div>
                    <div className="font-bold text-red-400">{player.danger_rating}/10</div>
                  </div>
                  <div className="glass rounded-lg p-3 text-center border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Position</div>
                    <div className="font-bold text-foreground text-sm">{player.position.split(' ')[0]}</div>
                  </div>
                </div>

                {/* Taktik */}
                <div className="glass rounded-xl p-4 border border-primary/20">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Taktische Einschätzung
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed">
                    {analysis.tactics}
                  </p>
                </div>

                {/* Coverage */}
                <div className="glass rounded-xl p-4 border border-blue-500/20 bg-blue-500/5">
                  <h3 className="font-bold text-foreground mb-2">🛡️ Deckungsempfehlung</h3>
                  <p className="text-sm text-foreground">
                    {analysis.coverage}
                  </p>
                </div>

                {/* Threats */}
                {analysis.threats?.length > 0 && (
                  <div className="glass rounded-xl p-4 border border-red-500/20 bg-red-500/5">
                    <h3 className="font-bold text-foreground mb-3">⚠️ Haupt-Bedrohungen</h3>
                    <div className="space-y-2">
                      {analysis.threats.map((threat, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-red-400 font-bold mt-0.5">•</span>
                          <span className="text-sm text-foreground">{threat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Defensive Focus */}
                <div className="glass rounded-xl p-4 border border-yellow-500/20 bg-yellow-500/5">
                  <h3 className="font-bold text-foreground mb-2">📍 Defensiver Fokus</h3>
                  <p className="text-sm text-foreground">
                    {analysis.defensive_focus}
                  </p>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass rounded-lg p-3 border border-green-500/20">
                    <div className="text-xs text-green-400 font-bold mb-1">✓ STÄRKEN</div>
                    <p className="text-xs text-foreground">{player.strengths}</p>
                  </div>
                  <div className="glass rounded-lg p-3 border border-red-500/20">
                    <div className="text-xs text-red-400 font-bold mb-1">✗ SCHWÄCHEN</div>
                    <p className="text-xs text-foreground">{player.weaknesses}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Analyse nicht verfügbar
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gradient-to-t from-card to-card/80 px-6 py-4 border-t border-border flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Schließen
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}