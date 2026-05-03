import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../../context/LangContext';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function TypingMockup({ committee, topic, motionText, motionMeta, label }) {
  const [displayed, setDisplayed] = useState(prefersReduced ? motionText : '');
  const [done, setDone] = useState(prefersReduced);

  useEffect(() => {
    if (prefersReduced) {
      setDisplayed(motionText);
      setDone(true);
      return;
    }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const startTimeout = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setDisplayed(motionText.slice(0, i));
        if (i >= motionText.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, 18);
      return () => clearInterval(interval);
    }, 600);
    return () => clearTimeout(startTimeout);
  }, [motionText]);

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-card)',
        boxShadow: '0 0 0 1px hsl(220 15% 96% / 0.05), var(--glow-brand)',
        padding: '18px 20px 20px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.78rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.65,
        width: 420,
        maxWidth: '100%',
      }}
      aria-label="App mockup showing a generated motion"
      role="img"
    >
      {/* Window chrome dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }} aria-hidden="true">
        {['#EF4444', '#F59E0B', '#22C55E'].map(c => (
          <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'block', flexShrink: 0 }} />
        ))}
      </div>

      {/* Committee & topic */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--brand-400)' }}>Committee: </span>{committee}
        </div>
        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--brand-400)' }}>Topic: </span>{topic}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div style={{
          color: 'var(--accent-400)',
          fontSize: '0.68rem',
          marginBottom: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}>
          [{label}]
        </div>

        <p style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0, minHeight: '5.2em' }}>
          {displayed}
          {!done && (
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 2,
                height: '1em',
                background: 'var(--brand-400)',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                animation: 'blink 0.9s step-end infinite',
              }}
            />
          )}
        </p>

        {done && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.71rem',
              margin: '12px 0 0',
              borderTop: '1px solid var(--border)',
              paddingTop: 10,
            }}
          >
            {motionMeta}
          </motion.p>
        )}
      </div>
    </div>
  );
}

function MagneticCTA({ href, children, primary }) {
  const ref = useRef(null);

  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) * 0.14;
    const dy = (e.clientY - (r.top + r.height / 2)) * 0.14;
    ref.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'translate(0,0)';
  };

  return (
    <Link
      ref={ref}
      to={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontWeight: primary ? 600 : 500,
        fontSize: 'var(--fs-body)',
        textDecoration: 'none',
        padding: primary ? '13px 28px' : '12px 20px',
        borderRadius: 'var(--radius-btn)',
        whiteSpace: 'nowrap',
        transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 200ms',
        ...(primary
          ? {
              background: 'var(--grad-brand)',
              color: 'white',
              boxShadow: 'var(--glow-brand)',
            }
          : {
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              background: 'transparent',
            }),
      }}
      onMouseEnter={e => {
        if (!primary) {
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.borderColor = 'var(--border-strong)';
        }
      }}
      onMouseLeave2={e => {
        if (!primary) {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }
        onLeave();
      }}
    >
      {children}
    </Link>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: prefersReduced ? 0 : 0.65, delay: prefersReduced ? 0 : delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Hero() {
  const { content } = useLang();
  const { hero } = content;
  const [phraseIdx] = useState(() => Math.floor(Math.random() * content.headlineRotation.length));
  const phrase = content.headlineRotation[phraseIdx];
  const sectionRef = useRef(null);
  const auroraRef = useRef(null);

  const onMouseMove = (e) => {
    if (!sectionRef.current || !auroraRef.current) return;
    const r = sectionRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - r.left) / r.width) * 100;
    const yPct = ((e.clientY - r.top) / r.height) * 100;
    auroraRef.current.style.background = `radial-gradient(
      ellipse 80% 50% at ${50 + (xPct - 50) * 0.15}% ${yPct * 0.18}%,
      hsl(199 92% 58% / 0.2),
      transparent 70%
    )`;
  };

  return (
    <section
      ref={sectionRef}
      onMouseMove={onMouseMove}
      aria-labelledby="hero-headline"
      style={{
        position: 'relative',
        minHeight: 'min(100svh, 880px)',
        display: 'flex',
        alignItems: 'center',
        padding: 'clamp(72px, 12vh, 128px) var(--container-pad) 80px',
        overflow: 'hidden',
      }}
    >
      {/* Aurora */}
      <div
        ref={auroraRef}
        aria-hidden="true"
        className="aurora-bg"
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--grad-aurora)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      {/* Subtle dot-grid mask */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle, hsl(220 15% 96% / 0.07) 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          pointerEvents: 'none', zIndex: 0,
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent)',
        }}
      />

      <div
        style={{ maxWidth: 'var(--container-max)', margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}
        className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16"
      >
        {/* Copy block */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Eyebrow */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 'var(--fs-tiny)', fontWeight: 500,
              color: 'var(--text-muted)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-badge)',
              padding: '5px 13px',
              letterSpacing: '0.03em',
              marginBottom: 28,
              whiteSpace: 'nowrap',
              width: 'fit-content',
            }}>
              {hero.eyebrow}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            id="hero-headline"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.08}
            style={{
              fontSize: 'var(--fs-display)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              letterSpacing: '-0.028em',
              lineHeight: 1.04,
              color: 'var(--text-primary)',
              margin: '0 0 24px',
            }}
          >
            {phrase.pre}
            <em style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 400,
              background: 'var(--grad-brand)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {phrase.italic}
            </em>
            {phrase.post ?? ''}
          </motion.h1>

          {/* Subhead */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.16}
            style={{
              fontSize: 'var(--fs-lead)',
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
              maxWidth: 540,
              margin: '0 0 20px',
            }}
          >
            {hero.subhead}
          </motion.p>

          {/* Feature pills */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.2}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}
          >
            {[
              { icon: '⚡', label: 'Motion Generator' },
              { icon: '🗣', label: 'Debate Simulator' },
              { icon: '📅', label: 'Conference Calendar' },
            ].map(({ icon, label }) => (
              <span
                key={label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 'var(--fs-small)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-badge)',
                  padding: '6px 12px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </span>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.24}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}
          >
            <MagneticCTA href="/app" primary>
              {hero.primaryCta} →
            </MagneticCTA>

            <a
              href="#demo"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 500,
                fontSize: 'var(--fs-body)',
                textDecoration: 'none',
                padding: '12px 20px',
                borderRadius: 'var(--radius-btn)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                background: 'transparent',
                transition: 'color 200ms, border-color 200ms',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--bg-overlay)',
                  fontSize: '0.6rem',
                }}
              >▶</span>
              {hero.secondaryCta}
            </a>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.32}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', marginTop: 28 }}
          >
            {hero.trust.map((item, i) => (
              <span key={item} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--fs-tiny)', color: 'var(--text-muted)' }}>{item}</span>
                {i < hero.trust.length - 1 && (
                  <span aria-hidden="true" style={{ color: 'var(--border-strong)', margin: '0 10px', fontSize: '0.7rem' }}>·</span>
                )}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Mockup */}
        <motion.div
          initial={{ opacity: 0, x: 24, y: 12 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: prefersReduced ? 0 : 0.85, delay: prefersReduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ flexShrink: 0, display: 'flex', justifyContent: 'center' }}
          className="w-full lg:w-auto"
        >
          <TypingMockup
            committee={hero.mockupCommittee}
            topic={hero.mockupTopic}
            motionText={hero.mockupText}
            motionMeta={hero.mockupMeta}
            label={hero.mockupLabel}
          />
        </motion.div>
      </div>
    </section>
  );
}
