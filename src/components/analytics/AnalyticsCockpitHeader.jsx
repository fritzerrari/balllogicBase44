/**
 * AnalyticsCockpitHeader — Professioneller Header mit Match-Infos und Tab-Navigation
 */
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Trophy, MapPin, Zap, FileDown } from 'lucide-react';

const tabs = [
  { id: 'own', label: 'Eigenes Team', shortLabel: 'Team', emoji: '🏠' },
  { id: 'opponent', label: 'Gegner', shortLabel: 'Gegner', emoji: '⚔️' },
  { id: 'players', label: 'Spieler', shortLabel: 'Spieler', emoji: '👤' },
  { id: 'opponent_players', label: 'Gegnerspieler', shortLabel: 'Scout', emoji: '🔍' },
];

export default function AnalyticsCockpitHeader({ match, activeTab, onTabChange, onExportPDF }) {
  const scoreDisplay = match?.score_home !== undefined && match?.score_away !== undefined
    ? `${match.score_home} : ${match.score_away}`
    : null;

  return (
    <div className="mb-6">
      {/* Back */}
      <div className="flex items-center justify-between mb-3">
        <Link to={match ? `/matches/${match.id}` : '/matches'}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Zurück zum Spiel</span>
          <span className="sm:hidden">Zurück</span>
        </Link>
        <button onClick={onExportPDF}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs sm:text-sm font-bold hover:bg-primary/25 transition-all">
          <FileDown className="w-4 h-4" />
          <span className="hidden sm:inline">PDF Export</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>

      {/* Match Hero — compact on mobile */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-3 sm:mb-4 border border-border">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
            <Zap className="w-3 h-3 text-primary" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Analytics Cockpit</span>
        </div>
        
        {match ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl lg:text-2xl font-grotesk font-bold text-foreground truncate">{match.title}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                {match.date && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{match.date}</span>
                )}
                {match.competition && (
                  <span className="hidden sm:flex items-center gap-1"><Trophy className="w-3 h-3" />{match.competition}</span>
                )}
              </div>
            </div>
            {scoreDisplay && (
              <div className="text-center flex-shrink-0">
                <div className="text-2xl sm:text-4xl font-grotesk font-black text-foreground">{scoreDisplay}</div>
                <div className="text-[10px] text-muted-foreground">Endstand</div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h1 className="text-lg sm:text-xl font-grotesk font-bold text-foreground">Gesamt-Analyse</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Übergreifende Auswertung aller Spiele</p>
          </div>
        )}
      </motion.div>

      {/* Tabs — scrollable on mobile, full labels on desktop */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'bg-muted text-muted-foreground border border-transparent hover:text-foreground hover:border-border'
            }`}>
            <span className="text-sm">{tab.emoji}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}