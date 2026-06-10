import { Link, useParams } from "react-router-dom";
import {
  getConference,
  getCommittee,
  computeProgress,
  STATUS,
} from "../../data/mockConference";
import PageShell from "./PageShell";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";

/** Tela 2 — Página do comitê: progresso, agenda com status e working papers. */
export default function CommitteePage() {
  const { conferenceId, committeeId } = useParams();
  const conference = getConference(conferenceId);
  const committee = getCommittee(conferenceId, committeeId);

  if (!conference || !committee) {
    return (
      <PageShell>
        <p style={{ color: "var(--text-secondary)" }}>
          Comitê não encontrado.{" "}
          <Link to="/" style={{ color: "var(--brand-400)" }}>
            Voltar ao início
          </Link>
        </p>
      </PageShell>
    );
  }

  const progress = computeProgress(committee);
  // Índice subitemId → { label do subitem, ordem do tópico } para os documentos
  const subitemIndex = new Map(
    committee.topics.flatMap((t) =>
      t.subitems.map((s) => [s.id, { label: s.label, topicOrdem: t.ordem }])
    )
  );

  return (
    <PageShell>
      {/* Voltar */}
      <nav className="anim-fade-up">
        <Link
          to={`/conference/${conference.id}`}
          className="inline-flex items-center gap-2"
          style={{
            fontSize: "var(--fs-small)",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textDecoration: "none",
          }}
        >
          <span aria-hidden>←</span> {conference.nome}
        </Link>
      </nav>

      {/* Cabeçalho do comitê */}
      <header className="anim-fade-up mt-8" style={{ animationDelay: "0.05s" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-h1)",
            fontWeight: 400,
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          {committee.sigla}
        </h1>
        <p
          style={{
            fontSize: "var(--fs-lead)",
            color: "var(--indigo-300)",
            fontWeight: 500,
            margin: "8px 0 0",
          }}
        >
          {committee.nomeCompleto}
        </p>
      </header>

      {/* 1 — Progresso */}
      <div className="anim-fade-up mt-8" style={{ animationDelay: "0.1s" }}>
        <ProgressBar
          ratio={progress.ratio}
          counts={progress.counts}
          total={progress.total}
        />
      </div>

      {/* 2 — Agenda */}
      <section
        aria-label="Agenda"
        className="anim-fade-up mt-12"
        style={{ animationDelay: "0.15s" }}
      >
        <SectionHeading>Agenda</SectionHeading>
        <Legend />

        <div className="mt-6 flex flex-col gap-8">
          {committee.topics.map((topic) => (
            <article key={topic.id}>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--fs-h3)",
                  fontWeight: 400,
                  margin: 0,
                }}
              >
                {topic.titulo}
              </h3>
              <ul className="mt-3 flex list-none flex-col gap-1 p-0 m-0">
                {topic.subitems.map((subitem) => (
                  <li
                    key={subitem.id}
                    className="flex items-center gap-4"
                    style={{
                      padding: "10px 4px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--fs-small)",
                        color: "var(--text-secondary)",
                        minWidth: 32,
                      }}
                    >
                      {subitem.label}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>
                      Subitem {subitem.label}
                    </span>
                    {/* Leader pontilhado até o selo */}
                    <span
                      aria-hidden
                      className="flex-1"
                      style={{
                        borderBottom: "1px dotted var(--border-strong)",
                        transform: "translateY(4px)",
                      }}
                    />
                    <StatusBadge status={subitem.status} />
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* 3 — Documentos de trabalho */}
      <section
        aria-label="Documentos de trabalho"
        className="anim-fade-up mt-12"
        style={{ animationDelay: "0.2s" }}
      >
        <SectionHeading>Documentos de trabalho</SectionHeading>

        {committee.documents.length === 0 ? (
          <p style={{ color: "var(--text-muted)", marginTop: 16 }}>
            Nenhum documento de trabalho enviado ainda.
          </p>
        ) : (
          <ul className="mt-5 flex list-none flex-col gap-3 p-0 m-0">
            {committee.documents.map((doc) => {
              const ref = subitemIndex.get(doc.subitemId);
              return (
                <li
                  key={doc.id}
                  className="upcoming-row flex flex-wrap items-center gap-x-4 gap-y-2"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-card)",
                    padding: "14px 18px",
                  }}
                >
                  <DocIcon />
                  <div className="min-w-0 flex-1">
                    <p
                      style={{
                        fontWeight: 600,
                        fontSize: "var(--fs-small)",
                        margin: 0,
                      }}
                    >
                      {doc.titulo}
                    </p>
                    <p
                      style={{
                        fontSize: "var(--fs-tiny)",
                        color: "var(--text-muted)",
                        margin: "2px 0 0",
                      }}
                    >
                      {doc.autor}
                    </p>
                  </div>
                  <span
                    title={ref ? `Tópico ${ref.topicOrdem}` : undefined}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-tiny)",
                      color: "var(--indigo-300)",
                      background: "hsl(255 72% 62% / 0.12)",
                      border: "1px solid hsl(255 72% 62% / 0.3)",
                      borderRadius: "var(--radius-badge)",
                      padding: "3px 10px",
                    }}
                  >
                    Subitem {ref?.label ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

/* ── Auxiliares ─────────────────────────────────────────────────────────── */

function SectionHeading({ children }) {
  return (
    <div className="flex items-center gap-3">
      <h2
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-tiny)",
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--accent-400)",
          margin: 0,
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </h2>
      <span
        aria-hidden
        className="flex-1"
        style={{ height: 1, background: "var(--border-strong)" }}
      />
    </div>
  );
}

function Legend() {
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2"
      aria-label="Legenda de status"
    >
      {Object.keys(STATUS).map((key) => (
        <span key={key} className="flex items-center gap-2">
          <StatusBadge status={key} />
          <span
            style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}
          >
            {key === "complete" && "concluído e aprovado"}
            {key === "needs_revision" && "conta metade do progresso"}
            {key === "incomplete" && "não conta para o progresso"}
          </span>
        </span>
      ))}
    </div>
  );
}

function DocIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--indigo-400)"
      strokeWidth="1.8"
      width="20"
      height="20"
      aria-hidden
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}
