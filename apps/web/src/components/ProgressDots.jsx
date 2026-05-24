
import React from 'react';

const ProgressDots = ({ total, current }) => {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className={`h-2 rounded-full transition-all duration-300 ${
            index === current
              ? 'w-8 bg-[hsl(var(--accent-primary))]'
              : index < current
              ? 'w-2 bg-[hsl(var(--accent-primary))] opacity-50'
              : 'w-2 bg-[hsl(var(--border))]'
          }`}
        />
      ))}
    </div>
  );
};

export default ProgressDots;
