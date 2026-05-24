import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Container from '@/components/common/Container.jsx';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';
import Button from '@/components/common/Button.jsx';
import Badge from '@/components/common/Badge.jsx';
import { ROUTES } from '@/config/routes.js';

const HeroSection = () => {
  return (
    <section className="relative min-h-[90dvh] flex items-center pt-20 overflow-hidden bg-[hsl(var(--color-warm-white))]">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1524221629551-6dd14def5ffd" 
          alt="Local business desk" 
          className="w-full h-full object-cover opacity-[0.05]"
        />
      </div>
      
      <Container className="relative z-10 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl"
        >
          <Badge className="mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2 inline-block" />
            Enterprise Tech for Local Business
          </Badge>
          
          <Heading level="h1" className="mb-6 text-foreground">
            Local Business.<br />Enterprise-Level Tech.
          </Heading>
          
          <Text variant="body" className="text-xl md:text-2xl mb-10 max-w-2xl text-foreground/80">
            We design, build, and automate the systems that help your business grow — without the corporate price tag.
          </Text>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to={ROUTES.SERVICES}>
              <Button size="lg" className="w-full sm:w-auto">
                See Our Services <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to={ROUTES.PRICING}>
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                View Pricing
              </Button>
            </Link>
          </div>
        </motion.div>
      </Container>
    </section>
  );
};

export default HeroSection;