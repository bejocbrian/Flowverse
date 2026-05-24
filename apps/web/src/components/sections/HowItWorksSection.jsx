import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Section from '@/components/common/Section.jsx';
import Container from '@/components/common/Container.jsx';
import Heading from '@/components/common/Heading.jsx';
import Button from '@/components/common/Button.jsx';
import StepCard from '@/components/cards/StepCard.jsx';
import { ROUTES } from '@/config/routes.js';

const HowItWorksSection = ({ full = false }) => {
  const steps = [
    { num: '1', title: 'Discovery Call', desc: 'We learn about your business and identify what tech can solve for you.' },
    { num: '2', title: 'Build & Configure', desc: 'We get to work building your system, keeping you updated throughout.' },
    { num: '3', title: 'Launch & Support', desc: 'We go live, train your team, and stay available for support.' },
  ];

  const displaySteps = full ? steps : steps.slice(0, 2);

  return (
    <Section background="lightGray" id="process">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <Heading level="h2" className="mb-6">Simple, Transparent Process</Heading>
            <p className="text-lg text-foreground/70 mb-10 leading-relaxed">
              We don't overcomplicate things. From our first call to launch day, you'll know exactly what's happening and when.
            </p>
            {!full && (
              <Link to={ROUTES.HOW_IT_WORKS}>
                <Button>See Full Process</Button>
              </Link>
            )}
          </div>
          
          <div className="relative space-y-12">
            <div className="absolute left-8 top-10 bottom-10 w-0.5 bg-border hidden sm:block" />
            {displaySteps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <StepCard number={step.num} title={step.title} description={step.desc} />
              </motion.div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
};

export default HowItWorksSection;