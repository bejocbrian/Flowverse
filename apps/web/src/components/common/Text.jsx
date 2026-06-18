import React from 'react';
import { cn } from '@/lib/utils.js';

const Text = ({ variant = 'body', children, className, color }) => {
  const styles = {
    body: 'text-base leading-relaxed',
    small: 'text-sm leading-normal',
    caption: 'text-xs tracking-wide uppercase font-semibold'
  };

  return (
    <p className={cn(styles[variant], color || "text-muted-foreground", className)}>
      {children}
    </p>
  );
};

export default Text;