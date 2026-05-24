import React from 'react';
import { cn } from '@/utils/classNameUtils.js';

const Heading = ({ level = 'h2', children, className, color }) => {
  const Tag = level;
  
  const styles = {
    h1: 'text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight',
    h2: 'text-3xl md:text-4xl font-bold leading-snug',
    h3: 'text-2xl md:text-3xl font-semibold',
    h4: 'text-xl font-medium'
  };

  return (
    <Tag className={cn("font-heading text-balance", styles[level], color, className)}>
      {children}
    </Tag>
  );
};

export default Heading;