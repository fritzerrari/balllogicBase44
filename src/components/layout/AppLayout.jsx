import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import TabletSidebar from './TabletSidebar';

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar — lg+ */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Tablet Sidebar — md only (icon-only) */}
      <div className="hidden md:flex lg:hidden flex-shrink-0">
        <TabletSidebar />
      </div>

      {/* Main Content — fills remaining space */}
      <main className="flex-1 overflow-y-auto min-w-0 pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav — only below md */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <MobileNav />
      </div>
    </div>
  );
}