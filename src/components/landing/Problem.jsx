import { motion } from 'framer-motion';
import { useLang } from '../../context/LangContext';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICONS = {
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  mic: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { duration: prefersReduced ? 0 : 0.55, delay: prefersReduced ? 0 : i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Problem() {
  const { content } = useLang();
  const { problem } = content;

  return (
    <section
      id="problem"
      aria-labelledby="problem-headline"
      style={{
        padding: 'clamp(64px, 10vw, 112px) var(--container-pad)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: prefersReduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: 'clamp(40px, 6vw, 64px)' }}
        >
          <span style={{
            display: 'inline-block',
            fontSize: 'var(--fs-tiny)',
            fontWeight: 500,
            color: 'var(--text-muted)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            {problem.eyebrow}
          </span>
          <h2
            id="problem-headline"
            style={{
              fontSize: 'var(--fs-h2)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              letterSpacing: '-0.022em',
              lineHeight: 1.15,
              color: 'var(--text-primary)',
              margin: 0,
              maxWidth: 560,
            }}
          >
            {problem.headline}
          </h2>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problem.items.map((item, i) => (
            <motion.div
              key={item.icon}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-card)',
                padding: 'clamp(24px, 3vw, 32px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                transition: 'border-color 250ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              {/* Icon */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                flexShrink: 0,
              }}>
                {ICONS[item.icon]}
              </div>

              {/* Headline */}
              <h3 style={{
                fontSize: 'var(--fs-h3)',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                letterSpacing: '-0.015em',
                lineHeight: 1.3,
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {item.headline}
              </h3>

              {/* Body */}
              <p style={{
                fontSize: 'var(--fs-body)',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                margin: 0,
                flex: 1,
              }}>
                {item.body}
              </p>

              {/* Metric badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent-400)',
                  flexShrink: 0,
                }} aria-hidden="true" />
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-tiny)',
                  color: 'var(--accent-400)',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}>
                  {item.metric}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
