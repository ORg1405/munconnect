/**
 * Moldura visual compartilhada das páginas da simulação:
 * fundo navy com aurora indigo, hairline dourada e container centralizado.
 */
export default function PageShell({ children }) {
  return (
    <div
      className="relative min-h-screen"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Aurora indigo-violeta no topo */}
      <div
        aria-hidden
        className="aurora-bg pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: 420,
          background:
            "radial-gradient(ellipse 70% 60% at 50% -10%, hsl(255 72% 62% / 0.16), transparent 70%)",
        }}
      />
      {/* Meridianos sutis (textura institucional) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(90deg, hsl(220 15% 96% / 0.015) 0 1px, transparent 1px 120px)",
        }}
      />
      {/* Filete dourado no topo */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0"
        style={{
          height: 2,
          background:
            "linear-gradient(90deg, transparent, var(--accent-400) 30%, var(--accent-400) 70%, transparent)",
          opacity: 0.7,
        }}
      />

      <main
        className="relative mx-auto"
        style={{
          maxWidth: 1040,
          padding: "clamp(40px, 7vh, 72px) var(--container-pad) 96px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
