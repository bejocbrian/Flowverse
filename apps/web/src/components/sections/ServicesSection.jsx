import React from 'react';
import { motion } from 'framer-motion';
import Section from '@/components/common/Section.jsx';
import Container from '@/components/common/Container.jsx';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';
import ServiceCard from '@/components/cards/ServiceCard.jsx';
import { servicesData } from '@/config/constants.js';

const ServicesSection = () => {
  return (
    <Section background="warmWhite" id="services">
      <Container>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Heading level="h2" className="mb-4">What We Do</Heading>
          <Text className="text-lg">Three core services designed to streamline your operations and bring in more customers.</Text>
        </div>
        
        {/* Using a varied Bento-style grid to avoid the 3-tower AI fingerprint */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {servicesData.map((service, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={idx === 0 ? "md:col-span-2 lg:col-span-1" : ""}
            >
              <ServiceCard {...service} className="h-full" />
            </motion.div>
          ))}
        </div>
      </Container>
    </Section>
  );
};

export default ServicesSection;