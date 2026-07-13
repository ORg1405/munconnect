import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import {
  subscribeConferences,
  subscribeCommittees,
  createCommittee,
  updateCommittee,
  addCommitteeTopics,
  setCommitteeStatus,
  deleteCommittee,
} from "../data/firestore";
import { CommitteeCard } from "./conference/ConferenceCommittees";
import NewCommitteeModal from "./NewCommitteeModal";

// ── Guia "Comitês" do dashboard ───────────────────────────────────────────────
// Lista os comitês de todas as conferences cadastradas, cada uma numa seção
// compacta (sem o cabeçalho de marketing da rota /conference/:id). Quando não há
// nenhum comitê, mostra UM estado vazio. Admin ganha criar / editar / arquivar.
export default function Committees() {
  const { user, isAdmin } = useAuth();
  const [conferences, setConferences] = useState(undefined);
  const [committeesByConf, setCommitteesByConf] = useState({}); // { confId: committee[] }
  const [modal, setModal] = useState(null); // null | { mode, initial? }
  const [toast, setToast] = useState("");

  useEffect(() => subscribeConferences(setConferences), []);

  // Uma subscription de committees por conference. Re-assina quando o conjunto
  // de conferences muda (chave estável = ids concatenados).
  const confIdsKey = (conferences ?? []).map((c) => c.id).join(",");
  useEffect(() => {
    if (!conferences?.length) {
      setCommitteesByConf({});
      return;
    }
    const unsubs = conferences.map((c) =>
      subscribeCommittees(c.id, (list) =>
        setCommitteesByConf((prev) => ({ ...prev, [c.id]: list }))
      )
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confIdsKey]);

  const totalCommittees = useMemo(
    () => Object.values(committeesByConf).reduce((n, list) => n + list.length, 0),
    [committeesByConf]
  );

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  async function handleSave({ conferenceId, committeeId, data, newTopics }) {
    if (committeeId) {
      await updateCommittee(conferenceId, committeeId, data, user?.uid);
      if (newTopics.length) await addCommitteeTopics(conferenceId, committeeId, newTopics);
      showToast("Comitê atualizado.");
    } else {
      await createCommittee(conferenceId, data, newTopics, user?.uid);
      showToast("Comitê criado.");
    }
    setModal(null);
  }

  async function handleArchive(committee) {
    const archiving = committee.status !== "archived";
    const verb = archiving ? "Arquivar" : "Desarquivar";
    if (!window.confirm(`${verb} o comitê "${committee.sigla || committee.titulo}"?`)) return;
    try {
      await setCommitteeStatus(
        committee.__conferenceId,
        committee.id,
        archiving ? "archived" : "draft",
        user?.uid
      );
      showToast(archiving ? "Comitê arquivado." : "Comitê desarquivado.");
    } catch (err) {
      showToast(`Falha: ${err?.code || err?.message || err}`);
    }
  }

  async function handleDelete(committee) {
    const nome = committee.sigla || committee.titulo || "este comitê";
    if (
      !window.confirm(
        `Excluir "${nome}" permanentemente?\n\nIsto apaga em cascata todos os tópicos, subitens, documentos e membros do comitê. Não dá pra desfazer.`
      )
    )
      return;
    try {
      await deleteCommittee(committee.__conferenceId, committee.id);
      showToast("Comitê excluído.");
    } catch (err) {
      showToast(`Falha ao excluir: ${err?.code || err?.message || err}`);
    }
  }

  // Só consideramos carregado quando cada conference já reportou seus comitês
  // (onSnapshot emite mesmo para lista vazia) — evita piscar o estado vazio.
  const loading =
    conferences === undefined ||
    (conferences.length > 0 &&
      Object.keys(committeesByConf).length < conferences.length);
  const conferencesWithCommittees = (conferences ?? []).filter(
    (c) => (committeesByConf[c.id] ?? []).length > 0
  );

  return (
    <div
      style={{
        minHeight: "100%",
        background:
          "linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
        padding: "clamp(16px, 3vw, 36px)",
        color: "var(--text-primary)",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* Cabeçalho da aba + ação de admin */}
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 27, fontWeight: 600, letterSpacing: ".2px" }}>
              Comitês
            </h1>
            <p style={{ margin: "7px 0 0", fontSize: 14.5, color: "var(--text-muted)", maxWidth: 520 }}>
              Simulações e seus comitês em sessão. Selecione um comitê para acompanhar a
              agenda e os documentos de trabalho.
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setModal({ mode: "create" })} style={primaryBtn}>
              <span style={{ width: 16, height: 16, display: "flex" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              Nova Simulação
            </button>
          )}
        </header>

        {loading && <p style={{ color: "var(--text-muted)", marginTop: 24 }}>Carregando…</p>}

        {/* Estado vazio único (nenhum comitê em nenhuma conference) */}
        {!loading && totalCommittees === 0 && (
          <EmptyState isAdmin={isAdmin} onCreate={() => setModal({ mode: "create" })} />
        )}

        {/* Seções por conference (só as que têm comitês) */}
        {!loading &&
          conferencesWithCommittees.map((conference, i) => {
            const committees = committeesByConf[conference.id] ?? [];
            return (
              <section
                key={conference.id}
                style={{ marginTop: i === 0 ? 32 : "clamp(40px, 6vw, 64px)" }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.75rem",
                    fontWeight: 400,
                    margin: 0,
                  }}
                >
                  {conference.nome ?? conference.name ?? conference.id}
                </h2>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {committees.map((committee, idx) => (
                    <CommitteeCard
                      key={committee.id}
                      conferenceId={conference.id}
                      committee={committee}
                      index={idx}
                      onEdit={
                        isAdmin
                          ? (c) => setModal({ mode: "edit", initial: { ...c, __conferenceId: conference.id } })
                          : undefined
                      }
                      onArchive={
                        isAdmin
                          ? (c) => handleArchive({ ...c, __conferenceId: conference.id })
                          : undefined
                      }
                      onDelete={
                        isAdmin
                          ? (c) => handleDelete({ ...c, __conferenceId: conference.id })
                          : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
      </div>

      {modal && (
        <NewCommitteeModal
          conferences={conferences ?? []}
          initial={modal.mode === "edit" ? modal.initial : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

function EmptyState({ isAdmin, onCreate }) {
  return (
    <div
      style={{
        marginTop: 32,
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-overlay)",
        padding: "44px 28px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 34 }} aria-hidden>
        🏛️
      </div>
      <h2 style={{ margin: "12px 0 0", fontSize: 18, fontWeight: 600 }}>
        Nenhum comitê em sessão ainda
      </h2>
      <p style={{ margin: "8px auto 0", fontSize: 14, color: "var(--text-muted)", maxWidth: 420 }}>
        {isAdmin
          ? "Crie a primeira simulação para começar a montar a agenda e os documentos de trabalho."
          : "Assim que um comitê for aberto, ele aparece aqui."}
      </p>
      {isAdmin && (
        <button onClick={onCreate} style={{ ...primaryBtn, margin: "20px auto 0" }}>
          <span style={{ width: 16, height: 16, display: "flex" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          Nova Simulação
        </button>
      )}
    </div>
  );
}

function Toast({ message }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 200,
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-card)",
        boxShadow: "0 16px 40px hsl(210 42% 2% / 0.55)",
        padding: "12px 16px",
        fontSize: 13,
        color: "var(--text-primary)",
        maxWidth: 320,
      }}
    >
      {message}
    </div>
  );
}

const primaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 600,
  borderRadius: "var(--radius-btn)",
  padding: "0 18px",
  height: 42,
  cursor: "pointer",
  border: "none",
  whiteSpace: "nowrap",
  background: "var(--brand-500)",
  color: "var(--text-primary)",
  boxShadow: "0 6px 20px -8px hsl(205 72% 42% / 0.7)",
};
