import React from 'react';
import { cn } from '@/lib/utils.js';

const Container = ({ children, className, ...props }) => {
  return (
    <div className={cn("w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", className)} {...props}>
      {children}
    </div>
  );
};

export default Container;