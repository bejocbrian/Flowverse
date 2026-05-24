import React from 'react';
import Section from '@/components/common/Section.jsx';
import Container from '@/components/common/Container.jsx';
import StatBlock from '@/components/cards/StatBlock.jsx';

const TrustSection = () => {
  return (
    <Section background="warmWhite" className="border-t border-border">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-border">
          <StatBlock number="7+" label="Years in Business" />
          <StatBlock number="3" label="Core Service Areas" />
          <StatBlock number="100%" label="Done-For-You Delivery" />
        </div>
      </Container>
    </Section>
  );
};

export default TrustSection;