/**
 * AnalyticsCockpit — Das zentrale Analyse-Cockpit von TactIQ
 * 
 * Tabs:
 *  1. Eigenes Team — Tiefenanalyse, Schwachstellen, Verbesserungspotenziale
 *  2. Gegner — KI-Gegneranalyse, Schlüsselspieler, Taktik-Empfehlungen
 *  3. Spieler — Individuelle Leistungsanalysen (eigene)
 *  4. Gegnerspieler — Freischaltbare Detailanalysen
 * 
 * Verknüpft mit: Match, Players, SessionReports
 * PDF-Export: Kurz / Mittel / Lang
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AnimatePresence } from 'framer-motion';
import AnalyticsCockpitHeader from '@/components/analytics/AnalyticsCockpitHeader';
import OwnTeamPanel from '@/components/analytics/OwnTeamPanel';
import OpponentPanel from '@/components/analytics/OpponentPanel';
import PlayersAnalyticsPanel from '@/components/analytics/PlayersAnalyticsPanel';
import PDFExportModal from '@/components/analytics/PDFExportModal';

const urlParams = new URLSearchParams(window.location.search);

export default function AnalyticsCockpit() {
  const matchId = urlParams.get('match');
  const [activeTab, setActiveTab] = useState('own');
  const [showPDF, setShowPDF] = useState(false);

  const { data: match } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => base44.entities.Match.filter({ id: matchId }).then(r => r[0]),
    enabled: !!matchId,
  });

  const { data: analysisReport } = useQuery({
    queryKey: ['analysis-report', matchId],
    queryFn: () => base44.entities.AnalysisReport.filter({ match_id: matchId }).then(r => r[0]),
    enabled: !!matchId,
  });

  const { data: ownAnalysis } = useQuery({
    queryKey: ['team-analyses-own', matchId],
    queryFn: () => base44.entities.TeamAnalysis.filter({ analysis_type: 'own_team', match_id: matchId }).then(r => r[0]),
    enabled: !!matchId,
  });

  const { data: playerAnalyses = [] } = useQuery({
    queryKey: ['team-analyses-player'],
    queryFn: () => base44.entities.TeamAnalysis.filter({ analysis_type: 'player' }),
  });

  return (
    <div className="p-4 lg:p-8 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <AnalyticsCockpitHeader
          match={match}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onExportPDF={() => setShowPDF(true)}
        />

        {/* Tab Content */}
        <div>
          {activeTab === 'own' && (
            <OwnTeamPanel match={match} analysisReport={analysisReport} />
          )}
          {activeTab === 'opponent' && (
            <OpponentPanel match={match} />
          )}
          {activeTab === 'players' && (
            <PlayersAnalyticsPanel match={match} />
          )}
          {activeTab === 'opponent_players' && (
            <OpponentPanel match={match} showPlayersOnly />
          )}
        </div>
      </div>

      {/* PDF Export Modal */}
      <AnimatePresence>
        {showPDF && (
          <PDFExportModal
            analysis={ownAnalysis}
            match={match}
            playerAnalyses={playerAnalyses}
            onClose={() => setShowPDF(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}