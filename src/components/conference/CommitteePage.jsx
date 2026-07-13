import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { STATUS, computeProgress } from "../../data/conferenceModel";
import {
  subscribeConference,
  subscribeCommittee,
  subscribeTopics,
  subscribeTopicSubitems,
  subscribeDocuments,
  subscribeMemberRole,
  setSubitemStatus,
  addCommitteeDocument,
} from "../../data/firestore";
import PageShell from "./PageShell";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";
import CredenciamentoPanel from "./CredenciamentoPanel";

/** Tela 2 — Página do comitê: progresso, agenda com status e working papers. */
export default function CommitteePage() {
  const { conferenceId, committeeId } = useParams();
  const { user } = useAuth();

  const [conference, setConference] = useState(undefined);
  const [committee, setCommittee] = useState(undefined);
  const [topics, setTopics] = useState([]);
  // subitems agrupados por tópico: { [topicId]: subitem[] }. Uma subscription por
  // tópico (subcollection direta) — não depende de índice de collection group.
  const [subitemsByTopic, setSubitemsByTopic] = useState({});
  const [documents, setDocuments] = useState([]);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const unsubs = [
      subscribeConference(conferenceId, setConference),
      subscribeCommittee(conferenceId, committeeId, setCommittee),
      subscribeTopics(conferenceId, committeeId, setTopics),
      subscribeDocuments(conferenceId, committeeId, setDocuments),
      subscribeMemberRole(conferenceId, committeeId, user?.uid, setRole),
    ];
    return () => unsubs.forEach((u) => u());
  }, [conferenceId, committeeId, user?.uid]);

  // Assina os subitems de cada tópico. Re-subscreve quando o conjunto de tópicos
  // muda (chave estável = ids concatenados).
  const topicIdsKey = topics.map((t) => t.id).join(",");
  useEffect(() => {
    if (!topics.length) {
      setSubitemsByTopic({});
      return;
    }
    const unsubs = topics.map((t) =>
      subscribeTopicSubitems(conferenceId, committeeId, t.id, (items) =>
        setSubitemsByTopic((prev) => ({ ...prev, [t.id]: items }))
      )
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferenceId, committeeId, topicIdsKey]);

  const isDirector = role === "director";
  // Working papers e documento final: enviados por membros credenciados do comitê
  // (diretor ou delegado). Usuário sem papel no comitê (role null) não envia.
  const canSubmit = role !== null;

  // Lista plana de todos os subitems → alimenta a barra de progresso ponderada.
  const allSubitems = useMemo(
    () => Object.values(subitemsByTopic).flat(),
    [subitemsByTopic]
  );
  const progress = useMemo(() => computeProgress(allSubitems), [allSubitems]);

  // Mapa subitemId → topicId, para migrar documentos legados (que ainda tenham
  // subitemId em vez de topicId) para o tópico correto sem perdê-los.
  const subitemToTopic = useMemo(() => {
    const m = new Map();
    for (const s of allSubitems) m.set(s.id, s.topicId);
    return m;
  }, [allSubitems]);

  // Documentos do comitê separados em: final (tipo "final") e working papers por
  // tópico. topicId efetivo = doc.topicId ?? tópico do subitem legado.
  const { docsByTopic, finalDocs } = useMemo(() => {
    const byTopic = new Map();
    const finals = [];
    for (const d of documents) {
      if (d.tipo === "final") {
        finals.push(d);
        continue;
      }
      const tid = d.topicId ?? subitemToTopic.get(d.subitemId);
      if (!tid) continue; // documento órfão (sem tópico resolvível) → ignora
      if (!byTopic.has(tid)) byTopic.set(tid, []);
      byTopic.get(tid).push(d);
    }
    const recentFirst = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);
    for (const list of byTopic.values()) list.sort(recentFirst);
    finals.sort(recentFirst);
    return { docsByTopic: byTopic, finalDocs: finals };
  }, [documents, subitemToTopic]);

  if (conference === undefined || committee === undefined) {
    return (
      <PageShell>
        <p style={{ color: "var(--text-muted)" }}>Carregando…</p>
      </PageShell>
    );
  }

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

  return (
    <PageShell>
      {/* Voltar — sempre para a aba de Comitês da sidebar (independente da
          conferência/comitê atual). */}
      <nav className="anim-fade-up">
        <Link
          to="/app/comites"
          className="inline-flex items-center gap-2"
          style={{
            fontSize: "var(--fs-small)",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textDecoration: "none",
          }}
        >
          <span aria-hidden>←</span> Comitês
        </Link>
      </nav>

      {/* Cabeçalho do comitê */}
      <header className="anim-fade-up mt-8" style={{ animationDelay: "0.05s" }}>
        <div className="flex flex-wrap items-center gap-3">
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
          {role && <RoleBadge role={role} />}
        </div>
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

      {/* 1 — Progresso (com a legenda dos status dentro do card) */}
      <div className="anim-fade-up mt-8" style={{ animationDelay: "0.1s" }}>
        <ProgressBar
          ratio={progress.ratio}
          counts={progress.counts}
          total={progress.total}
          legend={<Legend />}
        />
      </div>

      {/* 2 — Agenda (subitens + working papers por tópico) */}
      <section
        aria-label="Agenda"
        className="anim-fade-up mt-12"
        style={{ animationDelay: "0.15s" }}
      >
        <SectionHeading>Agenda</SectionHeading>

        <div className="mt-6 flex flex-col gap-12">
          {topics.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>
              Nenhum tópico cadastrado ainda.
            </p>
          )}
          {topics.map((topic) => {
            const subitems = subitemsByTopic[topic.id] ?? [];
            return (
              <article key={topic.id}>
                {/* Título do tópico + chip de status inline (default incomplete),
                    mesmo padrão dos subitens abaixo. */}
                <div className="flex flex-wrap items-center gap-3">
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
                  <StatusBadge status={topic.status ?? "incomplete"} />
                </div>
                <ul className="mt-4 flex list-none flex-col gap-2 p-0 m-0">
                  {subitems.length === 0 && (
                    <li style={{ color: "var(--text-muted)", fontSize: "var(--fs-small)" }}>
                      Sem subitens cadastrados.
                    </li>
                  )}
                  {subitems.map((subitem) => (
                    <SubitemRow
                      key={subitem.id}
                      conferenceId={conferenceId}
                      committeeId={committeeId}
                      subitem={subitem}
                      isDirector={isDirector}
                    />
                  ))}
                </ul>

                {/* Working papers do TÓPICO (um upload por tópico) */}
                <TopicWorkingPapers
                  conferenceId={conferenceId}
                  committeeId={committeeId}
                  topic={topic}
                  documents={docsByTopic.get(topic.id) ?? []}
                  canSubmit={canSubmit}
                  user={user}
                />
              </article>
            );
          })}
        </div>
      </section>

      {/* 3 — Documento de Trabalho Final (comitê inteiro) */}
      <section
        aria-label="Documento de Trabalho Final"
        className="anim-fade-up mt-12"
        style={{ animationDelay: "0.2s" }}
      >
        <SectionHeading>Documento de Trabalho Final</SectionHeading>
        <FinalDocumentCard
          conferenceId={conferenceId}
          committeeId={committeeId}
          documents={finalDocs}
          canSubmit={canSubmit}
          user={user}
        />
      </section>

      {/* 4 — Credenciamento por crachá + presença (somente diretor) */}
      {isDirector && (
        <CredenciamentoPanel
          conferenceId={conferenceId}
          committeeId={committeeId}
        />
      )}
    </PageShell>
  );
}

