import { motion } from 'framer-motion';
import { useLang } from '../../context/LangContext';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function FAQ() {
  const { content } = useLang();
  const { faq } = content;

  return (
    <section
      id="faq"
      aria-labelledby="faq-headline"
      style={{
        padding: 'clamp(64px, 10vw, 112px) var(--container-pad)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto' }}>
        <div className="grid grid-cols-1 lg:grid-cols-12" style={{ gap: 'clamp(32px, 6vw, 64px)' }}>

          {/* Left: eyebrow + headline */}
          <motion.div
            className="lg:col-span-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: prefersReduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ alignSelf: 'start' }}
          >
            <span style={{
              display: 'inline-block',
              fontSize: 'var(--fs-tiny)', fontWeight: 500,
              color: 'var(--text-muted)', letterSpacing: '0.07em',
              textTransform: 'uppercase', marginBottom: 14,
            }}>
              {faq.eyebrow}
            </span>
            <h2
              id="faq-headline"
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
              {faq.headline}
            </h2>
          </motion.div>

          {/* Right: accordion */}
          <motion.div
            className="lg:col-span-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: prefersReduced ? 0 : 0.55, delay: prefersReduced ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            {faq.items.map((item, i) => (
              <details
                key={i}
                style={{ borderTop: i === 0 ? '1px solid var(--border)' : undefined }}
              >
                <summary
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    padding: '18px 0',
                    cursor: 'pointer',
                    listStyle: 'none',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { e.currentTarget.querySelector('.faq-q').style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.querySelector('.faq-q').style.color = 'var(--text-secondary)'; }}
                >
                  <span
                    className="faq-q"
                    style={{
                      fontSize: 'var(--fs-body)',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      transition: 'color 200ms',
                      flex: 1,
                    }}
                  >
                    {item.q}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: '1.2rem',
                      color: 'var(--brand-500)',
                      fontWeight: 300,
                      lineHeight: 1,
                      flexShrink: 0,
                      userSelect: 'none',
                    }}
                    className="faq-indicator"
                  >
                    +
                  </span>
                </summary>
                <p style={{
                  fontSize: 'var(--fs-body)',
                  color: 'var(--text-muted)',
                  lineHeight: 1.75,
                  margin: 0,
                  padding: '4px 0 20px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {item.a}
                </p>
              </details>
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  );
}
