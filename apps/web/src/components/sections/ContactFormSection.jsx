import React from 'react';
import { Mail, MapPin } from 'lucide-react';
import Section from '@/components/common/Section.jsx';
import Container from '@/components/common/Container.jsx';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';
import ContactForm from '@/components/forms/ContactForm.jsx';

const ContactFormSection = () => {
  return (
    <Section background="warmWhite">
      <Container>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Heading level="h1" className="mb-6">Get In Touch</Heading>
          <Text className="text-xl">Let's talk about how we can help your business grow.</Text>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-6xl mx-auto">
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-secondary rounded-3xl p-8 border border-border">
              <Heading level="h3" className="mb-8">Contact Info</Heading>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-1">Email</p>
                    <p className="text-lg font-medium">hello@localayer.ai</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-1">Location</p>
                    <p className="text-lg font-medium">Remote-first. Serving businesses nationwide.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-card rounded-3xl p-8 md:p-12 border border-border shadow-lg">
            <ContactForm />
          </div>
        </div>
      </Container>
    </Section>
  );
};

export default ContactFormSection;