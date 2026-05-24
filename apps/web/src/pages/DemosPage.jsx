import React from 'react';
import { Helmet } from 'react-helmet';
import MainLayout from '@/components/layout/MainLayout.jsx';
import DemosSection from '@/components/sections/DemosSection.jsx';
import CTASection from '@/components/sections/CTASection.jsx';

const DemosPage = () => {
  return (
    <MainLayout>
      <Helmet>
        <title>Demos | Localayer AI</title>
        <meta name="description" content="Explore interactive demos of our web development, automation, and CRM solutions for local businesses." />
      </Helmet>
      <div className="pt-20">
        <DemosSection />
        <CTASection />
      </div>
    </MainLayout>
  );
};

export default DemosPage;