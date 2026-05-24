import React from 'react';
import { Link } from 'react-router-dom';
import Container from '@/components/common/Container.jsx';
import { ROUTES } from '@/config/routes.js';

const Footer = () => {
  return (
    <footer className="bg-[hsl(var(--color-deep-slate))] text-[hsl(var(--color-warm-white))] py-16">
      <Container>
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8 mb-12">
          <Link to={ROUTES.HOME} className="text-2xl font-heading font-extrabold tracking-tight">
            Localayer AI
          </Link>
          
          <nav className="flex flex-wrap justify-center gap-6">
            <Link to={ROUTES.SERVICES} className="text-white/70 hover:text-white transition-colors text-sm font-medium">Services</Link>
            <Link to={ROUTES.HOW_IT_WORKS} className="text-white/70 hover:text-white transition-colors text-sm font-medium">How It Works</Link>
            <Link to={ROUTES.PRICING} className="text-white/70 hover:text-white transition-colors text-sm font-medium">Pricing</Link>
            <Link to={ROUTES.CONTACT} className="text-white/70 hover:text-white transition-colors text-sm font-medium">Contact</Link>
          </nav>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-white/50">
          <p>© 2025 Localayer AI. All rights reserved. · In business since 2018.</p>
          <div className="flex gap-6">
            <span className="hover:text-white cursor-pointer transition-colors">Privacy Policy</span>
            <span className="hover:text-white cursor-pointer transition-colors">Terms of Service</span>
          </div>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;