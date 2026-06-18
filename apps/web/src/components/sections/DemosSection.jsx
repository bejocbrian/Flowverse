import React, { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import Section from '@/components/common/Section.jsx';
import Container from '@/components/common/Container.jsx';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';
import DemoCard from '@/components/cards/DemoCard.jsx';
import { demoProjects } from '@/config/constants.js';

const DemosSection = () => {
  const sectionRef = useRef(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const headerInView = useInView(sectionRef, { once: true, margin: '-20% 0px' });
  const gridInView = useInView(sectionRef, { once: true, margin: '-15% 0px' });

  return (
    <Section
      id="demos"
      background="warmWhite"
      className="relative overflow-hidden"
      ref={sectionRef}
    >
      {/* Parallax Background Element */}
      <motion.div
        className="demo-parallax-bg absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent"
        style={{ y: prefersReducedMotion ? 0 : 15 }}
        transition={{ ease: "linear", duration: 0.1 }}
        animate={{ y: prefersReducedMotion ? 0 : 15 }}
      />

      <Container className="relative z-10">
        <motion.div
          className="demo-header text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={headerInView || prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Heading level="h2" className="mb-4">See It In Action</Heading>
          <Text className="text-lg">
            Interactive demos of the custom solutions and systems we build for our clients.
          </Text>
        </motion.div>

        {/* Responsive Grid: 1 col mobile, 2 cols tablet, 4 cols desktop */}
        <motion.div
          className="demo-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
          initial="hidden"
          animate={gridInView || prefersReducedMotion ? "visible" : "hidden"}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.2 } }
          }}
        >
          {demoProjects.map((demo) => (
            <motion.div
              key={demo.id}
              className="demo-card-wrapper h-full"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <DemoCard {...demo} />
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </Section>
  );
};

export default DemosSection;