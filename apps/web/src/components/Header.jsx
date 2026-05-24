import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { label: 'Generate', path: '/app/generate' },
    { label: 'Library', path: '/app/library' },
    { label: 'Settings', path: '/app/settings' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[hsl(var(--surface))]/80 backdrop-blur-md border-b border-[hsl(var(--border-subtle))]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex-shrink-0 relative z-50">
            <span className="text-lg font-semibold tracking-tight text-[hsl(var(--text-primary))]">
              Aether Video
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-medium transition-colors duration-200 relative ${
                    isActive
                      ? 'text-[hsl(var(--accent-primary))] font-bold'
                      : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent-primary))]'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="header-nav-indicator"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[hsl(var(--accent-primary))]"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login">
              <button className="px-6 py-2 text-sm font-medium text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors glass-panel-hover rounded-xl">
                Sign In
              </button>
            </Link>
            <Link to="/signup">
              <button className="px-6 py-2 text-sm font-semibold bg-[hsl(var(--accent-primary))] hover:bg-[hsl(var(--accent-primary-container))] text-white rounded-xl transition-all shadow-lg shadow-[hsl(var(--accent-primary-container))]/20">
                Get Started
              </button>
            </Link>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-[hsl(var(--text-primary))] p-2 relative z-50"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: '100vh' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden absolute top-0 left-0 w-full bg-[hsl(var(--canvas))] pt-24 px-6 pb-8 overflow-y-auto"
          >
            <nav className="flex flex-col gap-6">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`text-2xl font-semibold transition-colors ${
                      isActive ? 'text-[hsl(var(--accent-primary))]' : 'text-[hsl(var(--text-primary))] hover:text-[hsl(var(--accent-primary))]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <div className="pt-6 border-t border-[hsl(var(--border-subtle))] mt-2 space-y-3">
                <Link to="/login">
                  <button className="block w-full text-center px-6 py-3 glass-panel rounded-xl text-lg font-medium">
                    Sign In
                  </button>
                </Link>
                <Link to="/signup">
                  <button className="block w-full text-center bg-[hsl(var(--accent-primary))] text-white px-6 py-3 rounded-xl text-lg font-semibold">
                    Get Started
                  </button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;