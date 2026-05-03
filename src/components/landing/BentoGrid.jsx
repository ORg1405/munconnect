import { motion } from 'framer-motion';
import { useLang } from '../../context/LangContext';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─── Spotlight hover handler shared by all cards ─────────────────────────── */
const onCardMouseMove = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mouse-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
  e.currentTarget.style.setProperty('--mouse-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
};

/* ─── Card shell ───────────────────────────────────────────────────────────── */
function Card({ children, className = '', style = {}, onMouseEnter, onMouseLeave }) {
  return (
    <motion.div
      className={`card-spotlight ${className}`}
      onMouseMove={onCardMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: 'clamp(20px, 2.5vw, 28px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflow: 'hidden',
        transition: 'border-color 250ms',
        ...style,
      }}
      onMouseEnter2={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      onMouseLeave2={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {children}
    </motion.div>
  );
}

function CardLabel({ label }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      width: 'fit-content',
      fontSize: 'var(--fs-tiny)',
      fontWeight: 600,
      color: 'var(--brand-400)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {label}
    </span>
  );
}

function CardHeadline({ children }) {
  return (
    <p style={{
      fontSize: 'var(--fs-h3)',
      fontFamily: 'var(--font-ui)',
      fontWeight: 600,
      letterSpacing: '-0.015em',
      lineHeight: 1.3,
      color: 'var(--text-primary)',
      margin: 0,
    }}>
      {children}
    </p>
  );
}

function CardDetail({ children }) {
  return (
    <p style={{
      fontSize: 'var(--fs-small)',
      color: 'var(--text-muted)',
      margin: '4px 0 0',
      lineHeight: 1.6,
      fontFamily: 'var(--font-mono)',
    }}>
      — {children}
    </p>
  );
}

/* ─── Card 1 visual: motion generator preview ─────────────────────────────── */
function MotionPreview() {
  return (
    <div style={{
      background: 'var(--bg-base)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.75rem',
      lineHeight: 1.65,
      color: 'var(--text-secondary)',
      flex: 1,
      minHeight: 120,
    }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 12 }} aria-hidden="true">
        {['#EF4444','#F59E0B','#22C55E'].map(c => (
          <span key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'block' }} />
        ))}
      </div>
      <div style={{ color: 'var(--text-muted)', marginBottom: 10 }}>
        <span style={{ color: 'var(--brand-400)' }}>Committee:</span> UNSC · <span style={{ color: 'var(--brand-400)' }}>Topic:</span> Sahel
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={{ color: 'var(--accent-400)', fontSize: '0.68rem', letterSpacing: '0.06em', marginBottom: 8 }}>
          GENERATED MOTION
        </div>
        <p style={{ color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>
          {'"Motion to open the\nspeakers list at 90s,\nprioritizing P5 and AU\nobserver states."'}
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block', width: 2, height: '0.9em',
              background: 'var(--brand-400)', marginLeft: 2,
              verticalAlign: 'text-bottom',
              animation: 'blink 0.9s step-end infinite',
            }}
          />
        </p>
      </div>
    </div>
  );
}

