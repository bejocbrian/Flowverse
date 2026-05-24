import React from 'react';
import { motion } from 'framer-motion';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import ChatWidget from './ChatWidget.jsx';

const MainLayout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <motion.main 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 w-full"
      >
        {children}
      </motion.main>
      <Footer />
      <ChatWidget />
    </div>
  );
};

export default MainLayout;