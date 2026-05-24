import React from 'react';
import { Link } from 'react-router-dom';
import Section from '@/components/common/Section.jsx';
import Container from '@/components/common/Container.jsx';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';
import Button from '@/components/common/Button.jsx';
import { ROUTES } from '@/config/routes.js';

const CTASection = () => {
  return (
    <Section background="primary" className="text-center">
      <Container className="max-w-3xl">
        <Heading level="h2" className="mb-6 text-primary-foreground">Ready to grow your business?</Heading>
        <Text className="text-xl mb-10 text-primary-foreground/90">
          Stop losing time to manual tasks and poor systems. Let's build something better.
        </Text>
        <Link to={ROUTES.CONTACT}>
          <Button size="lg" className="bg-background text-foreground hover:bg-background/90 font-bold">
            Get a Free Consultation
          </Button>
        </Link>
      </Container>
    </Section>
  );
};

export default CTASection;