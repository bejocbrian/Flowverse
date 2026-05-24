import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const DemoCard = ({ title, description, imageSrc, demoUrl, onViewDemo, index = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="bg-card rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border-t-4 border-t-primary border-x border-b border-border flex flex-col h-full overflow-hidden"
    >
      <div className="w-full h-48 overflow-hidden bg-muted relative">
        <img 
          src={imageSrc} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
        />
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-semibold mb-3 text-foreground">{title}</h3>
        <p className="text-muted-foreground leading-relaxed flex-grow mb-6">{description}</p>
        <Button
          onClick={() => onViewDemo ? onViewDemo(demoUrl) : console.log(`Viewing demo: ${demoUrl}`)}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-auto transition-colors"
        >
          View Demo
        </Button>
      </div>
    </motion.div>
  );
};

export default DemoCard;