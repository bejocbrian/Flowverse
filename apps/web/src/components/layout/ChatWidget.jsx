import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import IntegratedAiChat from '@/components/integrated-ai-chat.jsx';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[350px] sm:w-[400px] h-[500px] max-h-[calc(100vh-120px)] bg-card shadow-2xl rounded-2xl border overflow-hidden flex flex-col"
          >
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
              <span className="font-semibold font-heading">Ask Localayer AI</span>
              <button onClick={() => setIsOpen(false)} aria-label="Close chat">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <div className="absolute inset-0 [&>div]:h-full">
                <IntegratedAiChat />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-all duration-200"
      >
        {isOpen ? <X className="w-5 h-5" /> : <><MessageSquare className="w-5 h-5" /><span className="font-medium">Ask us anything</span></>}
      </button>
    </div>
  );
};

export default ChatWidget;