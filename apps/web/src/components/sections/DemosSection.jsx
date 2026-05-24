import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Section from '@/components/common/Section.jsx';
import Container from '@/components/common/Container.jsx';
import Heading from '@/components/common/Heading.jsx';
import Text from '@/components/common/Text.jsx';
import DemoCard from '@/components/cards/DemoCard.jsx';
import { demoProjects } from '@/config/constants.js';

gsap.registerPlugin(ScrollTrigger);

const DemosSection = () => {
  const sectionRef = useRef(null);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        // Subtle Parallax on the background wrapper
        gsap.to(".demo-parallax-bg", {
          y: 15,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true
          }
        });

        // Header Entrance Animation
        gsap.fromTo(".demo-header",
          { opacity: 0, y: 30 },
          { 
            opacity: 1, 
            y: 0, 
            duration: 0.8, 
            ease: "power3.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%"
            }
          }
        );

        // Staggered Card Reveals
        gsap.fromTo(".demo-card-wrapper",
          { opacity: 0, y: 50 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.12,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ".demo-grid",
              start: "top 85%"
            }
          }
        );
      }, sectionRef);

      return () => ctx.revert();
    });

    // Fallback for prefers-reduced-motion: ensure elements are visible
    mm.add("(prefers-reduced-motion: reduce)", () => {
       gsap.set([".demo-header", ".demo-card-wrapper"], { opacity: 1, y: 0 });
    });

    return () => mm.revert();
  }, []);

  return (
    <Section 
      id="demos" 
      background="warmWhite" 
      className="relative overflow-hidden" 
      ref={sectionRef}
    >
      {/* Parallax Background Element */}
      <div className="demo-parallax-bg absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent will-change-transform" />

      <Container className="relative z-10">
        <div className="demo-header text-center max-w-3xl mx-auto mb-16 will-change-transform-opacity">
          <Heading level="h2" className="mb-4">See It In Action</Heading>
          <Text className="text-lg">
            Interactive demos of the custom solutions and systems we build for our clients.
          </Text>
        </div>
        
        {/* Responsive Grid: 1 col mobile, 2 cols tablet, 4 cols desktop */}
        <div className="demo-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {demoProjects.map((demo) => (
            <div key={demo.id} className="demo-card-wrapper will-change-transform-opacity h-full">
              <DemoCard {...demo} />
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
};

export default DemosSection;