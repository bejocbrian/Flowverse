import React from 'react';
import { cn } from '@/utils/classNameUtils.js';

const Section = ({ children, background = 'default', className, id, ...props }) => {
  const backgrounds = {
    default: 'bg-background',
    warmWhite: 'bg-[hsl(var(--color-warm-white))] text-foreground',
    lightGray: 'bg-[hsl(var(--color-light-gray))] text-foreground',
    primary: 'bg-primary text-primary-foreground'
  };

  return (
    <section id={id} className={cn("section-spacing", backgrounds[background], className)} {...props}>
      {children}
    </section>
  );
};

export default Section;