/* ── Linha de subitem: numeração, título e status ─────────────────────────── */

function SubitemRow({ conferenceId, committeeId, subitem, isDirector }) {
  // Terceiro nível (ex.: 2.2.1) traz parentSubitemId → recuo à esquerda.
  const nested = Boolean(subitem.parentSubitemId);

  return (
    <li
      className="flex items-center gap-4"
      style={{
        paddingLeft: nested ? 28 : 0,
        padding: "10px 4px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-small)",
          color: nested ? "var(--indigo-300)" : "var(--text-secondary)",
          minWidth: 44,
          paddingLeft: nested ? 24 : 0,
        }}
      >
        {subitem.label}
      </span>
      <span style={{ color: "var(--text-primary)" }}>
        {subitem.titulo ?? `Subitem ${subitem.label}`}
      </span>
      {/* Leader pontilhado até o controle/selo */}
      <span
        aria-hidden
        className="flex-1"
        style={{
          borderBottom: "1px dotted var(--border-strong)",
          transform: "translateY(4px)",
        }}
      />
      {isDirector ? (
        <SubitemStatusControl
          status={subitem.status}
          onChange={(next) =>
            setSubitemStatus(
              conferenceId,
              committeeId,
              subitem.topicId,
              subitem.id,
              next
            )
          }
        />
      ) : (
        <StatusBadge status={subitem.status} />
      )}
    </li>
  );
}

