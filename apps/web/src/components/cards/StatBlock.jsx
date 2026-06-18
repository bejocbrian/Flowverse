import React from 'react';
import { cn } from '@/lib/utils.js';

const StatBlock = ({ number, label, className }) => {
  return (
    <div className={cn("text-center p-6", className)}>
      <div className="text-5xl font-extrabold text-primary mb-2 tracking-tighter">
        {number}
      </div>
      <div className="text-lg font-medium text-foreground">
        {label}
      </div>
    </div>
  );
};

export default StatBlock;