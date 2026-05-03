import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '../../context/LangContext';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: 'var(--brand-400)' }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export default function UseCaseTabs() {
  const { content } = useLang();
  const { useCases } = content;
  const [activeId, setActiveId] = useState(useCases.tabs[0].id);

  const active = useCases.tabs.find(t => t.id === activeId) ?? useCases.tabs[0];

  return (
    <section
      id="use-cases"
      aria-labelledby="usecases-headline"
      style={{
        padding: 'clamp(64px, 10vw, 112px) var(--container-pad)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 'clamp(32px, 5vw, 48px)' }}>
          <span style={{
            display: 'inline-block',
            fontSize: 'var(--fs-tiny)', fontWeight: 500,
            color: 'var(--text-muted)', letterSpacing: '0.07em',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            {useCases.eyebrow}
          </span>
          <h2
            id="usecases-headline"
            style={{
              fontSize: 'var(--fs-h2)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              letterSpacing: '-0.022em',
              lineHeight: 1.15,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Built for everyone{' '}
            <em style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400 }}>
              in the room.
            </em>
          </h2>
        </div>

        {/* Tab bar — hidden on mobile */}
        <div
          className="hidden sm:flex"
          role="tablist"
          aria-label={useCases.eyebrow}
          style={{
            borderBottom: '1px solid var(--border)',
            marginBottom: 36,
          }}
        >
          {useCases.tabs.map(tab => {
            const isActive = tab.id === activeId;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveId(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '12px 24px',
                  cursor: 'pointer',
                  fontSize: 'var(--fs-body)',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: isActive ? '2px solid var(--brand-500)' : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'color 200ms, border-color 200ms',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Native select — mobile only */}
        <div className="sm:hidden" style={{ marginBottom: 28 }}>
          <select
            value={activeId}
            onChange={e => setActiveId(e.target.value)}
            aria-label={useCases.eyebrow}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 'var(--fs-body)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-btn)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {useCases.tabs.map(tab => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
        </div>

        {/* Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeId}
            role="tabpanel"
            id={`panel-${activeId}`}
            aria-labelledby={`tab-${activeId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: prefersReduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 sm:grid-cols-2"
            style={{ gap: 'clamp(24px, 4vw, 48px)', alignItems: 'stretch' }}
          >
            {/* Bullet list */}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {active.bullets.map((bullet) => (
                <li key={bullet} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <CheckIcon />
                  <span style={{
                    fontSize: 'var(--fs-body)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}>
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>

            {/* Placeholder gradient card */}
            <div
              aria-hidden="true"
              style={{
                background: 'radial-gradient(ellipse 80% 60% at 30% 40%, hsl(199 92% 58% / 0.10), transparent 70%), var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                minHeight: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-small)',
                color: 'var(--text-muted)',
                opacity: 0.5,
              }}>
                {active.label}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
}