/* ── Working papers de um tópico: lista + upload ──────────────────────────── */

function TopicWorkingPapers({
  conferenceId,
  committeeId,
  topic,
  documents,
  canSubmit,
  user,
}) {
  const hasDocs = documents.length > 0;
  if (!hasDocs && !canSubmit) return null;

  return (
    <div className="mt-4" style={{ paddingLeft: 44 }}>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-tiny)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          margin: "0 0 8px",
        }}
      >
        Working papers
      </p>
      {hasDocs ? (
        <DocumentList documents={documents} />
      ) : (
        <p style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)", margin: "0 0 8px" }}>
          Nenhum working paper enviado para este tópico.
        </p>
      )}
      {canSubmit && (
        <DocumentUploader
          conferenceId={conferenceId}
          committeeId={committeeId}
          extraFields={{ topicId: topic.id, tipo: "working" }}
          user={user}
          buttonLabel="+ Adicionar working paper"
        />
      )}
    </div>
  );
}

/* ── Documento de Trabalho Final: card destacado (accent dourado) ─────────── */

function FinalDocumentCard({ conferenceId, committeeId, documents, canSubmit, user }) {
  const hasDocs = documents.length > 0;

  return (
    <div
      className="mt-5"
      style={{
        background:
          "linear-gradient(180deg, hsl(38 95% 60% / 0.08), var(--bg-elevated))",
        border: "1px solid var(--accent-400)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--ring-soft)",
        padding: "22px 24px",
      }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden style={{ color: "var(--accent-400)", fontSize: 18 }}>
          ★
        </span>
        <p
          style={{
            fontWeight: 700,
            fontSize: "var(--fs-small)",
            color: "var(--accent-400)",
            margin: 0,
          }}
        >
          Documento definitivo do comitê
        </p>
      </div>
      <p
        style={{
          fontSize: "var(--fs-tiny)",
          color: "var(--text-muted)",
          margin: "4px 0 16px",
        }}
      >
        Um único documento consolidado, não vinculado a nenhum tópico específico.
      </p>

      {hasDocs ? (
        <DocumentList documents={documents} />
      ) : (
        <p style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)", margin: "0 0 12px" }}>
          Nenhum documento final enviado ainda.
        </p>
      )}

      {canSubmit && (
        <DocumentUploader
          conferenceId={conferenceId}
          committeeId={committeeId}
          extraFields={{ tipo: "final" }}
          user={user}
          buttonLabel="+ Adicionar documento final"
        />
      )}
    </div>
  );
}

/* ── Lista de documentos (autor + data + link) ────────────────────────────── */

