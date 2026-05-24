
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx';
import { LayoutDashboard, Users, Settings, Server, ExternalLink, Menu, User, LogOut, X } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Providers', path: '/admin/providers', icon: Server },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--canvas))] flex">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-[hsl(var(--admin-sidebar))] border-r border-[hsl(var(--admin-border))] transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out z-50 flex flex-col`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-[hsl(var(--admin-border))]">
          <div className="flex items-center gap-2 font-bold text-lg">
            <span className="text-[hsl(var(--accent-primary))]">VideoAI</span>
            <span className="text-[hsl(var(--text-secondary))] text-sm font-normal px-2 py-0.5 rounded bg-[hsl(var(--admin-surface))]">Admin</span>
          </div>
          <button className="md:hidden text-[hsl(var(--text-secondary))]" onClick={() => setMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-[hsl(var(--accent-primary))]/10 text-[hsl(var(--accent-primary))]'
                    : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--admin-hover))]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[hsl(var(--admin-border))]">
          <Link
            to="/app/generate"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--admin-hover))] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 bg-[hsl(var(--canvas))] border-b border-[hsl(var(--admin-border))] sticky top-0 z-30 px-4 flex items-center justify-between">
          <button 
            className="md:hidden p-2 -ml-2 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden md:flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-[hsl(var(--text-secondary))]">System Operational</span>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {currentUser?.avatar ? (
                    <img
                      src={pb.files.getUrl(currentUser, currentUser.avatar)}
                      alt={currentUser.name}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[hsl(var(--accent-primary))]/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-[hsl(var(--accent-primary))]" />
                    </div>
                  )}
                  <span className="hidden md:inline">{currentUser?.name || 'Admin'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/app/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  My Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
