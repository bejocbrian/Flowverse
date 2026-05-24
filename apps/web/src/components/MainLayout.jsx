
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx';
import { Coins, User, Settings, LogOut, Film, BarChart3, Layout, Zap } from 'lucide-react';
import pb from '@/lib/pocketbaseClient.js';
import { motion } from 'framer-motion';

const sideNavItems = [
  { icon: Film, label: 'Visuals', path: '/app/generate' },
  { icon: BarChart3, label: 'Audio', path: '/app/generate', disabled: true },
  { icon: Layout, label: 'Timeline', path: '/app/generate', disabled: true },
];

const MainLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { icon: 'dashboard', label: 'Dashboard', path: '/app/dashboard' },
    { icon: 'auto_awesome', label: 'Workspace', path: '/app/generate' },
    { icon: 'video_library', label: 'Library', path: '/app/library' },
    { icon: 'model_training', label: 'Models', path: '/app/models' },
    { icon: 'analytics', label: 'Analytics', path: '/app/analytics' },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans overflow-hidden">
      
      {/* Top Header Bar */}
      <header className="h-16 flex items-center justify-between px-6 z-50">
        
        {/* Left Side: Back & Title */}
        <div className="flex items-center gap-4 min-w-[200px]">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium opacity-80 whitespace-nowrap">
              {isActive('/app/generate') ? 'New Project' : 'Aether Video'}
            </span>
            <button className="p-1 hover:bg-white/10 rounded transition-all opacity-40">
              <span className="material-symbols-outlined text-base">more_vert</span>
            </button>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-2xl px-4">
          <div className="relative group">
            <input 
              type="text" 
              placeholder="Search or ask anything"
              className="w-full bg-[#1a1b1e] border border-white/5 rounded-full py-2.5 pl-12 pr-4 text-sm focus:bg-[#25262b] focus:border-white/20 transition-all outline-none"
            />
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/60">search</span>
            <button className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-all text-white/20">
              <span className="material-symbols-outlined text-lg">tune</span>
            </button>
          </div>
        </div>

        {/* Right Side: Tools & Profile */}
        <div className="flex items-center gap-2 min-w-[200px] justify-end">
          <button className="p-2 hover:bg-white/10 rounded-full transition-all text-white/60">
            <span className="material-symbols-outlined text-xl font-bold">add</span>
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-all text-white/60">
            <span className="material-symbols-outlined text-xl">side_navigation</span>
          </button>
          <button onClick={() => navigate('/app/settings')} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/60">
            <span className="material-symbols-outlined text-xl">settings</span>
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-all text-white/60">
            <span className="material-symbols-outlined text-xl">help</span>
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-2 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold ring-2 ring-transparent hover:ring-white/20 transition-all">
                {currentUser?.name?.charAt(0) || 'U'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1a1b1e] border border-white/10 text-white rounded-xl w-56">
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-sm font-semibold">{currentUser?.name}</p>
                <p className="text-xs text-white/40">{currentUser?.email}</p>
              </div>
              <DropdownMenuItem onClick={() => navigate('/app/settings')} className="hover:bg-white/5 cursor-pointer py-2 px-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">settings</span>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="hover:bg-white/5 cursor-pointer py-2 px-4 flex items-center gap-2 text-red-400">
                <span className="material-symbols-outlined text-lg">logout</span>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Vertical Sidebar */}
        <nav className="w-16 flex flex-col items-center py-6 gap-6 border-r border-white/5 shrink-0">
          {navItems.map((item) => (
            <button 
              key={item.path}
              onClick={() => navigate(item.path)}
              title={item.label}
              className={`p-2 rounded-xl transition-all duration-300 relative group ${
                isActive(item.path) 
                  ? 'bg-white/10 text-white shadow-glow-sm' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
              {isActive(item.path) && (
                <motion.div 
                  layoutId="activeNav"
                  className="absolute left-[-1px] top-1/4 bottom-1/4 w-[3px] bg-white rounded-r-full"
                />
              )}
              {/* Tooltip */}
              <div className="absolute left-16 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#1a1b1e] text-xs font-medium rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100]">
                {item.label}
              </div>
            </button>
          ))}
          
          <div className="mt-auto mb-2">
            <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/60">
              <span className="material-symbols-outlined text-2xl">add_box</span>
            </button>
          </div>
        </nav>

        {/* Main Workspace Area */}
        <main className="flex-1 overflow-auto flex flex-col relative bg-black">
          {children}
          
          {/* Footer Disclaimer */}
          <div className="absolute bottom-4 left-6 pointer-events-none opacity-40">
            <p className="text-[10px] font-medium italic">Aether Video can make mistakes, so double check it</p>
          </div>
        </main>

      </div>
    </div>
  );
};

export default MainLayout;
