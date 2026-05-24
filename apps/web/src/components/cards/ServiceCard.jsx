import React from 'react';
import { Code, Zap, Settings } from 'lucide-react';
import Card from '@/components/common/Card.jsx';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';

const IconMap = {
  Code, Zap, Settings
};

const ServiceCard = ({ icon, title, description, className }) => {
  const IconComponent = IconMap[icon] || Settings;
  
  return (
    <Card className={`p-8 border-t-4 border-t-primary hover:shadow-lg hover:-translate-y-1 ${className}`}>
      <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
        <IconComponent className="w-7 h-7 text-primary" />
      </div>
      <Heading level="h3" className="mb-4">{title}</Heading>
      <Text>{description}</Text>
    </Card>
  );
};

export default ServiceCard;