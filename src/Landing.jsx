import { LangProvider } from './context/LangContext';
import Navbar from './components/landing/Navbar';
import Hero from './components/landing/Hero';
import LogoStrip from './components/landing/LogoStrip';
import Problem from './components/landing/Problem';
import BentoGrid from './components/landing/BentoGrid';
import TechTrust from './components/landing/TechTrust';
import HowItWorks from './components/landing/HowItWorks';
import UseCaseTabs from './components/landing/UseCaseTabs';
import FAQ from './components/landing/FAQ';
import FinalCTA from './components/landing/FinalCTA';
import Footer from './components/landing/Footer';

export default function Landing() {
  return (
    <LangProvider>
      {/* Skip-to-content link for keyboard users */}
      <a
        href="#main"
        style={{
          position: 'absolute', top: -80, left: 16,
          padding: '8px 16px',
          background: 'var(--brand-500)', color: 'white',
          borderRadius: 8, fontSize: 'var(--fs-small)', fontWeight: 600,
          textDecoration: 'none', zIndex: 100,
          transition: 'top 200ms',
        }}
        onFocus={e => { e.currentTarget.style.top = '16px'; }}
        onBlur={e => { e.currentTarget.style.top = '-80px'; }}
      >
        Skip to main content
      </a>

      <div style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh' }}>
        <Navbar />
        <main id="main">
          <Hero />
          <LogoStrip />
          <Problem />
          <BentoGrid />
          <TechTrust />
          <HowItWorks />
          <UseCaseTabs />
          <FAQ />
          <FinalCTA />
        </main>
        <Footer />
      </div>
    </LangProvider>
  );
}
