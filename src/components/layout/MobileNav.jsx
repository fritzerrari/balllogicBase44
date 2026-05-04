/**
 * MobileNav — Bottom Navigation für Mobile
 * 6 wichtigste Seiten + More-Drawer für Rest
 */
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Video, Radio, Tv2, Users, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { icon: LayoutDashboard, label: 'Home', path: '/' },
  { icon: Video, label: 'Spiele', path: '/matches' },
  { icon: Radio, label: 'Live', path: '/live' },
  { icon: Tv2, label: 'Cockpit', path: '/cockpit' },
  { icon: BarChart3, label: 'Analyse', path: '/analytics' },
  { icon: Users, label: 'Kader', path: '/players' },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-stretch h-14">
        {NAV.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link key={path} to={path} className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition-all min-w-0 relative',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <Icon className={cn('w-[18px] h-[18px]', active && 'text-primary')} />
              <span className="truncate leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}