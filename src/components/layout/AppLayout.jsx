import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar />
      </div>
      {/* Main Content */}
      <main className="flex-1 lg:ml-64 overflow-y-auto" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="lg:pb-0">
          <Outlet />
        </div>
      </main>
      {/* Mobile Bottom Nav */}
      <div className="lg:hidden">
        <MobileNav />
      </div>
    </div>
  );
}