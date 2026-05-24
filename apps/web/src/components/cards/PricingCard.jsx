import React from 'react';
import { Check } from 'lucide-react';
import Card from '@/components/common/Card.jsx';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';
import Button from '@/components/common/Button.jsx';
import Badge from '@/components/common/Badge.jsx';
import { cn } from '@/utils/classNameUtils.js';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes.js';

const PricingCard = ({ tier, price, description, features, isPopular, cta, className }) => {
  return (
    <Card 
      variant={isPopular ? 'elevated' : 'default'}
      className={cn(
        "p-8 flex flex-col h-full relative",
        isPopular && "border-2 border-primary bg-[hsl(var(--color-warm-white))] scale-105 z-10",
        className
      )}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge variant="primary" className="bg-primary text-primary-foreground">Most Popular</Badge>
        </div>
      )}
      
      <Heading level="h3" className="mb-2">{tier}</Heading>
      <div className="text-4xl font-extrabold mb-4 text-foreground">{price}</div>
      <Text className="mb-8 min-h-[3rem]">{description}</Text>
      
      <div className="space-y-4 mb-8 flex-grow">
        {features.map((feature, i) => (
          <div key={i} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm font-medium text-foreground/80">{feature}</span>
          </div>
        ))}
      </div>
      
      <div className="mt-auto">
        <Link to={ROUTES.CONTACT} className="w-full">
          <Button variant={isPopular ? 'primary' : 'secondary'} className="w-full">
            {cta || 'Get Started'}
          </Button>
        </Link>
      </div>
    </Card>
  );
};

export default PricingCard;