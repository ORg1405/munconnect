import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../../context/LangContext';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Navbar() {
  const { lang, setLang, content } = useLang();
  const { nav } = content;
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setDrawerOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
          background: scrolled ? 'color-mix(in srgb, var(--bg-elevated) 85%, transparent)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          transition: 'background 300ms, border-color 300ms, backdrop-filter 300ms',
        }}
      >
        <nav
          style={{ maxWidth: 'var(--container-max)', padding: '0 var(--container-pad)' }}
          className="mx-auto h-16 flex items-center justify-between gap-8"
          aria-label="Main navigation"
        >
          {/* Logo */}
          <a
            href="/"
            className="flex items-center shrink-0"
            style={{ gap: 3, textDecoration: 'none' }}
            aria-label="MUNConnect home"
          >
            <span style={{
              fontFamily: 'var(--font-ui)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontSize: '1.05rem',
              letterSpacing: '-0.02em',
            }}>
              MUN
            </span>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent-400)',
                flexShrink: 0,
                margin: '0 2px',
              }}
            />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              color: 'var(--text-primary)',
              fontSize: '1.05rem',
            }}>
              Connect
            </span>
          </a>

          {/* Centre links — desktop only */}
          <ul
            className="hidden md:flex items-center gap-6 list-none m-0 p-0 flex-1 justify-center"
            role="list"
          >
            {nav.links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--fs-small)',
                    fontWeight: 500,
                    textDecoration: 'none',
                    transition: 'color 200ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Right actions — desktop only */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <button
              onClick={() => setLang(lang === 'en' ? 'pt-BR' : 'en')}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-tiny)',
                color: 'var(--text-muted)',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-badge)',
                padding: '4px 10px',
                cursor: 'pointer',
                transition: 'color 200ms, border-color 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              aria-label={`Switch language to ${lang === 'en' ? 'Portuguese' : 'English'}`}
            >
              {lang === 'en' ? 'PT' : 'EN'}
            </button>

            <Link
              to="/app"
              style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--fs-small)',
                fontWeight: 500,
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: 'var(--radius-btn)',
                border: '1px solid var(--border)',
                transition: 'color 200ms, border-color 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              {nav.signIn}
            </Link>

            <Link
              to="/app"
              style={{
                background: 'var(--grad-brand)',
                color: 'white',
                fontSize: 'var(--fs-small)',
                fontWeight: 600,
                textDecoration: 'none',
                padding: '7px 16px',
                borderRadius: 'var(--radius-btn)',
                transition: 'opacity 200ms, transform 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {nav.openApp}
            </Link>
          </div>

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex flex-col justify-center p-2"
            style={{ gap: 5, background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setDrawerOpen(v => !v)}
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav"
          >
            <span style={{
              display: 'block', width: 22, height: 2,
              background: 'var(--text-primary)', borderRadius: 2,
              transition: 'transform 250ms',
              transform: drawerOpen ? 'translateY(7px) rotate(45deg)' : 'none',
            }} />
            <span style={{
              display: 'block', width: 22, height: 2,
              background: 'var(--text-primary)', borderRadius: 2,
              transition: 'opacity 250ms',
              opacity: drawerOpen ? 0 : 1,
            }} />
            <span style={{
              display: 'block', width: 22, height: 2,
              background: 'var(--text-primary)', borderRadius: 2,
              transition: 'transform 250ms',
              transform: drawerOpen ? 'translateY(-7px) rotate(-45deg)' : 'none',
            }} />
          </button>
        </nav>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReduced ? 0 : 0.2 }}
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
              style={{
                position: 'fixed', inset: 0,
                background: 'color-mix(in srgb, var(--bg-base) 75%, transparent)',
                backdropFilter: 'blur(4px)',
                zIndex: 40,
              }}
            />
            <motion.nav
              id="mobile-nav"
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={prefersReduced ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 280 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 280,
                background: 'var(--bg-elevated)',
                borderLeft: '1px solid var(--border)',
                zIndex: 50,
                padding: '20px',
                display: 'flex', flexDirection: 'column',
              }}
              aria-label="Mobile navigation"
            >
              <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                  MUNConnect
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: 4 }}
                  aria-label="Close menu"
                >
                  ×
                </button>
              </div>

              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }} role="list">
                {nav.links.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={() => setDrawerOpen(false)}
                      style={{
                        display: 'block', padding: '10px 12px',
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--fs-body)', textDecoration: 'none',
                        borderRadius: 8, transition: 'background 200ms, color 200ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => setLang(lang === 'en' ? 'pt-BR' : 'en')}
                  style={{
                    padding: '8px', fontSize: 'var(--fs-small)',
                    color: 'var(--text-muted)', background: 'transparent',
                    border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
                  }}
                >
                  {lang === 'en' ? 'Switch to PT-BR' : 'Switch to EN'}
                </button>
                <Link
                  to="/app"
                  style={{
                    display: 'block', textAlign: 'center', padding: '11px',
                    background: 'var(--grad-brand)', color: 'white',
                    fontWeight: 600, fontSize: 'var(--fs-small)',
                    textDecoration: 'none', borderRadius: 'var(--radius-btn)',
                  }}
                >
                  {nav.openApp}
                </Link>
                <a
                  href="https://github.com/ORg1405/munconnect"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block', textAlign: 'center', padding: '8px',
                    color: 'var(--text-muted)', fontSize: 'var(--fs-small)', textDecoration: 'none',
                  }}
                >
                  GitHub ↗
                </a>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
