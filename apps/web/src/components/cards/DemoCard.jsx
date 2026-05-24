import React, { useRef, useEffect } from 'react';
import { Star, Globe, Zap, Settings, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { cn } from '@/utils/classNameUtils.js';
import Card from '@/components/common/Card.jsx';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';

const IconMap = {
  Star,
  Globe,
  Zap,
  Settings
};

const DemoCard = ({ title, description, icon, ctaText, ctaLink, gradient, className }) => {
  const cardRef = useRef(null);
  const IconComponent = IconMap[icon] || Settings;
  
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const ctx = gsap.context(() => {
      // Hover timeline
      const hoverTl = gsap.timeline({ paused: true })
        .to(card, {
          scale: 1.03,
          boxShadow: 'var(--card-shadow-hover)',
          backgroundColor: 'hsl(var(--secondary))', // Subtle color shift
          duration: 0.3,
          ease: 'power2.out'
        });

      const onEnter = () => hoverTl.play();
      const onLeave = () => hoverTl.reverse();

      card.addEventListener('mouseenter', onEnter);
      card.addEventListener('mouseleave', onLeave);

      return () => {
        card.removeEventListener('mouseenter', onEnter);
        card.removeEventListener('mouseleave', onLeave);
      };
    });

    return () => ctx.revert();
  }, []);

  const isExternal = ctaLink?.startsWith('http');
  const LinkComponent = ctaLink ? 'a' : 'button';
  const linkProps = ctaLink ? {
    href: ctaLink,
    ...(isExternal && { target: "_blank", rel: "noopener noreferrer" })
  } : {};

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "flex flex-col h-full overflow-hidden border border-border will-change-transform",
        "bg-card transition-colors duration-300", 
        className
      )}
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      {/* Visual Header / Gradient Background */}
      <div className={cn("h-32 w-full relative flex items-center justify-center border-b border-border/50", gradient || "bg-muted")}>
        <div className="absolute inset-0" style={{ background: 'var(--gradient-overlay)' }} />
        <div className="w-16 h-16 bg-background rounded-2xl shadow-sm flex items-center justify-center relative z-10">
          <IconComponent className="w-8 h-8 text-primary" />
        </div>
      </div>
      
      {/* Content Body */}
      <div className="p-6 flex flex-col flex-grow">
        <Heading level="h3" className="mb-3 text-xl">{title}</Heading>
        <Text className="mb-6 flex-grow">{description}</Text>
        
        {/* CTA Area */}
        <LinkComponent 
          {...linkProps}
          className={cn(
            "mt-auto inline-flex items-center justify-center gap-2 w-full",
            "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
            "py-3 px-4 rounded-xl font-semibold transition-colors duration-200"
          )}
          onClick={(e) => {
            if (!ctaLink) {
              e.preventDefault();
              // Interactive demo placeholder if no link is provided
              alert("Interactive demo coming soon!");
            }
          }}
        >
          {ctaText || 'View Demo'}
          <ArrowRight className="w-4 h-4" />
        </LinkComponent>
      </div>
    </Card>
  );
};

export default DemoCard;