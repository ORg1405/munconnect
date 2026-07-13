import { useEffect, useState } from "react";

/**
 * Barra de progresso do comitê.
 * ratio ∈ [0, 1] — já calculado por computeProgress (complete=1, needs_revision=0.5).
 */
export default function ProgressBar({ ratio, counts, total, legend }) {
  // Anima o preenchimento de 0 → ratio na montagem
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pct = Math.round(ratio * 100);

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--ring-soft)",
        padding: "20px 24px",
      }}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-tiny)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent-400)",
              margin: 0,
            }}
          >
            Progresso da agenda
          </p>
          <p
            style={{
              fontSize: "var(--fs-small)",
              color: "var(--text-muted)",
              margin: "4px 0 0",
            }}
          >
            {counts.complete} completo{counts.complete === 1 ? "" : "s"} ·{" "}
            {counts.needs_revision} em revisão · {counts.incomplete} incompleto
            {counts.incomplete === 1 ? "" : "s"} — {total} subitens
          </p>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "1.75rem",
            fontWeight: 500,
            lineHeight: 1,
            color: "var(--text-primary)",
          }}
        >
          {pct}
          <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}>%</span>
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da agenda do comitê"
        className="mt-4 overflow-hidden"
        style={{
          height: 10,
          borderRadius: 999,
          background: "var(--bg-overlay)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: filled ? `${ratio * 100}%` : 0,
            borderRadius: 999,
            background:
              "linear-gradient(90deg, var(--indigo-500), var(--indigo-400) 60%, var(--accent-400))",
            boxShadow: "0 0 16px hsl(252 80% 70% / 0.35)",
            transition: "width 0.9s var(--ease-out-expo)",
          }}
        />
      </div>

      {/* Legenda dos status — vive aqui, no card de progresso, onde os chips
          fazem sentido conceitualmente (e não colada no primeiro tópico). */}
      {legend && (
        <div
          className="mt-5 pt-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-tiny)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              margin: "0 0 10px",
            }}
          >
            Legenda
          </p>
          {legend}
        </div>
      )}
    </div>
  );
}
