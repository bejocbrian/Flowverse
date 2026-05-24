import React from 'react';
import { Helmet } from 'react-helmet';
import MainLayout from '@/components/layout/MainLayout.jsx';
import ServicesSection from '@/components/sections/ServicesSection.jsx';
import CTASection from '@/components/sections/CTASection.jsx';

const ServicesPage = () => {
  return (
    <MainLayout>
      <Helmet>
        <title>Our Services | Localayer AI</title>
      </Helmet>
      <div className="pt-20">
        <ServicesSection />
        <CTASection />
      </div>
    </MainLayout>
  );
};

export default ServicesPage;