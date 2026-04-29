import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Video, Radio, BarChart3, 
  FileText, Settings, Zap, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Spiele', icon: Video, path: '/matches' },
  { label: 'Live-Analyse', icon: Radio, path: '/live', badge: 'LIVE' },
  { label: 'Taktik-Board', icon: BarChart3, path: '/tactics' },
  { label: 'Reports', icon: FileText, path: '/reports' },
  { label: 'Einstellungen', icon: Settings, path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();

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
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ label, icon: Icon, path, badge }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
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
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">A</span>
          </div>
          <div>
            <div className="text-xs font-medium text-foreground">Analyst</div>
            <div className="text-[10px] text-muted-foreground">FC TactIQ</div>
          </div>
        </div>
      </div>
    </aside>
  );
}