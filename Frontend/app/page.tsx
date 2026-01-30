'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Zap, GitBranch, TrendingUp, Check, ArrowRight } from 'lucide-react';

export default function Home() {
  const [metricsUrl, setMetricsUrl] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [enableCorrelation, setEnableCorrelation] = useState(true);
  const [allowPR, setAllowPR] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleConnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      console.log('Connected:', { metricsUrl, githubRepo, enableCorrelation, allowPR });
      setIsConnecting(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
      {/* Animated Background Gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-15 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #d4af37 0%, transparent 70%)',
            transform: `translateY(${scrollY * 0.5}px)`,
          }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-15 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #f4d03f 0%, transparent 70%)',
            transform: `translateY(${scrollY * -0.3}px)`,
          }}
        />
      </div>

      {/* HEADER */}
      <header
        className="relative border-b transition-all duration-500"
        style={{
          borderColor: scrollY > 50 ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.05)',
          backgroundColor: scrollY > 50 ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
          backdropFilter: scrollY > 50 ? 'blur(10px)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-pointer transition-transform hover:scale-105">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <span className="text-lg font-bold tracking-tighter bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              DEVHOPS
            </span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm">
            {['How it works', 'Features', 'Pricing'].map((item, idx) => (
              <a
                key={idx}
                href={`#${item.toLowerCase().replace(' ', '-')}`}
                className="transition-colors duration-300 hover:text-yellow-500"
                style={{ color: '#e0e0e0' }}
              >
                {item}
              </a>
            ))}
          </nav>
          <button className="px-4 py-2 rounded-lg transition-all duration-300 font-medium text-sm text-black"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Start Free Trial
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative max-w-7xl mx-auto px-6 py-28 text-center">
        <div className="space-y-6 animate-slide-up">
          <div className="inline-block">
            <div
              className="px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-300 cursor-pointer hover:border-yellow-500"
              style={{
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                borderColor: 'rgba(212, 175, 55, 0.3)',
                color: '#f4d03f',
              }}
            >
              ⚡ Production Regression Detection
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
            <span className="block mb-2">When production</span>
            <span className="block mb-2">breaks, DEVHOPS</span>
            <span className="bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              finds the commit.
            </span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: '#e0e0e0' }}>
            Connect your metrics and GitHub repository. DEVHOPS detects regressions, correlates them with code changes, and proposes fixes automatically.
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center pt-8">
            <button
              onClick={handleConnect}
              className="px-8 py-4 rounded-xl font-semibold text-black flex items-center justify-center gap-2 transition-all duration-300 text-base"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Get Started Now <ArrowRight className="w-5 h-5" />
            </button>
            <button
              className="px-8 py-4 rounded-xl font-semibold transition-all duration-300 text-base flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                borderColor: 'rgba(212, 175, 55, 0.3)',
                color: '#f4d03f',
                border: '1px solid rgba(212, 175, 55, 0.3)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.1)'}
            >
              View Demo <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="relative max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Detection Speed', value: '<30s', icon: Zap },
            { label: 'Accuracy Rate', value: '99.2%', icon: Check },
            { label: 'Commits Analyzed', value: '1M+', icon: GitBranch },
            { label: 'Mean Time to Fix', value: '-67%', icon: TrendingUp },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="glass p-6 rounded-2xl transition-all duration-500 hover:scale-105 cursor-pointer group"
                style={{
                  backgroundColor: 'rgba(18, 18, 18, 0.4)',
                  borderColor: 'rgba(212, 175, 55, 0.12)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)';
                  e.currentTarget.style.backgroundColor = 'rgba(26, 26, 26, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.12)';
                  e.currentTarget.style.backgroundColor = 'rgba(18, 18, 18, 0.4)';
                }}
              >
                <Icon className="w-6 h-6 mb-3 group-hover:text-yellow-500 transition-colors" style={{ color: '#d4af37' }} />
                <div className="text-2xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm" style={{ color: '#a0a0a0' }}>
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CONNECT SECTION */}
      <section className="relative max-w-5xl mx-auto px-6 py-20">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold">Start monitoring now</h2>
            <p style={{ color: '#cbd5e1' }}>Set up DEVHOPS in under 5 minutes</p>
          </div>

          <div
            className="glass p-10 rounded-3xl space-y-8"
            style={{
              backgroundColor: 'rgba(18, 18, 18, 0.5)',
              borderColor: 'rgba(212, 175, 55, 0.15)',
            }}
          >
            {/* Metrics URL */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gradient-accent flex items-center justify-center text-xs font-bold text-white">
                  1
                </span>
                Metrics endpoint URL
              </label>
              <input
                type="url"
                placeholder="https://your-service.com/metrics"
                value={metricsUrl}
                onChange={(e) => setMetricsUrl(e.target.value)}
                className="w-full px-5 py-4 rounded-xl text-sm transition-all duration-300 focus:outline-none"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  borderColor: 'rgba(212, 175, 55, 0.15)',
                  border: '1px solid rgba(212, 175, 55, 0.15)',
                  color: '#ffffff',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.4)';
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.15)';
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                }}
              />
            </div>

            {/* GitHub Repo */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gradient-accent flex items-center justify-center text-xs font-bold text-white">
                  2
                </span>
                GitHub repository URL
              </label>
              <input
                type="url"
                placeholder="https://github.com/org/repo"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                className="w-full px-5 py-4 rounded-xl text-sm transition-all duration-300 focus:outline-none"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  borderColor: 'rgba(212, 175, 55, 0.15)',
                  border: '1px solid rgba(212, 175, 55, 0.15)',
                  color: '#ffffff',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.4)';
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.15)';
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                }}
              />
            </div>

            {/* Options */}
            <div className="space-y-4 pt-4">
              <label className="flex items-center gap-4 cursor-pointer group transition-all">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={enableCorrelation}
                    onChange={(e) => setEnableCorrelation(e.target.checked)}
                    className="w-5 h-5 rounded accent-yellow-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="font-medium text-sm group-hover:text-yellow-400 transition-colors">
                    Enable deployment correlation
                  </div>
                  <div className="text-xs" style={{ color: '#a0a0a0' }}>
                    Automatically correlate metric anomalies with deployments
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-4 cursor-pointer group transition-all">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={allowPR}
                    onChange={(e) => setAllowPR(e.target.checked)}
                    className="w-5 h-5 rounded accent-yellow-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="font-medium text-sm group-hover:text-yellow-400 transition-colors">
                    Allow pull request creation
                  </div>
                  <div className="text-xs" style={{ color: '#a0a0a0' }}>
                    DEVHOPS can create PRs with proposed fixes automatically
                  </div>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleConnect}
              disabled={isConnecting || !metricsUrl || !githubRepo}
              className="w-full py-4 px-6 rounded-xl font-semibold text-black transition-all duration-300 flex items-center justify-center gap-2"
              style={{
                background: isConnecting
                  ? 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)'
                  : 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
                opacity: isConnecting || !metricsUrl || !githubRepo ? 0.7 : 1,
              }}
            >
              {isConnecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Connect & Start Analyzing <Zap className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative max-w-7xl mx-auto px-6 py-20">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl font-bold">How it works</h2>
          <p style={{ color: '#e0e0e0' }}>Five simple steps to regression-free production</p>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {[
            { title: 'Monitor', desc: 'Continuously reads metrics', icon: TrendingUp },
            { title: 'Baseline', desc: 'Learns normal behavior', icon: Check },
            { title: 'Detect', desc: 'Identifies anomalies', icon: Zap },
            { title: 'Correlate', desc: 'Matches commits', icon: GitBranch },
            { title: 'Fix', desc: 'Proposes PR fixes', icon: ArrowRight },
          ].map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="relative group">
                <div
                  className="glass p-6 rounded-2xl text-center space-y-4 transition-all duration-500 hover:scale-105 h-full"
                  style={{
                    backgroundColor: 'rgba(18, 18, 18, 0.4)',
                    borderColor: 'rgba(212, 175, 55, 0.12)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)';
                    e.currentTarget.style.backgroundColor = 'rgba(26, 26, 26, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.12)';
                    e.currentTarget.style.backgroundColor = 'rgba(18, 18, 18, 0.4)';
                  }}
                >
                  <Icon className="w-8 h-8 mx-auto" style={{ color: '#d4af37' }} />
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm" style={{ color: '#a0a0a0' }}>
                    {step.desc}
                  </p>
                </div>
                {idx < 4 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-1 bg-gradient-to-r from-yellow-500 to-yellow-600" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative max-w-7xl mx-auto px-6 py-20">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl font-bold">What you get</h2>
          <p style={{ color: '#e0e0e0' }}>Everything you need to fix regressions faster</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {[
            { title: 'Ranked Suspects', desc: 'Commits ranked by confidence with detailed impact analysis' },
            { title: 'AI-Powered Insights', desc: 'Plain-English explanations of why changes are risky' },
            { title: 'Proposed Fixes', desc: 'Concrete code suggestions to address regressions' },
            { title: 'GitHub Integration', desc: 'Automated PR creation with ready-to-merge solutions' },
            { title: 'Real-Time Alerts', desc: 'Instant notifications when regressions are detected' },
            { title: 'Correlation Engine', desc: 'Advanced algorithms matching metrics to code changes' },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="glass p-8 rounded-2xl space-y-4 transition-all duration-500 hover:scale-105 group"
              style={{
                backgroundColor: 'rgba(18, 18, 18, 0.4)',
                borderColor: 'rgba(212, 175, 55, 0.12)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.25)';
                e.currentTarget.style.backgroundColor = 'rgba(26, 26, 26, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.12)';
                e.currentTarget.style.backgroundColor = 'rgba(18, 18, 18, 0.4)';
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                <Check className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p style={{ color: '#e0e0e0' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="relative border-t mt-20 py-16"
        style={{ borderColor: 'rgba(212, 175, 55, 0.08)' }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-gradient-accent flex items-center justify-center">
                  <Zap className="w-4 h-4 text-black" />
                </div>
                <span className="font-bold">DEVHOPS</span>
              </div>
              <p style={{ color: '#a0a0a0' }}>Production regression detection made simple.</p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Security'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Contact'] },
            ].map((col, idx) => (
              <div key={idx}>
                <h4 className="font-semibold mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" style={{ color: '#94a3b8' }} className="hover:text-purple-400 transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t" style={{ borderColor: 'rgba(139, 92, 246, 0.1)' }}>
            <div className="pt-8 text-center text-sm" style={{ color: '#94a3b8' }}>
              <p>© 2026 DEVHOPS. All rights reserved. Built for developers, by developers.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
