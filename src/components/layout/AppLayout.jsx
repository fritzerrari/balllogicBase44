import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import TabletSidebar from './TabletSidebar';

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar — lg+ */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar />
      </div>

      {/* Tablet Sidebar — md only (icons-only collapsible) */}
      <div className="hidden md:block lg:hidden flex-shrink-0">
        <TabletSidebar />
      </div>

      {/* Main Content */}
      <main
        className="flex-1 overflow-y-auto min-w-0"
        style={{
          paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
          marginLeft: 0,
        }}
      >
        {/* Tablet gets slightly more padding top, mobile normal */}
        <div className="md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav — only on small screens */}
      <div className="md:hidden">
        <MobileNav />
      </div>
    </div>
  );
}