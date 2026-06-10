import { Link, useParams } from "react-router-dom";
import { getConference, computeProgress } from "../../data/mockConference";
import PageShell from "./PageShell";

/** Tela 1 — Página da simulação: cabeçalho + grid de comitês. */
export default function ConferencePage() {
  const { conferenceId } = useParams();
  const conference = getConference(conferenceId);

  if (!conference) {
    return (
      <PageShell>
        <p style={{ color: "var(--text-secondary)" }}>
          Simulação não encontrada.{" "}
          <Link to="/" style={{ color: "var(--brand-400)" }}>
            Voltar ao início
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Cabeçalho */}
      <header className="anim-fade-up">
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-tiny)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--accent-400)",
            margin: 0,
          }}
        >
          MUNConnect · Simulação
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-h1)",
            fontWeight: 400,
            lineHeight: 1.05,
            margin: "12px 0 0",
          }}
        >
          {conference.nome}
        </h1>
        <p
          style={{
            fontSize: "var(--fs-lead)",
            color: "var(--text-secondary)",
            maxWidth: "52ch",
            margin: "16px 0 0",
          }}
        >
          {conference.committees.length} comitês em sessão. Selecione um comitê
          para acompanhar a agenda e os documentos de trabalho.
        </p>

        {/* Hairline com losango dourado */}
        <div className="mt-10 flex items-center gap-3" aria-hidden>
          <span
            className="flex-1"
            style={{ height: 1, background: "var(--border-strong)" }}
          />
          <span
            style={{
              width: 7,
              height: 7,
              background: "var(--accent-400)",
              transform: "rotate(45deg)",
            }}
          />
          <span
            className="flex-1"
            style={{ height: 1, background: "var(--border-strong)" }}
          />
        </div>
      </header>

      {/* Grid de comitês */}
      <section
        aria-label="Comitês"
        className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {conference.committees.map((committee, i) => (
          <CommitteeCard
            key={committee.id}
            conferenceId={conference.id}
            committee={committee}
            index={i}
          />
        ))}
      </section>
    </PageShell>
  );
}

function CommitteeCard({ conferenceId, committee, index }) {
  const { ratio } = computeProgress(committee);

  return (
    <Link
      to={`/conference/${conferenceId}/committee/${committee.id}`}
      className="card-glow anim-fade-up group flex flex-col"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--ring-soft)",
        padding: "24px 24px 20px",
        textDecoration: "none",
        color: "inherit",
        animationDelay: `${0.08 + index * 0.07}s`,
      }}
    >
      <div className="flex items-baseline justify-between">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-tiny)",
            color: "var(--accent-400)",
            letterSpacing: "0.12em",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="qcard-arrow"
          aria-hidden
          style={{ color: "var(--text-muted)" }}
        >
          →
        </span>
      </div>

      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2.25rem",
          fontWeight: 400,
          lineHeight: 1,
          margin: "14px 0 0",
        }}
      >
        {committee.sigla}
      </h2>
      <p
        style={{
          fontSize: "var(--fs-small)",
          fontWeight: 600,
          color: "var(--indigo-300)",
          margin: "6px 0 0",
        }}
      >
        {committee.nomeCompleto}
      </p>
      <p
        className="flex-1"
        style={{
          fontSize: "var(--fs-small)",
          lineHeight: 1.55,
          color: "var(--text-secondary)",
          margin: "12px 0 18px",
        }}
      >
        {committee.descricao}
      </p>

      {/* Mini-progresso no rodapé do card */}
      <div className="flex items-center gap-3">
        <span
          className="flex-1 overflow-hidden"
          style={{
            height: 4,
            borderRadius: 999,
            background: "var(--bg-overlay)",
          }}
        >
          <span
            className="block h-full"
            style={{
              width: `${ratio * 100}%`,
              borderRadius: 999,
              background:
                "linear-gradient(90deg, var(--indigo-500), var(--accent-400))",
            }}
          />
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-tiny)",
            color: "var(--text-muted)",
          }}
        >
          {Math.round(ratio * 100)}%
        </span>
      </div>
    </Link>
  );
}
