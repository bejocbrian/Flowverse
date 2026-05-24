import React from 'react';
import { Helmet } from 'react-helmet';
import MainLayout from '@/components/layout/MainLayout.jsx';
import PricingSection from '@/components/sections/PricingSection.jsx';
import CTASection from '@/components/sections/CTASection.jsx';

const PricingPage = () => {
  return (
    <MainLayout>
      <Helmet>
        <title>Pricing | Localayer AI</title>
      </Helmet>
      <div className="pt-20">
        <PricingSection />
        <CTASection />
      </div>
    </MainLayout>
  );
};

export default PricingPage;