function DocumentList({ documents }) {
  return (
    <ul className="flex list-none flex-col gap-2 p-0 m-0" style={{ marginBottom: 10 }}>
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            padding: "8px 12px",
          }}
        >
          <DocIcon />
          <a
            href={doc.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontWeight: 600,
              fontSize: "var(--fs-small)",
              color: doc.url ? "var(--indigo-300)" : "var(--text-primary)",
              textDecoration: "none",
            }}
          >
            {doc.titulo || "Ver documento"}
          </a>
          <span style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}>
            {doc.autor}
            {doc.createdAt && ` · ${formatDate(doc.createdAt)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ── Adicionar documento por link (URL colada) + registro em documents ────── */

// URL válida = começa com http:// ou https:// (aceita qualquer host).
function isValidUrl(value) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function DocumentUploader({
  conferenceId,
  committeeId,
  extraFields,
  user,
  buttonLabel,
}) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const link = url.trim();
    if (!isValidUrl(link)) {
      setError("Cole um link válido começando com http:// ou https://");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addCommitteeDocument(conferenceId, committeeId, {
        titulo: titulo.trim(),
        url: link, // exatamente o link colado — salvo direto no Firestore
        autor: user?.displayName || user?.email || "Delegado",
        autorUid: user?.uid ?? null,
        ...extraFields,
      });
      setTitulo("");
      setUrl("");
      setOpen(false);
    } catch (err) {
      setError(`Falha ao salvar: ${err?.code || err?.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={ghostButtonStyle}>
        {buttonLabel}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--bg-overlay)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        padding: "10px 12px",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título (opcional)"
          style={inputStyle}
        />
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError("");
          }}
          placeholder="Cole o link do Google Drive/Docs aqui"
          style={{ ...inputStyle, minWidth: 240, flex: 1 }}
        />
        <button
          type="submit"
          disabled={!url.trim() || busy}
          style={{
            ...primaryButtonStyle,
            opacity: !url.trim() || busy ? 0.5 : 1,
            cursor: !url.trim() || busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Adicionando…" : "Adicionar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
            setUrl("");
          }}
          style={ghostButtonStyle}
        >
          Cancelar
        </button>
      </div>
      {/* Ajuda: o app não verifica acesso — o link precisa ser público. */}
      <p
        style={{
          fontSize: "var(--fs-tiny)",
          color: "var(--text-muted)",
          margin: "8px 0 0",
        }}
      >
        O link precisa estar com permissão de visualização pública ou "qualquer
        pessoa com o link" — o app não verifica o acesso.
      </p>
      {error && (
        <p
          style={{
            fontSize: "var(--fs-tiny)",
            color: "var(--warning)",
            margin: "6px 0 0",
          }}
        >
          {error}
        </p>
      )}
    </form>
  );
}

/* ── Auxiliares ─────────────────────────────────────────────────────────── */

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

function formatDate(ts) {
  const d =
    typeof ts?.toDate === "function"
      ? ts.toDate()
      : typeof ts?.seconds === "number"
      ? new Date(ts.seconds * 1000)
      : null;
  if (!d) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const ghostButtonStyle = {
  fontSize: "var(--fs-tiny)",
  fontWeight: 600,
  color: "var(--text-secondary)",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-badge)",
  padding: "5px 10px",
  cursor: "pointer",
};

const primaryButtonStyle = {
  fontSize: "var(--fs-tiny)",
  fontWeight: 700,
  color: "var(--bg-base)",
  background: "linear-gradient(90deg, var(--indigo-500), var(--accent-400))",
  border: "none",
  borderRadius: "var(--radius-badge)",
  padding: "6px 14px",
};

const inputStyle = {
  fontSize: "var(--fs-tiny)",
  color: "var(--text-primary)",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-badge)",
  padding: "6px 10px",
  minWidth: 160,
};

// Controle de status (somente diretor): três opções, destaca a ativa.
function SubitemStatusControl({ status, onChange }) {
  return (
    <div
      className="inline-flex items-center"
      role="group"
      aria-label="Alterar status do subitem"
      style={{
        gap: 4,
        background: "var(--bg-overlay)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-badge)",
        padding: 3,
      }}
    >
      {Object.keys(STATUS).map((key) => {
        const meta = STATUS[key];
        const active = key === status;
        return (
          <button
            key={key}
            type="button"
            onClick={() => !active && onChange(key)}
            title={meta.label}
            aria-pressed={active}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: active ? "default" : "pointer",
              border: `1px solid ${active ? meta.border : "transparent"}`,
              background: active ? meta.bg : "transparent",
              color: active ? meta.color : "var(--text-muted)",
              borderRadius: "var(--radius-badge)",
              padding: "3px 8px",
              fontSize: "var(--fs-tiny)",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: active ? meta.color : "var(--border-strong)",
                flexShrink: 0,
              }}
            />
            {meta.label}
            {meta.suffix && <span aria-hidden>{meta.suffix}</span>}
          </button>
        );
      })}
    </div>
  );
}

function RoleBadge({ role }) {
  const isDirector = role === "director";
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-tiny)",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: isDirector ? "var(--accent-400)" : "var(--indigo-300)",
        background: isDirector
          ? "hsl(38 95% 60% / 0.12)"
          : "hsl(255 72% 62% / 0.12)",
        border: `1px solid ${
          isDirector ? "hsl(38 95% 60% / 0.3)" : "hsl(255 72% 62% / 0.3)"
        }`,
        borderRadius: "var(--radius-badge)",
        padding: "4px 10px",
      }}
    >
      {isDirector ? "Diretor" : "Delegado"}
    </span>
  );
}

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
      width="18"
      height="18"
      aria-hidden
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}
