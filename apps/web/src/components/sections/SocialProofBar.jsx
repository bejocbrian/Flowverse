import React from 'react';
import Container from '@/components/common/Container.jsx';

const SocialProofBar = () => {
  return (
    <div className="bg-[hsl(var(--color-light-gray))] py-8 border-y border-border">
      <Container>
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4 text-sm md:text-base font-semibold text-foreground/70 uppercase tracking-wider">
          <span>7+ Years in Business</span>
          <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-primary" />
          <span>Local Specialists</span>
          <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-primary" />
          <span>Web</span>
          <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-primary" />
          <span>Automation</span>
        </div>
      </Container>
    </div>
  );
};

export default SocialProofBar;