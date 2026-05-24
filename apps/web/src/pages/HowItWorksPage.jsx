import React from 'react';
import { Helmet } from 'react-helmet';
import MainLayout from '@/components/layout/MainLayout.jsx';
import HowItWorksSection from '@/components/sections/HowItWorksSection.jsx';
import CTASection from '@/components/sections/CTASection.jsx';

const HowItWorksPage = () => {
  return (
    <MainLayout>
      <Helmet>
        <title>How It Works | Localayer AI</title>
      </Helmet>
      <div className="pt-20">
        <HowItWorksSection full={true} />
        <CTASection />
      </div>
    </MainLayout>
  );
};

export default HowItWorksPage;