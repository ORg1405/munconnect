import { motion } from 'framer-motion';
import { useLang } from '../../context/LangContext';

const ZapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const GithubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ICONS = { claude: ZapIcon, github: GithubIcon, firebase: ShieldIcon };

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function TechTrust() {
  const { content } = useLang();
  const { techTrust } = content;

  return (
    <section
      aria-labelledby="techtrust-headline"
      style={{
        padding: 'clamp(56px, 9vw, 96px) var(--container-pad)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto' }}>
        <motion.h2
          id="techtrust-headline"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontSize: 'var(--fs-h3)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: 'var(--text-muted)',
            margin: '0 0 clamp(32px, 5vw, 48px)',
            textAlign: 'center',
          }}
        >
          {techTrust.headline}
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 lg:gap-16">
          {techTrust.items.map((item, i) => {
            const Icon = ICONS[item.icon] ?? ZapIcon;
            const inner = (
              <motion.div
                key={item.icon}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40, height: 40,
                  borderRadius: 10,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--brand-400)',
                  flexShrink: 0,
                }}>
                  <Icon />
                </div>

                <div>
                  <p style={{
                    fontSize: 'var(--fs-body)',
                    fontWeight: 600,
                    color: item.link ? 'var(--brand-400)' : 'var(--text-primary)',
                    margin: '0 0 4px',
                    letterSpacing: '-0.01em',
                  }}>
                    {item.headline}
                  </p>
                  <p style={{
                    fontSize: 'var(--fs-small)',
                    color: 'var(--text-muted)',
                    margin: 0,
                    lineHeight: 1.65,
                  }}>
                    {item.body}
                  </p>
                </div>
              </motion.div>
            );

            return item.link ? (
              <a
                key={item.icon}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                {inner}
              </a>
            ) : inner;
          })}
        </div>
      </div>
    </section>
  );
}
