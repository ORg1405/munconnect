import { useNavigate } from "react-router-dom";
import { DEFAULT_CONFERENCE_ID } from "../data/firestore";

// ── Seção da Home: simulações futuras em ordem cronológica ────────────────────
// Linha enxuta por item (nome + data) + botão "Ver comitês".
// NÃO duplica a listagem de comitês — só navega para a página da simulação.
// Convenção do protótipo (espelha EventModal.jsx): toda conferência abre a
// simulação padrão. Com o Firestore, trocar DEFAULT_CONFERENCE_ID por sim.id.

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    width="14" height="14" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function UpcomingSimulations({ simulations = [], loading = false }) {
  const navigate = useNavigate();

  return (
    <section className="card-glow" style={{
      background: "var(--bg-overlay)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "20px 22px 12px" }}>
        <p style={{
          margin: "0 0 4px", fontSize: 11.5, fontWeight: 700,
          letterSpacing: "1.3px", color: "var(--text-muted)", textTransform: "uppercase",
        }}>
          Próximas simulações
        </p>
        <h2 style={{
          margin: 0, fontFamily: "var(--font-display)", fontWeight: 400,
          fontSize: 22, color: "var(--text-primary)", letterSpacing: ".2px",
        }}>
          O que vem por aí
        </h2>
      </div>

      {loading ? (
        <div style={{ padding: "8px 22px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="skeleton" style={{ flex: 1, height: 14, width: `${50 + n * 12}%` }} />
              <div className="skeleton" style={{ height: 28, width: 110, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : simulations.length === 0 ? (
        <div style={{ padding: "8px 22px 22px", color: "var(--text-muted)", fontSize: 13.5 }}>
          Nenhuma simulação futura no momento.
        </div>
      ) : (
        <div style={{ paddingBottom: 6 }}>
          {simulations.map((sim, i) => (
            <div
              key={sim.id}
              style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "13px 22px",
                borderTop: i === 0 ? "1px solid var(--border)" : "1px solid var(--border)",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {sim.name}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                  {sim.dateLabel}
                </div>
              </div>
              <button
                onClick={() => navigate(`/conference/${DEFAULT_CONFERENCE_ID}`)}
                className="upcoming-cta"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  flexShrink: 0, whiteSpace: "nowrap",
                  fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
                  padding: "7px 14px", borderRadius: "var(--radius-btn)",
                  border: "1px solid hsl(205 68% 58% / 0.35)",
                  background: "hsl(205 68% 58% / 0.1)",
                  color: "var(--brand-400)", cursor: "pointer",
                }}
              >
                Ver comitês
                <ArrowIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
