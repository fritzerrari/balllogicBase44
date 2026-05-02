import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Video, Radio, BarChart3, 
  FileText, Settings, Zap, ChevronRight, Bot,
  Search, Dumbbell, ChevronDown, ChevronUp, Tv2, BookOpen, Users, Shield, ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Spiele', icon: Video, path: '/matches' },
  { label: 'Live-Analyse', icon: Radio, path: '/live', badge: 'LIVE' },
  { label: 'Coaching Cockpit', icon: Tv2, path: '/cockpit' },
  { label: 'Taktik-Board', icon: BarChart3, path: '/tactics', hideOnSidebar: true },
  { label: 'Reports', icon: FileText, path: '/reports' },
];

const toolsItems = [
  { label: 'KI-Assistent', icon: Bot, path: '/assistant' },
  { label: 'Scouting', icon: Search, path: '/scouting' },
  { label: 'Trainingsplan', icon: Dumbbell, path: '/training' },
  { label: 'Spielvorbereitung', icon: Zap, path: '/matchprep' },
  { label: 'Kader & Performance', icon: Users, path: '/players' },
  { label: 'Taktik-Board', icon: BarChart3, path: '/tactics-board' },
  { label: 'Berichte', icon: FileText, path: '/session-reports' },
  { label: 'Analytics Cockpit', icon: BarChart3, path: '/analytics', badge: 'NEU' },
];

const bottomItems = [
  { label: 'Einstellungen', icon: Settings, path: '/settings' },
  { label: 'Changelog', icon: BookOpen, path: '/changelog' },
  { label: 'Ereignis-Protokoll', icon: ClipboardList, path: '/events' },
  { label: 'Admin-Dashboard', icon: Shield, path: '/admin', adminOnly: true },
  { label: 'Admin-Handbuch', icon: BookOpen, path: '/admin/manual', adminOnly: true },
  { label: 'Admin-Demo', icon: Tv2, path: '/admin/demo', adminOnly: true },
  { label: 'Example Report', icon: FileText, path: '/admin/example-report', adminOnly: true },
  { label: 'Admin-Doku', icon: BookOpen, path: '/admin/docs', adminOnly: true },
];

function NavLink({ label, icon: Icon, path, badge }) {
  const location = useLocation();
  const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  return (
    <Link
      to={path}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
        active
          ? 'bg-primary/15 text-primary border border-primary/20'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon className={cn('w-4 h-4 flex-shrink-0', active && 'text-primary')} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded bg-destructive text-white animate-pulse">
          {badge}
        </span>
      )}
      {active && <ChevronRight className="w-3 h-3 text-primary" />}
    </Link>
  );
}

export default function Sidebar() {
  const [toolsOpen, setToolsOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  // Poll for active live session
  const { data: activeSessions = [] } = useQuery({
    queryKey: ['sidebar-active-session'],
    queryFn: () => base44.entities.LiveSession.filter({ status: 'active' }),
    refetchInterval: 10000,
  });
  const activeSession = activeSessions[0] || null;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center neon-glow">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-grotesk font-700 text-foreground text-lg tracking-tight">TactIQ</span>
            <div className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">KI-Analyse</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.filter(n => !n.hideOnSidebar).map((item) => (
          <NavLink key={item.path} {...item} />
        ))}

        {/* Tools Section */}
        <div className="pt-3 pb-1">
          <button
            onClick={() => setToolsOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground font-bold uppercase tracking-widest hover:text-foreground transition-colors"
          >
            <span>KI-Tools</span>
            {toolsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
        {toolsOpen && toolsItems.map((item) => (
          <NavLink key={item.path} {...item} />
        ))}

        <div className="pt-2" />
        {bottomItems
          .filter(item => !item.adminOnly || user?.role === 'admin')
          .map((item) => (
            <NavLink key={item.path} {...item} />
          ))}
      </nav>

      {/* Active Live Session Banner */}
      {activeSession && location.pathname !== '/live' && (
        <button
          onClick={() => navigate('/live')}
          className="mx-3 mb-2 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all"
        >
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs font-bold truncate">LIVE läuft</div>
            <div className="text-[10px] text-red-400/70 truncate">{activeSession.match_title}</div>
          </div>
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
        </button>
      )}

      {/* Footer — User Info */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">
              {user?.full_name?.[0]?.toUpperCase() || 'T'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-foreground truncate">
              {user?.full_name || 'Trainer'}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              {user?.role === 'admin'
                ? <><span className="text-primary font-bold">Admin</span></>
                : <span>Trainer</span>}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}