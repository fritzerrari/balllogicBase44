import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';
import AppLayout from './components/layout/AppLayout';
// Pages
import Dashboard from './pages/Dashboard';
import Matches from './pages/Matches';
import NewMatch from './pages/NewMatch';
import MatchDetail from './pages/MatchDetail';
import TacticsAnalysis from './pages/TacticsAnalysis';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import HalftimeReport from './pages/HalftimeReport';
import AIAssistant from './pages/AIAssistant';
import ScoutingReport from './pages/ScoutingReport';
import TrainingPlan from './pages/TrainingPlan';
import MatchPrep from './pages/MatchPrep';
import LiveSession from './pages/LiveSession';
import CameraView from './pages/CameraView';
import AdminDocs from './pages/AdminDocs.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import Players from './pages/Players.jsx';
import ChangelogPage from './pages/ChangelogPage.jsx';
import EventReview from './pages/EventReview.jsx';
import TacticsBoard from './pages/TacticsBoard.jsx';
import SessionReports from './pages/SessionReports.jsx';
import AnalyticsCockpit from './pages/AnalyticsCockpit.jsx';
import AdminManual from './pages/AdminManual.jsx';
import AdminDemo from './pages/AdminDemo.jsx';
import AdminExampleReport from './pages/AdminExampleReport.jsx';
import SessionArchive from './pages/SessionArchive.jsx';
import ScoutingDashboard from './pages/ScoutingDashboard.jsx';
import PromiseLog from './pages/admin/PromiseLog.jsx';
import AdminCreditsAudit from './pages/admin/AdminCreditsAudit.jsx';
import AdminErrorLog from './pages/admin/AdminErrorLog.jsx';
import CameraStreamDebug from './pages/admin/CameraStreamDebug.jsx';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse">
            <div className="w-5 h-5 rounded bg-primary/60" />
          </div>
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/matches/new" element={<NewMatch />} />
        <Route path="/matches/:id" element={<MatchDetail />} />
        <Route path="/tactics/:id" element={<TacticsAnalysis />} />
        <Route path="/live" element={<LiveSession />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/halftime/:id" element={<HalftimeReport />} />
        <Route path="/assistant" element={<AIAssistant />} />
        <Route path="/scouting" element={<ScoutingReport />} />
        <Route path="/training" element={<TrainingPlan />} />
        <Route path="/matchprep" element={<MatchPrep />} />
        <Route path="/players" element={<Players />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/events" element={<EventReview />} />
        <Route path="/tactics-board" element={<TacticsBoard />} />
        <Route path="/session-reports" element={<SessionReports />} />
        <Route path="/analytics" element={<AnalyticsCockpit />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/docs" element={<AdminDocs />} />
        <Route path="/admin/manual" element={<AdminManual />} />
        <Route path="/admin/demo" element={<AdminDemo />} />
        <Route path="/admin/example-report" element={<AdminExampleReport />} />
        <Route path="/archive" element={<SessionArchive />} />
        <Route path="/scouting-dashboard" element={<ScoutingDashboard />} />
        <Route path="/admin/promise-log" element={<PromiseLog />} />
        <Route path="/admin/credits-audit" element={<AdminCreditsAudit />} />
        <Route path="/admin/error-log" element={<AdminErrorLog />} />
        <Route path="/admin/camera-stream-debug" element={<CameraStreamDebug />} />
      </Route>
      {/* Public routes — no login required */}
      <Route path="/cam" element={<CameraView />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;