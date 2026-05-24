import React from 'react';
import { cn } from '@/utils/classNameUtils.js';

const Card = ({ children, className, variant = 'default', ...props }) => {
  const variants = {
    default: 'bg-card text-card-foreground rounded-2xl shadow-sm border border-border',
    elevated: 'bg-card text-card-foreground rounded-2xl shadow-lg border-0',
    bordered: 'bg-transparent text-foreground rounded-2xl border-2 border-border'
  };

  return (
    <div className={cn("overflow-hidden transition-all duration-300", variants[variant], className)} {...props}>
      {children}
    </div>
  );
};

export default Card;