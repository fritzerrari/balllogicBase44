/**
 * TabletSidebar — Icon-only Sidebar für Tablet (md breakpoint)
 * Hover zeigt Tooltip mit Label
 */
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Video, Radio, BarChart3,
  FileText, Settings, Zap, Bot, Search, Dumbbell,
  Users, Layers, Shield, Calendar, ClipboardList,
  BookOpen, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const PRIMARY_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Video, label: 'Spiele', path: '/matches' },
  { icon: Radio, label: 'Live-Session', path: '/live', live: true },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
];

const TOOLS_NAV = [
  { icon: Bot, label: 'KI-Assistent', path: '/assistant' },
  { icon: Search, label: 'Scouting', path: '/scouting' },
  { icon: Dumbbell, label: 'Training', path: '/training' },
  { icon: Users, label: 'Kader', path: '/players' },
  { icon: Layers, label: 'Taktik-Board', path: '/tactics-board' },
  { icon: Calendar, label: 'Archiv', path: '/archive' },
];

const BOTTOM_NAV = [
  { icon: ClipboardList, label: 'Ereignisse', path: '/events' },
  { icon: Settings, label: 'Einstellungen', path: '/settings' },
];

function NavIcon({ icon: IconComp, label, path, live }) {
  const Icon = IconComp;
  const location = useLocation();
  const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <Link
      to={path}
      title={label}
      className={cn(
        'relative group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200',
        active
          ? 'bg-primary/20 text-primary border border-primary/30'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="w-5 h-5" />
      {live && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      )}
      {/* Tooltip */}
      <div className="absolute left-full ml-3 px-2 py-1 bg-popover border border-border rounded-md text-xs text-foreground font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
        {label}
      </div>
    </Link>
  );
}

export default function TabletSidebar() {
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  return (
    <aside className="h-screen w-16 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-1 z-50">
      {/* Logo */}
      <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center mb-4 neon-glow flex-shrink-0">
        <Zap className="w-4 h-4 text-primary-foreground" />
      </div>

      {/* Primary Nav */}
      <div className="flex flex-col gap-1 w-full px-3">
        {PRIMARY_NAV.map(item => (
          <NavIcon key={item.path} {...item} />
        ))}
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-border my-2" />

      {/* Tools Nav */}
      <div className="flex flex-col gap-1 w-full px-3 flex-1">
        {TOOLS_NAV.map(item => (
          <NavIcon key={item.path} {...item} />
        ))}
      </div>

      {/* Admin (if admin) */}
      {user?.role === 'admin' && (
        <>
          <div className="w-8 h-px bg-border my-1" />
          <div className="px-3">
            <NavIcon icon={Shield} label="Admin" path="/admin" />
          </div>
        </>
      )}

      {/* Bottom */}
      <div className="flex flex-col gap-1 w-full px-3 mt-auto">
        {BOTTOM_NAV.map(item => (
          <NavIcon key={item.path} {...item} />
        ))}
      </div>

      {/* User Avatar */}
      <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mt-2 flex-shrink-0" title={user?.full_name || 'User'}>
        <span className="text-xs font-bold text-primary">
          {user?.full_name?.[0]?.toUpperCase() || 'T'}
        </span>
      </div>
    </aside>
  );
}