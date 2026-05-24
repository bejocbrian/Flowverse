import React from 'react';
import { motion } from 'framer-motion';
import Section from '@/components/common/Section.jsx';
import Container from '@/components/common/Container.jsx';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';
import PricingCard from '@/components/cards/PricingCard.jsx';
import { pricingTiers } from '@/config/constants.js';

const PricingSection = () => {
  return (
    <Section background="lightGray" id="pricing">
      <Container>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Heading level="h2" className="mb-4">Simple, Transparent Pricing</Heading>
          <Text className="text-lg">No hidden fees. No surprises.</Text>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
          {pricingTiers.map((tier, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <PricingCard {...tier} />
            </motion.div>
          ))}
        </div>
      </Container>
    </Section>
  );
};

export default PricingSection;