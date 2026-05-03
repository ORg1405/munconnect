import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../../context/LangContext';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function HowItWorks() {
  const { content } = useLang();
  const { howItWorks } = content;

  return (
    <section
      id="how-it-works"
      aria-labelledby="hiw-headline"
      style={{
        padding: 'clamp(64px, 10vw, 112px) var(--container-pad)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto' }}>

        {/* ── Desktop: sticky left + scrolling right ── */}
        <div className="hidden lg:flex" style={{ gap: 'clamp(48px, 8vw, 96px)', alignItems: 'flex-start' }}>

          {/* Sticky left */}
          <div style={{ flex: '0 0 320px', position: 'sticky', top: 120 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: prefersReduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <span style={{
                display: 'inline-block',
                fontSize: 'var(--fs-tiny)', fontWeight: 500,
                color: 'var(--text-muted)', letterSpacing: '0.07em',
                textTransform: 'uppercase', marginBottom: 16,
              }}>
                {howItWorks.eyebrow}
              </span>
              <h2
                id="hiw-headline"
                style={{
                  fontSize: 'var(--fs-h2)',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
                  letterSpacing: '-0.022em',
                  lineHeight: 1.15,
                  color: 'var(--text-primary)',
                  margin: '0 0 32px',
                }}
              >
                Three steps.{' '}
                <em style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400 }}>
                  Better conferences.
                </em>
              </h2>
              <Link
                to="/app"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 'var(--fs-body)',
                  fontWeight: 600,
                  color: 'var(--brand-400)',
                  textDecoration: 'none',
                  transition: 'color 200ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-glow)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--brand-400)'; }}
              >
                {howItWorks.cta} →
              </Link>
            </motion.div>
          </div>

          {/* Scrolling right: steps */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {howItWorks.steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: prefersReduced ? 0 : 0.55, delay: prefersReduced ? 0 : i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: 'flex',
                  gap: 24,
                  paddingBottom: i < howItWorks.steps.length - 1 ? 48 : 0,
                  paddingTop: i > 0 ? 48 : 0,
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Number badge */}
                <div style={{
                  flexShrink: 0,
                  width: 40, height: 40,
                  borderRadius: '50%',
                  background: 'var(--brand-500)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-tiny)',
                  fontWeight: 700,
                  color: 'white',
                  marginTop: 2,
                }}>
                  {step.number}
                </div>

                <div>
                  <h3 style={{
                    fontSize: 'var(--fs-h3)',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 600,
                    letterSpacing: '-0.015em',
                    color: 'var(--text-primary)',
                    margin: '0 0 10px',
                  }}>
                    {step.headline}
                  </h3>
                  <p style={{
                    fontSize: 'var(--fs-body)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                    margin: 0,
                    maxWidth: 480,
                  }}>
                    {step.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Mobile: vertical accordion ── */}
        <div className="lg:hidden">
          <span style={{
            display: 'inline-block',
            fontSize: 'var(--fs-tiny)', fontWeight: 500,
            color: 'var(--text-muted)', letterSpacing: '0.07em',
            textTransform: 'uppercase', marginBottom: 12,
          }}>
            {howItWorks.eyebrow}
          </span>
          <h2
            id="hiw-headline"
            style={{
              fontSize: 'var(--fs-h1)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              letterSpacing: '-0.022em',
              lineHeight: 1.15,
              color: 'var(--text-primary)',
              margin: '0 0 28px',
            }}
          >
            Three steps.{' '}
            <em style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400 }}>
              Better conferences.
            </em>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {howItWorks.steps.map((step, i) => (
              <details
                key={step.number}
                open={i === 0}
                style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}
              >
                <summary
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '16px 0',
                    cursor: 'pointer',
                    listStyle: 'none',
                    userSelect: 'none',
                  }}
                >
                  <span style={{
                    flexShrink: 0,
                    width: 32, height: 32,
                    borderRadius: '50%',
                    background: 'var(--brand-500)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--fs-tiny)',
                    fontWeight: 700,
                    color: 'white',
                  }}>
                    {step.number}
                  </span>
                  <span style={{
                    fontSize: 'var(--fs-body)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                    flex: 1,
                  }}>
                    {step.headline}
                  </span>
                </summary>
                <p style={{
                  fontSize: 'var(--fs-body)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  margin: '0 0 20px',
                  paddingLeft: 46,
                }}>
                  {step.body}
                </p>
              </details>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 4 }}>
              <a
                href="/app"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 'var(--fs-body)',
                  fontWeight: 600,
                  color: 'var(--brand-400)',
                  textDecoration: 'none',
                }}
              >
                {howItWorks.cta} →
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
