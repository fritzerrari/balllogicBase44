import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
// Pages
import Dashboard from './pages/Dashboard';
import Matches from './pages/Matches';
import NewMatch from './pages/NewMatch';
import MatchDetail from './pages/MatchDetail';
import TacticsAnalysis from './pages/TacticsAnalysis';
import LiveSession from './pages/LiveSession';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import HalftimeReport from './pages/HalftimeReport';
import AIAssistant from './pages/AIAssistant';
import ScoutingReport from './pages/ScoutingReport';
import TrainingPlan from './pages/TrainingPlan';
import MatchPrep from './pages/MatchPrep';
import CoachingCockpit from './pages/CoachingCockpit';
import CameraView from './pages/CameraView';

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
        <Route path="/cockpit" element={<CoachingCockpit />} />
      </Route>
      {/* Public camera page — no login required */}
      <Route path="/cam" element={<CameraView />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;