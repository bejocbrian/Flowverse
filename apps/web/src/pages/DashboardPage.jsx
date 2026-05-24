import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Dashboard - Aether Video</title>
      </Helmet>

      <div className="w-full max-w-container-max mx-auto px-margin-desktop py-8 space-y-12 pb-24">
        {/* Cinematic Hero Banner */}
        <section className="relative w-full aspect-[21/9] rounded-xl overflow-hidden glass-surface group">
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent z-10"></div>
          <img
            alt="Nano Banana 2 Hero"
            className="absolute inset-0 w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDljU0USG-mJ22Z4BJm_RwS1aNOzE5Vs0o_qqYmtle6Qdh6JFYmQWFr-I0K5w7p7Xj25ekCptKL5Nf45_Wh7NF8MBBJqyQUI1B82VH1L58OqXcT-yM-Ws0CzgkXJ5R57z3Qo__60JlClPFi3laC5wLEmJ9c-kqwyD7iq6M1FYtqakD9ZfBVl5vtzv0TMkfhgjRLm1SZi4Pb6ysQKTjQvslQU0X9lWrpGoCBiRxDBroHKK4_wgN9atzuHQm4LWZ9bIV1LLWax_YUaA"
          />
          <div className="relative z-20 h-full flex flex-col justify-center px-12 space-y-4 max-w-2xl">
            <span className="font-metadata text-metadata uppercase tracking-widest text-primary">Announcement</span>
            <h1 className="font-headline-lg text-headline-lg text-white">Nano Banana 2 is here.</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">The next generation of temporal consistency and fluid motion is now available for all creative workspaces.</p>
            <div className="pt-4">
              <button className="bg-primary text-on-primary px-8 py-3 rounded-lg font-bold font-body-lg hover:brightness-110 transition-all active:scale-[0.98]">
                Try Nano Banana 2
              </button>
            </div>
          </div>
        </section>

        {/* Project Grid Section */}
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Recent Projects</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Pick up where you left off</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
            {/* New Project Card */}
            <button 
              onClick={() => navigate('/app/generate')}
              className="glass-surface rounded-xl flex flex-col items-center justify-center gap-4 group hover:bg-white/5 transition-all duration-300 min-h-[280px] border-dashed border-2 border-outline-variant/30"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>add</span>
              </div>
              <span className="font-headline-md text-headline-md text-primary">New Project</span>
            </button>

            {/* Static Project Card 1 */}
            <div className="glass-surface rounded-xl overflow-hidden flex flex-col group cursor-pointer active:scale-[0.99] transition-all">
              <div className="aspect-video relative overflow-hidden bg-surface-container">
                <img
                  alt="Project Neon"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB23XvhgzsM8gw16twCQsbbrnj6KgrR_eBreQ3eIxk1Z1e2e63jbGs8chFt0LK1TZRxOdwtkdbofGjNbvUHtzDOGuf85mkp907lWude3c89Ml7JIqrgMckuesKhGOPhgMsYFzyMvB4wtH58i22bcD71RWoJ99tK5B-11yNPHwzoR_QTY7FxjIwie_rXuagmh6YotHoBBcjin0ZGJWXkHP0pC-y-GFtCHMmZ13Oh5Gi3fLoWgTvbhkOXfcK7em6hsPRBrwgiNx4NPg"
                />
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-metadata text-white">00:15</div>
              </div>
              <div className="p-4 space-y-1">
                <h3 className="font-body-lg text-body-lg font-semibold text-on-surface">Neon Genesis Drift</h3>
                <p className="font-metadata text-metadata text-on-surface-variant">Edited 2h ago • 4K HDR</p>
              </div>
            </div>

            {/* Static Project Card 2 */}
            <div className="glass-surface rounded-xl overflow-hidden flex flex-col group cursor-pointer active:scale-[0.99] transition-all">
              <div className="aspect-video relative overflow-hidden bg-surface-container">
                <img
                  alt="Orbit Station"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBfQdpo5AK3yLEoP-kzw2EF4nwI6wZP4bnItEjEK43X5itsrQOEWxqrZPnHNcT_EVW7K7ssd-WAjuh6A7xO2jjgREK8AG7jCMVsqKD_paql9BYSyxDFs7dwZTTDX1RgdC2C6uArAKW1KAX4QMdLqM0AgUZmUaojdfziq63QqUhVxSGOue6Y51xtK8CzxIb8a05agJNZuWRlP_gn9nZOuCjpRCsZIJwjJJTO89k3q5Se_2BoCl6N7EU3MGmkIcgW1pMbbkk2GfIZLg"
                />
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-metadata text-white">00:42</div>
              </div>
              <div className="p-4 space-y-1">
                <h3 className="font-body-lg text-body-lg font-semibold text-on-surface">Orbital Descent</h3>
                <p className="font-metadata text-metadata text-on-surface-variant">Edited 5h ago • 1080p</p>
              </div>
            </div>

            {/* Static Project Card 3 */}
            <div className="glass-surface rounded-xl overflow-hidden flex flex-col group cursor-pointer active:scale-[0.99] transition-all">
              <div className="aspect-video relative overflow-hidden bg-surface-container">
                <img
                  alt="Desert Sands"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC8Vl9QnW3q17E9FYlWgIH05UyKCHIrZXD7aCF7loZUoj0kIQ2SFkT8LeU1iYS3UQTuHKoGol1-mJdnn2cpT3SZHIieIaZU2cuIJ8lcNvm8ULj4vezRTDJt156cfXcCWMZL-y5wcoqPlN1gRk75NsNWOjGHBcZoHKnODH3IQNFZMjLNRPAnzo4zQ46XfAI1TxUbTtrqCNXwIi5e_R8THVYwlDmS11jye5c9biZeiJTiL3pa-AiopgcnQbv_u9h6WR5rvOeUSI98Vw"
                />
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-metadata text-white">00:08</div>
              </div>
              <div className="p-4 space-y-1">
                <h3 className="font-body-lg text-body-lg font-semibold text-on-surface">Golden Sands Macro</h3>
                <p className="font-metadata text-metadata text-on-surface-variant">Edited yesterday • 4K</p>
              </div>
            </div>
          </div>
        </section>

        {/* Secondary Features Bento */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <div className="md:col-span-2 glass-surface rounded-xl p-8 flex flex-col justify-between min-h-[320px]">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Refine your prompt.</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">Our new prompt assistant helps you describe lighting, camera movement, and textures for the perfect shot.</p>
            </div>
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-white/5 rounded-lg border border-outline-variant/30 font-metadata text-metadata">Cinematic lighting</div>
              <div className="px-4 py-2 bg-white/5 rounded-lg border border-outline-variant/30 font-metadata text-metadata">4K Texture</div>
              <div className="px-4 py-2 bg-white/5 rounded-lg border border-outline-variant/30 font-metadata text-metadata">Handheld movement</div>
            </div>
          </div>
          <div className="glass-surface rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>auto_awesome</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface">Auto-Upscale</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">Turn 720p generations into cinematic 4K with AI enhancement.</p>
            <button className="font-metadata text-metadata text-primary hover:underline">Learn more</button>
          </div>
        </section>
      </div>

      {/* Footer Component */}
      <footer className="bg-surface-container-lowest dark:bg-surface-container-lowest border-t border-outline-variant/10 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center py-8 px-margin-desktop w-full max-w-container-max mx-auto gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-headline-md text-headline-md font-bold text-on-surface dark:text-on-surface">Aether Video</span>
            <p className="font-metadata text-metadata text-on-surface-variant/70">© 2024 Aether Video AI. Precision Cinematic Generation.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <a className="text-on-surface-variant/70 hover:text-on-surface font-body-md text-body-md transition-colors hover:text-primary" href="#">Documentation</a>
            <a className="text-on-surface-variant/70 hover:text-on-surface font-body-md text-body-md transition-colors hover:text-primary" href="#">Terms of Service</a>
            <a className="text-on-surface-variant/70 hover:text-on-surface font-body-md text-body-md transition-colors hover:text-primary" href="#">Privacy Policy</a>
            <a className="text-on-surface-variant/70 hover:text-on-surface font-body-md text-body-md transition-colors hover:text-primary" href="#">Status</a>
          </div>
        </div>
      </footer>
    </>
  );
};

export default DashboardPage;
