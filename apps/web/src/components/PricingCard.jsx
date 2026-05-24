import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const PricingCard = ({ tier, price, description, features, ctaText, isPrimary, index = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`relative rounded-2xl p-8 transition-all duration-300 flex flex-col h-full ${
        isPrimary 
          ? 'bg-primary/5 border-2 border-primary shadow-md scale-105 z-10' 
          : 'bg-card border border-border shadow-sm hover:shadow-md'
      }`}
    >
      {isPrimary && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs uppercase tracking-wider font-semibold">
          Most Popular
        </Badge>
      )}
      
      <div className="mb-6">
        <h3 className="text-2xl font-semibold mb-2 text-foreground">{tier}</h3>
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-4xl font-bold text-foreground">{price}</span>
          {price !== 'Custom' && <span className="text-muted-foreground text-sm font-medium">/one-time</span>}
        </div>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>

      <ul className="space-y-4 mb-8 flex-grow">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-foreground text-sm leading-tight">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={isPrimary ? 'default' : 'outline'}
        className={`w-full mt-auto ${isPrimary ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'border-foreground text-foreground hover:bg-foreground hover:text-background'}`}
        onClick={() => {
          const contactSection = document.getElementById('contact');
          if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      >
        {ctaText}
      </Button>
    </motion.div>
  );
};

export default PricingCard;