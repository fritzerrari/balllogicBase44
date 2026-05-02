/**
 * MobileNav — Bottom Navigation für Mobile
 */
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Video, Radio, Users, Settings, Tv2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Video, label: 'Spiele', path: '/matches' },
  { icon: Radio, label: 'Live', path: '/live' },
  { icon: Tv2, label: 'Cockpit', path: '/cockpit' },
  { icon: Users, label: 'Kader', path: '/players' },
  { icon: Settings, label: 'Mehr', path: '/settings' },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border safe-bottom">
      <div className="flex items-stretch">
        {NAV.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link key={path} to={path} className={cn(
              'flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors min-w-0',
              active ? 'text-primary' : 'text-muted-foreground'
            )}>
              <Icon className={cn('w-5 h-5', active && 'text-primary')} />
              <span className="truncate px-1">{label}</span>
              {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}