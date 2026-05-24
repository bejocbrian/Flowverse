import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Footer = () => {
  return (
    <footer className="bg-background text-foreground py-16 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8 mb-12">
          <Link to="/">
            <motion.img
              src="https://horizons-cdn.hostinger.com/03df9253-0fa4-4c6c-8608-34ee49e19ca5/69cb12d352eb8b71a4fac8439612ecd8.webp"
              alt="Localayer AI"
              className="h-10 w-auto transition-opacity duration-200 hover:opacity-80"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            />
          </Link>
          
          <nav className="flex flex-wrap justify-center md:justify-end gap-6 md:gap-8 text-center md:text-left">
            <Link to="/services" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">Services</Link>
            <Link to="/how-it-works" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">How It Works</Link>
            <Link to="/pricing" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">Pricing</Link>
            <Link to="/contact" className="text-foreground/70 hover:text-primary transition-colors text-sm font-medium">Contact</Link>
          </nav>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-foreground/60">
          <p>© 2025 Localayer AI. All rights reserved. · In business since 2018.</p>
          <div className="flex gap-6">
            <Link to="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="#" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;