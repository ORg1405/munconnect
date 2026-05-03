import { useLang } from '../../context/LangContext';

export default function Footer() {
  const { content } = useLang();
  const { footer } = content;

  return (
    <footer
      aria-label="Site footer"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-base)' }}
    >
      <div style={{
        maxWidth: 'var(--container-max)',
        margin: '0 auto',
        padding: 'clamp(40px, 6vw, 64px) var(--container-pad) 36px',
      }}>
        {/* Top: brand + link columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10" style={{ marginBottom: 48 }}>

          {/* Brand */}
          <div>
            <a
              href="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none', marginBottom: 12 }}
              aria-label="MUNConnect home"
            >
              <span style={{
                fontFamily: 'var(--font-ui)', fontWeight: 600,
                color: 'var(--text-primary)', fontSize: '1rem', letterSpacing: '-0.02em',
              }}>MUN</span>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--accent-400)', flexShrink: 0, margin: '0 2px',
                }}
              />
              <span style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                color: 'var(--text-primary)', fontSize: '1rem',
              }}>Connect</span>
            </a>

            <p style={{
              fontSize: 'var(--fs-small)', color: 'var(--text-muted)',
              margin: 0, lineHeight: 1.65,
            }}>
              {footer.tagline}
            </p>
          </div>

          {/* Link columns */}
          {footer.columns.map(col => (
            <div key={col.heading}>
              <h2 style={{
                fontSize: 'var(--fs-tiny)', fontWeight: 600,
                color: 'var(--text-muted)', letterSpacing: '0.08em',
                textTransform: 'uppercase', margin: '0 0 14px',
              }}>
                {col.heading}
              </h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {col.links.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      style={{
                        fontSize: 'var(--fs-small)', color: 'var(--text-muted)',
                        textDecoration: 'none', transition: 'color 200ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom: legal */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
          <p style={{
            fontSize: 'var(--fs-tiny)', color: 'var(--text-muted)',
            margin: 0, textAlign: 'center',
          }}>
            {footer.legal}
          </p>
        </div>
      </div>
    </footer>
  );
}
