import React from 'react';
import { Helmet } from 'react-helmet';
import MainLayout from '@/components/layout/MainLayout.jsx';
import ContactFormSection from '@/components/sections/ContactFormSection.jsx';

const ContactPage = () => {
  return (
    <MainLayout>
      <Helmet>
        <title>Contact Us | Localayer AI</title>
      </Helmet>
      <div className="pt-20">
        <ContactFormSection />
      </div>
    </MainLayout>
  );
};

export default ContactPage;