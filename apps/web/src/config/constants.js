import { ROUTES } from './routes.js';

export const navigationItems = [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Services', href: ROUTES.SERVICES },
  { label: 'How It Works', href: ROUTES.HOW_IT_WORKS },
  { label: 'Demos', href: ROUTES.DEMOS },
  { label: 'Pricing', href: ROUTES.PRICING },
  { label: 'Contact', href: ROUTES.CONTACT }
];

export const servicesData = [
  {
    icon: 'Code',
    title: 'Web Development',
    description: 'We build fast, conversion-focused websites tailored to your specific business goals.'
  },
  {
    icon: 'Zap',
    title: 'Automation & Workflows',
    description: 'Stop doing manual data entry. We connect your tools to work together seamlessly.'
  },
  {
    icon: 'Settings',
    title: 'Tool Setup',
    description: 'CRMs, booking platforms, and marketing tools configured correctly from day one.'
  }
];

export const pricingTiers = [
  {
    tier: 'Starter',
    price: '$499',
    description: 'Perfect for getting your local business online fast.',
    features: ['5-page website', 'Mobile responsive', 'Basic contact form', 'Fast 2-week delivery'],
    isPopular: false
  },
  {
    tier: 'Growth',
    price: '$999',
    description: 'For businesses ready to streamline operations.',
    features: ['Everything in Starter', 'Custom automation', 'Tool/platform setup', 'Priority support'],
    isPopular: true
  },
  {
    tier: 'Pro',
    price: 'Custom',
    description: 'Complete digital transformation and scaling.',
    features: ['Full web app', 'Multiple automations', 'Full CRM setup', 'Dedicated support'],
    isPopular: false
  }
];

export const demoProjects = [
  {
    id: 'review-boost',
    title: 'ReviewBoost: Turn Happy Customers into Google Reviews',
    description: 'Automated system that helps local businesses collect and manage Google reviews from satisfied customers. Increase your online reputation and attract more customers.',
    ctaText: 'View Demo',
    ctaLink: 'https://slategray-chimpanzee-483236.hostingersite.com/',
    icon: 'Star',
    gradient: 'bg-gradient-to-br from-yellow-500/10 to-orange-500/5'
  },
  {
    id: 'web-builder',
    title: 'Modern Website Builder',
    description: 'See how we build fast, conversion-focused websites that drive results for local businesses.',
    ctaText: 'View Demo',
    icon: 'Globe',
    gradient: 'bg-gradient-to-br from-blue-500/10 to-cyan-500/5'
  },
  {
    id: 'workflow-auto',
    title: 'Workflow Automation System',
    description: 'Watch how we automate repetitive tasks — from lead capture to follow-ups — saving you hours every week.',
    ctaText: 'View Demo',
    icon: 'Zap',
    gradient: 'bg-gradient-to-br from-primary/10 to-emerald-500/5'
  },
  {
    id: 'crm-setup',
    title: 'CRM & Platform Configuration',
    description: 'Fully configured CRM, email marketing, and booking systems — ready to use from day one.',
    ctaText: 'View Demo',
    icon: 'Settings',
    gradient: 'bg-gradient-to-br from-purple-500/10 to-pink-500/5'
  }
];