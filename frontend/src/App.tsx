import { useState, useEffect } from 'react';
import LoginPage from './components/auth/LoginPage';
import Sidebar, { type Page } from './components/dashboard/Sidebar';
import MobileSidebar from './components/dashboard/MobileSidebar';
import TopBar from './components/dashboard/TopBar';
import Overview from './components/dashboard/Overview';
import ServicesPanel from './components/dashboard/ServicesPanel';
import LogsViewer from './components/dashboard/LogsViewer';
import NotesPanel from './components/dashboard/NotesPanel';
import FilesPanel from './components/dashboard/FilesPanel';
import GalleryPanel from './components/dashboard/GalleryPanel';
import VaultPanel from './components/dashboard/VaultPanel';
import BookmarksPanel from './components/dashboard/BookmarksPanel';
import SettingsPanel from './components/dashboard/SettingsPanel';
import AdminPanel from './components/dashboard/AdminPanel';
import { Loader2 } from 'lucide-react';

export interface UserSession {
  username: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  quotaBytes: number;
  usedBytes: number;
}

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch session details from /api/auth/me
  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data: UserSession = await res.json();
        setSession(data);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setSession(null);
      }
    } catch {
      setIsAuthenticated(false);
      setSession(null);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setIsAuthenticated(false);
        setSession(null);
        setCurrentPage('overview');
      }
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-brand-500 mb-4" />
        <p className="text-sm text-surface-400 font-medium">Loading MiniCloud session...</p>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated || !session) {
    return <LoginPage onLogin={fetchSession} />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'overview': return <Overview onNavigate={setCurrentPage} session={session} />;
      case 'services': return <ServicesPanel />;
      case 'logs': return <LogsViewer />;
      case 'notes': return <NotesPanel />;
      case 'files': return <FilesPanel onQuotaUpdate={fetchSession} session={session} />;
      case 'gallery': return <GalleryPanel onQuotaUpdate={fetchSession} session={session} />;
      case 'vault': return <VaultPanel />;
      case 'bookmarks': return <BookmarksPanel />;
      case 'admin': return <AdminPanel session={session} />;
      case 'settings': return <SettingsPanel session={session} onQuotaUpdate={fetchSession} />;
      default: return <Overview onNavigate={setCurrentPage} session={session} />;
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 text-surface-200">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          session={session}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile sidebar */}
      <MobileSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        session={session}
        onLogout={handleLogout}
      />

      {/* Main content */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        <TopBar
          currentPage={currentPage}
          onMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          mobileMenuOpen={mobileMenuOpen}
          onLogout={handleLogout}
        />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
