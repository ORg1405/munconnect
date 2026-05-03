import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../../context/LangContext';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function MagneticCTA({ href, children }) {
  const ref = useRef(null);

  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) * 0.14;
    const dy = (e.clientY - (r.top + r.height / 2)) * 0.14;
    ref.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'translate(0, 0)';
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
        fontWeight: 600,
        fontSize: 'var(--fs-lead)',
        textDecoration: 'none',
        padding: '16px 36px',
        borderRadius: 'var(--radius-btn)',
        background: 'var(--grad-brand)',
        color: 'white',
        boxShadow: 'var(--glow-brand)',
        whiteSpace: 'nowrap',
        transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1), box-shadow 200ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 60px hsl(199 92% 58% / 0.40)'; }}
      onMouseLeave2={e => { e.currentTarget.style.boxShadow = 'var(--glow-brand)'; onLeave(); }}
    >
      {children}
    </Link>
  );
}

export default function FinalCTA() {
  const { content } = useLang();
  const { finalCta } = content;

  return (
    <section
      aria-labelledby="finalcta-headline"
      style={{
        position: 'relative',
        padding: 'clamp(80px, 14vw, 144px) var(--container-pad)',
        overflow: 'hidden',
        textAlign: 'center',
      }}
    >
      {/* Aurora background */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--grad-aurora)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      {/* Dot grid */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, hsl(220 15% 96% / 0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none', zIndex: 0,
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
        <motion.h2
          id="finalcta-headline"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: prefersReduced ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontSize: 'var(--fs-h1)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            letterSpacing: '-0.028em',
            lineHeight: 1.1,
            color: 'var(--text-primary)',
            margin: '0 0 20px',
          }}
        >
          {finalCta.headline}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: prefersReduced ? 0 : 0.55, delay: prefersReduced ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontSize: 'var(--fs-lead)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: '0 0 40px',
          }}
        >
          {finalCta.subhead}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: prefersReduced ? 0 : 0.5, delay: prefersReduced ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}
        >
          <MagneticCTA href="/app">
            {finalCta.cta} →
          </MagneticCTA>

          <p style={{
            fontSize: 'var(--fs-small)',
            color: 'var(--text-muted)',
            margin: 0,
          }}>
            {finalCta.note}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
