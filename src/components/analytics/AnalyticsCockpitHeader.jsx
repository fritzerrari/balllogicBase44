/**
 * AnalyticsCockpitHeader — Professioneller Header mit Match-Infos und Tab-Navigation
 */
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Trophy, MapPin, Zap, FileDown } from 'lucide-react';

const tabs = [
  { id: 'own', label: 'Eigenes Team', emoji: '🏠' },
  { id: 'opponent', label: 'Gegner', emoji: '⚔️' },
  { id: 'players', label: 'Spieler', emoji: '👤' },
  { id: 'opponent_players', label: 'Gegnerspieler', emoji: '🔍', locked: false },
];

export default function AnalyticsCockpitHeader({ match, activeTab, onTabChange, onExportPDF }) {
  const scoreDisplay = match?.score_home !== undefined && match?.score_away !== undefined
    ? `${match.score_home} : ${match.score_away}`
    : null;

  return (
    <div className="mb-6">
      {/* Back */}
      <div className="flex items-center justify-between mb-4">
        <Link to={match ? `/matches/${match.id}` : '/matches'}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zum Spiel
        </Link>
        <button onClick={onExportPDF}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-bold hover:bg-primary/25 transition-all">
          <FileDown className="w-4 h-4" /> PDF Export
        </button>
      </div>

      {/* Match Hero */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 mb-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">TactIQ Analytics Cockpit</span>
        </div>
        
        {match ? (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl lg:text-2xl font-grotesk font-bold text-foreground">{match.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                {match.date && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{match.date}</span>
                )}
                {match.competition && (
                  <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />{match.competition}</span>
                )}
                {match.venue && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{match.venue}</span>
                )}
              </div>
            </div>
            {scoreDisplay && (
              <div className="text-center">
                <div className="text-4xl font-grotesk font-black text-foreground">{scoreDisplay}</div>
                <div className="text-xs text-muted-foreground mt-1">Endstand</div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-grotesk font-bold text-foreground">Gesamt-Analyse</h1>
            <p className="text-sm text-muted-foreground mt-1">Übergreifende Auswertung aller Spiele</p>
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-muted text-muted-foreground border border-transparent hover:text-foreground hover:border-border'
            }`}>
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}