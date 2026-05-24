
import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button.jsx';
import { Zap, Users, Play, Film } from 'lucide-react';

const HomePage = () => {
  return (
    <>
      <Helmet>
        <title>Turn ideas into video in seconds - Aether Video</title>
        <meta name="description" content="The next generation of cinematic AI. Prompt, refine, and export high-fidelity motion visuals." />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--canvas))]">
        {/* Header */}
        <header className="border-b border-[hsl(var(--border))]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold tracking-tight">Aether Video</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Turn ideas into video in seconds
            </h1>
            <p className="text-xl text-[hsl(var(--text-secondary))] mb-8 max-w-2xl mx-auto leading-relaxed">
              Create cinematic AI-generated videos with our neural engine. Professional quality, instant results.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="text-lg px-8">
                  Get Started
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="glass-surface rounded-xl p-8">
                <div className="w-12 h-12 rounded-lg bg-[hsl(var(--accent-primary-container))] flex items-center justify-center mb-4">
                  <Film className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Neural Cinematic Engine</h3>
                <p className="text-[hsl(var(--text-secondary))]">
                  Advanced AI models trained on professional cinematography for stunning results
                </p>
              </div>

              <div className="glass-surface rounded-xl p-8">
                <div className="w-12 h-12 rounded-lg bg-[hsl(var(--accent-primary))]/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-[hsl(var(--accent-primary))]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Precision Timeline Control</h3>
                <p className="text-[hsl(var(--text-secondary))]">
                  Fine-tune every frame with our intuitive timeline editor and keyframe controls
                </p>
              </div>

              <div className="glass-surface rounded-xl p-8">
                <div className="w-12 h-12 rounded-lg bg-[hsl(var(--accent-primary))]/10 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-[hsl(var(--accent-primary))]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Distributed Compute</h3>
                <p className="text-[hsl(var(--text-secondary))]">
                  Lightning-fast rendering powered by our global GPU network
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Example Videos */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">See what's possible</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-surface rounded-xl overflow-hidden group cursor-pointer">
                  <div className="aspect-video bg-gradient-to-br from-[hsl(var(--accent-primary))]/20 to-[hsl(var(--accent-secondary))]/20 flex items-center justify-center relative">
                    <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Performance Metrics */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="glass-surface rounded-xl p-6">
                  <p className="text-3xl font-bold text-[hsl(var(--accent-primary))] mb-2">4.2ms</p>
                  <p className="text-sm text-[hsl(var(--text-secondary))]">Latency</p>
                </div>
              </div>
              <div className="text-center">
                <div className="glass-surface rounded-xl p-6">
                  <p className="text-3xl font-bold text-[hsl(var(--accent-primary))] mb-2">4444p</p>
                  <p className="text-sm text-[hsl(var(--text-secondary))]">Export</p>
                </div>
              </div>
              <div className="text-center">
                <div className="glass-surface rounded-xl p-6">
                  <p className="text-3xl font-bold text-[hsl(var(--accent-primary))] mb-2">Multi</p>
                  <p className="text-sm text-[hsl(var(--text-secondary))]">Model inputs</p>
                </div>
              </div>
              <div className="text-center">
                <div className="glass-surface rounded-xl p-6">
                  <p className="text-3xl font-bold text-[hsl(var(--accent-primary))] mb-2">Team</p>
                  <p className="text-sm text-[hsl(var(--text-secondary))]">Workspaces</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">Simple, transparent pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="glass-surface rounded-xl p-8">
                <h3 className="text-xl font-bold mb-2">Free</h3>
                <p className="text-4xl font-bold mb-6">$0<span className="text-lg text-[hsl(var(--text-secondary))]">/mo</span></p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>100 credits/month</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>Standard quality</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>5s max duration</span>
                  </li>
                </ul>
                <Link to="/signup">
                  <Button variant="outline" className="w-full">Get Started</Button>
                </Link>
              </div>

              <div className="glass-surface rounded-xl p-8 ring-2 ring-[hsl(var(--accent-primary))] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[hsl(var(--accent-primary))] text-xs font-medium text-white">
                  Most Popular
                </div>
                <h3 className="text-xl font-bold mb-2">Pro</h3>
                <p className="text-4xl font-bold mb-6">$29<span className="text-lg text-[hsl(var(--text-secondary))]">/mo</span></p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>1000 credits/month</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>High quality</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>10s max duration</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>Priority rendering</span>
                  </li>
                </ul>
                <Link to="/signup">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>

              <div className="glass-surface rounded-xl p-8">
                <h3 className="text-xl font-bold mb-2">Studio</h3>
                <p className="text-4xl font-bold mb-6">$99<span className="text-lg text-[hsl(var(--text-secondary))]">/mo</span></p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>5000 credits/month</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>Ultra quality</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>Unlimited duration</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>Team workspaces</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--accent-secondary))]">✓</span>
                    <span>API access</span>
                  </li>
                </ul>
                <Link to="/signup">
                  <Button variant="outline" className="w-full">Get Started</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[hsl(var(--border))] py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight">Aether Video</span>
              </div>
              
              <div className="flex items-center gap-6 text-sm text-[hsl(var(--text-secondary))]">
                <Link to="/features" className="hover:text-[hsl(var(--text-primary))] transition-colors">Features</Link>
                <Link to="/pricing" className="hover:text-[hsl(var(--text-primary))] transition-colors">Pricing</Link>
                <Link to="/careers" className="hover:text-[hsl(var(--text-primary))] transition-colors">Careers</Link>
                <Link to="/about" className="hover:text-[hsl(var(--text-primary))] transition-colors">About</Link>
                <Link to="/privacy" className="hover:text-[hsl(var(--text-primary))] transition-colors">Privacy</Link>
                <Link to="/terms" className="hover:text-[hsl(var(--text-primary))] transition-colors">Terms</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default HomePage;
