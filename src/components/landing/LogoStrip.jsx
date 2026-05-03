import { useLang } from '../../context/LangContext';

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function LogoStrip() {
  const { content } = useLang();
  const { logoStrip } = content;

  const doubled = [...logoStrip.items, ...logoStrip.items];

  return (
    <section
      aria-label={logoStrip.eyebrow}
      style={{
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '28px 0 26px',
      }}
    >
      <p style={{
        textAlign: 'center',
        fontSize: 'var(--fs-tiny)',
        color: 'var(--text-muted)',
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        fontWeight: 500,
        margin: '0 0 18px',
      }}>
        {logoStrip.eyebrow}
      </p>

      {prefersReduced ? (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '4px 0',
          padding: '0 var(--container-pad)',
        }}>
          {logoStrip.items.map((name, i) => (
            <span key={name} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <span style={{
                fontSize: 'var(--fs-small)',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                padding: '0 20px',
                whiteSpace: 'nowrap',
                opacity: 0.65,
              }}>
                {name}
              </span>
              {i < logoStrip.items.length - 1 && (
                <span style={{ color: 'var(--border-strong)', fontSize: '0.55rem', flexShrink: 0 }}>◆</span>
              )}
            </span>
          ))}
        </div>
      ) : (
        <>
          {/* Overflow clip with fade-out edges */}
          <div style={{
            overflow: 'hidden',
            maskImage: 'linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 12%, black 88%, transparent 100%)',
          }}>
            <div className="animate-marquee" aria-hidden="true">
              {doubled.map((name, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 'var(--fs-small)',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    padding: '0 20px',
                    whiteSpace: 'nowrap',
                    opacity: 0.65,
                  }}>
                    {name}
                  </span>
                  <span style={{
                    color: 'var(--border-strong)',
                    fontSize: '0.55rem',
                    flexShrink: 0,
                  }}>
                    ◆
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Accessible text fallback (visually hidden) */}
          <ul style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
            {logoStrip.items.map(name => <li key={name}>{name}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}
