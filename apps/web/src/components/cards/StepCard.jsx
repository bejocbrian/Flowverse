import React from 'react';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';

const StepCard = ({ number, title, description, className }) => {
  return (
    <div className={`relative flex flex-col sm:flex-row gap-6 sm:gap-10 ${className}`}>
      <div className="relative z-10 shrink-0">
        <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg shadow-primary/20 rotate-3">
          {number}
        </div>
      </div>
      <div className="flex-1 bg-card rounded-2xl p-8 shadow-sm border border-border">
        <Heading level="h3" className="mb-3">{title}</Heading>
        <Text>{description}</Text>
      </div>
    </div>
  );
};

export default StepCard;