/* ─── Card 2 visual: debate simulator bubbles ─────────────────────────────── */
function DebateBubbles() {
  const turns = [
    { flag: '🇺🇸', country: 'United States', side: 'left',  text: '"We move to extend debate — motion is premature."' },
    { flag: '🇷🇺', country: 'Russia',         side: 'right', text: '"Russia objects. We call for an immediate vote."' },
    { flag: '🇧🇷', country: 'Brazil',          side: 'left',  text: '"Moderated caucus — 20 min, 90-second speeches."' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
      {turns.map(({ flag, country, side, text }) => (
        <div key={country} style={{ display: 'flex', justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}>
          <div style={{
            maxWidth: '88%',
            background: side === 'right' ? 'color-mix(in hsl, var(--brand-500) 15%, transparent)' : 'var(--bg-overlay)',
            border: `1px solid ${side === 'right' ? 'color-mix(in hsl, var(--brand-500) 30%, transparent)' : 'var(--border)'}`,
            borderRadius: side === 'right' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
            padding: '8px 12px',
          }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>{flag}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{country}</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Card 3 visual: country research brief ───────────────────────────────── */
function ResearchBrief() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '1.3rem' }}>🇧🇷</span>
        <span style={{ fontSize: 'var(--fs-small)', fontWeight: 600, color: 'var(--text-primary)' }}>Brazil</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-tiny)',
          color: 'var(--text-muted)', background: 'var(--bg-overlay)',
          border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px',
        }}>BRA</span>
      </div>
      {[
        { label: 'Bloc', value: 'G77 + China · CELAC · IBSA' },
        { label: 'Priority', value: 'Climate, sovereignty, dev. finance' },
        { label: 'Red lines', value: 'No external intervention language' },
        { label: 'Last vote', value: '✓ Sustainable Dev. Goals A/78/L.1' },
      ].map(({ label, value }) => (
        <div key={label} style={{
          display: 'flex', gap: 8, fontSize: 'var(--fs-tiny)',
          paddingTop: 6, borderTop: '1px solid var(--border)',
        }}>
          <span style={{ color: 'var(--brand-400)', fontFamily: 'var(--font-mono)', fontWeight: 500, flexShrink: 0, minWidth: 52 }}>
            {label}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Card 4 visual: conference calendar mini-grid ────────────────────────── */
function CalendarPreview() {
  const days = ['M','T','W','T','F','S','S'];
  const dates = Array.from({ length: 35 }, (_, i) => {
    const d = i - 2; // offset so month starts on Wednesday
    return d < 1 || d > 30 ? null : d;
  });
  const highlighted = [7, 8, 9, 14, 21, 22, 28, 29];

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--fs-tiny)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>June 2026</span>
        <span style={{ fontSize: 'var(--fs-tiny)', color: 'var(--brand-400)', fontFamily: 'var(--font-mono)' }}>3 upcoming</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {days.map(d => (
          <div key={d} style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', paddingBottom: 4, fontFamily: 'var(--font-mono)' }}>{d}</div>
        ))}
        {dates.map((d, i) => (
          <div key={i} style={{
            height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 5,
            fontSize: '0.65rem',
            fontFamily: 'var(--font-mono)',
            color: d && highlighted.includes(d) ? 'white' : d ? 'var(--text-secondary)' : 'transparent',
            background: d && highlighted.includes(d) ? 'var(--brand-600)' : 'transparent',
            fontWeight: d && highlighted.includes(d) ? 600 : 400,
          }}>
            {d || ''}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[
          { name: 'FAMUN', date: 'Jun 7–9', color: 'var(--accent-400)' },
          { name: 'OxIMUN', date: 'Jun 21–22', color: 'var(--brand-400)' },
        ].map(conf => (
          <div key={conf.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-tiny)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: conf.color, flexShrink: 0, display: 'block' }} aria-hidden="true" />
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{conf.name}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{conf.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Card 5 visual: position paper markdown preview ──────────────────────── */
function PaperPreview() {
  return (
    <div style={{
      flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.73rem',
      color: 'var(--text-secondary)', lineHeight: 1.65,
    }}>
      <p style={{ color: 'var(--accent-400)', fontWeight: 600, margin: '0 0 8px' }}>
        # Position Paper: Brazil
      </p>
      <p style={{ color: 'var(--text-muted)', margin: '0 0 4px', fontSize: '0.68rem' }}>
        Committee: Human Rights Council
      </p>
      <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>
        Brazil reaffirms its commitment to multilateralism and the indivisibility of human rights...
      </p>
      <p style={{ margin: '10px 0 0', color: 'var(--text-secondary)' }}>
        **Key positions:** Universal Periodic Review, right to development, south-south cooperation frameworks...
      </p>
      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['Draft', 'Cite-checked', 'Export ready'].map(tag => (
          <span key={tag} style={{
            fontSize: '0.62rem', fontFamily: 'var(--font-mono)',
            color: 'var(--brand-400)', background: 'color-mix(in hsl, var(--brand-500) 10%, transparent)',
            border: '1px solid color-mix(in hsl, var(--brand-500) 25%, transparent)',
            borderRadius: 4, padding: '2px 7px',
          }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Card 6 visual: export destinations ──────────────────────────────────── */
function ExportDestinations() {
  const targets = [
    { name: 'Discord', color: '#5865F2' },
    { name: 'Notion', color: 'var(--text-primary)' },
    { name: 'Google Docs', color: '#34A853' },
    { name: 'PDF', color: 'var(--accent-400)' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {targets.map(t => (
        <span key={t.name} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 'var(--fs-small)', fontWeight: 500,
          color: 'var(--text-secondary)',
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-badge)',
          padding: '6px 14px',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color, flexShrink: 0, display: 'block' }} aria-hidden="true" />
          {t.name}
        </span>
      ))}
      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>→ one click</span>
    </div>
  );
}

/* ─── Stagger container ────────────────────────────────────────────────────── */
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: prefersReduced ? 0 : 0.04, delayChildren: prefersReduced ? 0 : 0.05 } },
};
const cardAnim = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: prefersReduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/* ─── Main component ───────────────────────────────────────────────────────── */
export default function BentoGrid() {
  const { content } = useLang();
  const { features } = content;
  const [motion1, motion2, motion3, motion4, motion5, motion6] = features.cards; // eslint-disable-line no-unused-vars

  const hoverBorder = {
    onMouseEnter: (e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; },
    onMouseLeave: (e) => { e.currentTarget.style.borderColor = 'var(--border)'; },
  };

  return (
    <section
      id="features"
      aria-labelledby="features-headline"
      style={{ padding: 'clamp(64px, 10vw, 112px) var(--container-pad)', borderBottom: '1px solid var(--border)' }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto' }}>

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: prefersReduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: 'clamp(32px, 5vw, 52px)' }}
        >
          <span style={{
            display: 'inline-block',
            fontSize: 'var(--fs-tiny)', fontWeight: 500,
            color: 'var(--text-muted)', letterSpacing: '0.07em',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            {features.eyebrow}
          </span>
          <h2
            id="features-headline"
            style={{
              fontSize: 'var(--fs-h2)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700, letterSpacing: '-0.022em', lineHeight: 1.15,
              color: 'var(--text-primary)', margin: 0,
            }}
          >
            {features.headline}{' '}
            <em style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400 }}>
              {features.headlineItalic}
            </em>
          </h2>
        </motion.div>

        {/* Bento grid */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12"
          style={{ gap: 16 }}
        >

          {/* ── Card 1: Motion Generator (large) ── */}
          <motion.div
            variants={cardAnim}
            className="card-spotlight md:col-span-2 lg:col-start-1 lg:col-span-8 lg:row-start-1 lg:row-span-2"
            onMouseMove={onCardMouseMove}
            {...hoverBorder}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: 'clamp(20px, 2.5vw, 28px)',
              display: 'flex', flexDirection: 'column', gap: 14,
              overflow: 'hidden', transition: 'border-color 250ms',
              minHeight: 280,
            }}
          >
            <CardLabel label={motion1.label} />
            <CardHeadline>{motion1.headline}</CardHeadline>
            <MotionPreview />
            <CardDetail>{motion1.detail}</CardDetail>
          </motion.div>

          {/* ── Card 2: Debate Simulator ── */}
          <motion.div
            variants={cardAnim}
            className="card-spotlight lg:col-start-9 lg:col-span-4 lg:row-start-1"
            onMouseMove={onCardMouseMove}
            {...hoverBorder}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: 'clamp(20px, 2.5vw, 28px)',
              display: 'flex', flexDirection: 'column', gap: 14,
              overflow: 'hidden', transition: 'border-color 250ms',
            }}
          >
            <CardLabel label={motion2.label} />
            <CardHeadline>{motion2.headline}</CardHeadline>
            <DebateBubbles />
            <CardDetail>{motion2.detail}</CardDetail>
          </motion.div>

          {/* ── Card 3: Country Research ── */}
          <motion.div
            variants={cardAnim}
            className="card-spotlight lg:col-start-9 lg:col-span-4 lg:row-start-2"
            onMouseMove={onCardMouseMove}
            {...hoverBorder}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: 'clamp(20px, 2.5vw, 28px)',
              display: 'flex', flexDirection: 'column', gap: 14,
              overflow: 'hidden', transition: 'border-color 250ms',
            }}
          >
            <CardLabel label={motion3.label} />
            <CardHeadline>{motion3.headline}</CardHeadline>
            <ResearchBrief />
            <CardDetail>{motion3.detail}</CardDetail>
          </motion.div>

          {/* ── Card 4: Conference Calendar ── */}
          <motion.div
            variants={cardAnim}
            className="card-spotlight lg:col-start-1 lg:col-span-6 lg:row-start-3"
            onMouseMove={onCardMouseMove}
            {...hoverBorder}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: 'clamp(20px, 2.5vw, 28px)',
              display: 'flex', flexDirection: 'column', gap: 14,
              overflow: 'hidden', transition: 'border-color 250ms',
            }}
          >
            <CardLabel label={motion4.label} />
            <CardHeadline>{motion4.headline}</CardHeadline>
            <CalendarPreview />
            <CardDetail>{motion4.detail}</CardDetail>
          </motion.div>

          {/* ── Card 5: Position Papers ── */}
          <motion.div
            variants={cardAnim}
            className="card-spotlight lg:col-start-7 lg:col-span-6 lg:row-start-3"
            onMouseMove={onCardMouseMove}
            {...hoverBorder}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: 'clamp(20px, 2.5vw, 28px)',
              display: 'flex', flexDirection: 'column', gap: 14,
              overflow: 'hidden', transition: 'border-color 250ms',
            }}
          >
            <CardLabel label={motion5.label} />
            <CardHeadline>{motion5.headline}</CardHeadline>
            <PaperPreview />
            <CardDetail>{motion5.detail}</CardDetail>
          </motion.div>

          {/* ── Card 6: One-tap export (full width) ── */}
          <motion.div
            variants={cardAnim}
            className="card-spotlight md:col-span-2 lg:col-start-1 lg:col-span-12 lg:row-start-4"
            onMouseMove={onCardMouseMove}
            {...hoverBorder}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-card)',
              padding: 'clamp(20px, 2.5vw, 28px)',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
              overflow: 'hidden', transition: 'border-color 250ms',
            }}
          >
            <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CardLabel label={motion6.label} />
              <CardHeadline>{motion6.headline}</CardHeadline>
              <CardDetail>{motion6.detail}</CardDetail>
            </div>
            <div style={{ flex: '2 1 360px' }}>
              <ExportDestinations />
            </div>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}
