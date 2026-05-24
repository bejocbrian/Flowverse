import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout.jsx';
import Section from '@/components/common/Section.jsx';
import Container from '@/components/common/Container.jsx';
import Heading from '@/components/common/Heading.jsx';
import Button from '@/components/common/Button.jsx';
import { ROUTES } from '@/config/routes.js';

const NotFoundPage = () => {
  return (
    <MainLayout>
      <Helmet>
        <title>404 Not Found | Localayer AI</title>
      </Helmet>
      <Section className="min-h-[70vh] flex items-center pt-20">
        <Container className="text-center">
          <Heading level="h1" className="mb-4">404</Heading>
          <Heading level="h3" className="mb-8 text-muted-foreground">Page Not Found</Heading>
          <Link to={ROUTES.HOME}>
            <Button size="lg">Back to Home</Button>
          </Link>
        </Container>
      </Section>
    </MainLayout>
  );
};

export default NotFoundPage;