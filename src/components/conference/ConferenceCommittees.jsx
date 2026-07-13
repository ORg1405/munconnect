import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { computeProgress } from "../../data/conferenceModel";
import { subscribeCommitteeSubitems } from "../../data/firestore";

// Rótulos de status exibidos como selo no card. `active` não recebe selo.
const STATUS_META = {
  draft: { label: "Rascunho", color: "var(--text-muted)", bg: "var(--bg-overlay)" },
  archived: { label: "Arquivado", color: "hsl(38 60% 60%)", bg: "hsl(38 92% 55% / 0.1)" },
};

/**
 * Cabeçalho + grid de comitês de uma simulação.
 * Reutilizado pela rota /conference/:id (ConferencePage) e pela guia "Comitês"
 * do dashboard — mesma tela para onde "Ver comitês" redireciona.
 *
 * props:
 *   conference  { id, nome }
 *   committees  [{ id, sigla, nomeCompleto, descricao, ordem }]
 */
export default function ConferenceCommittees({ conference, committees = [] }) {
  return (
    <>
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
          {committees.length === 0
            ? "Nenhum comitê em sessão ainda."
            : `${committees.length} ${
                committees.length === 1 ? "comitê" : "comitês"
              } em sessão. Selecione um comitê para acompanhar a agenda e os documentos de trabalho.`}
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
        {committees.map((committee, i) => (
          <CommitteeCard
            key={committee.id}
            conferenceId={conference.id}
            committee={committee}
            index={i}
          />
        ))}
      </section>
    </>
  );
}

// `onEdit`/`onArchive` (opcionais, só admin) habilitam o menu de ações no card.
// Quando ausentes, o card é apenas um link — comportamento original preservado
// na rota /conference/:id (ConferencePage).
export function CommitteeCard({ conferenceId, committee, index, onEdit, onArchive, onDelete }) {
  const [subitems, setSubitems] = useState([]);

  useEffect(() => {
    const unsub = subscribeCommitteeSubitems(
      conferenceId,
      committee.id,
      setSubitems
    );
    return () => unsub();
  }, [conferenceId, committee.id]);

  const { ratio } = computeProgress(subitems);
  const hasMenu = Boolean(onEdit || onArchive || onDelete);
  const statusMeta = STATUS_META[committee.status];
  const archived = committee.status === "archived";

  return (
    <div className="relative" style={{ opacity: archived ? 0.62 : 1 }}>
      {hasMenu && (
        <CardMenu
          committee={committee}
          onEdit={onEdit}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      )}
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
        <div className="flex items-center justify-between gap-2">
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
          <div className="flex items-center gap-2">
            {statusMeta && (
              <span
                style={{
                  fontSize: "var(--fs-tiny)",
                  fontWeight: 600,
                  color: statusMeta.color,
                  background: statusMeta.bg,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-badge)",
                  padding: "1px 8px",
                }}
              >
                {statusMeta.label}
              </span>
            )}
            <span
              className="qcard-arrow"
              aria-hidden
              style={{ color: "var(--text-muted)", marginRight: hasMenu ? 22 : 0 }}
            >
              →
            </span>
          </div>
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
    </div>
  );
}

// Menu de ações do card (só admin): editar / arquivar / desarquivar.
// Fica sobreposto ao Link; os cliques param a propagação para não navegar.
function CardMenu({ committee, onEdit, onArchive, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const archived = committee.status === "archived";

  return (
    <div ref={ref} className="absolute" style={{ top: 18, right: 16, zIndex: 2 }}>
      <button
        type="button"
        aria-label="Ações do comitê"
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        style={{
          width: 26,
          height: 26,
          display: "grid",
          placeItems: "center",
          borderRadius: 7,
          border: "1px solid var(--border)",
          background: "var(--bg-overlay)",
          color: "var(--text-secondary)",
          cursor: "pointer",
          lineHeight: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: 30,
            right: 0,
            minWidth: 150,
            background: "var(--bg-overlay)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-card)",
            boxShadow: "0 16px 40px hsl(210 42% 2% / 0.55)",
            padding: 4,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                stop(e);
                setOpen(false);
                onEdit(committee);
              }}
              style={menuItemStyle}
            >
              Editar
            </button>
          )}
          {onArchive && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                stop(e);
                setOpen(false);
                onArchive(committee);
              }}
              style={{ ...menuItemStyle, color: archived ? "var(--brand-400)" : "hsl(38 60% 60%)" }}
            >
              {archived ? "Desarquivar" : "Arquivar"}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                stop(e);
                setOpen(false);
                onDelete(committee);
              }}
              style={{ ...menuItemStyle, color: "var(--danger, #e24b4a)" }}
            >
              Excluir comitê
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const menuItemStyle = {
  textAlign: "left",
  fontSize: "var(--fs-small)",
  color: "var(--text-secondary)",
  background: "transparent",
  border: "none",
  borderRadius: 6,
  padding: "7px 10px",
  cursor: "pointer",
  width: "100%",
};
