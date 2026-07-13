import { useState } from "react";

// Reusa os mesmos tokens visuais do AddEventModal (modal do Calendário) para
// manter o design consistente. Usado para CRIAR e para EDITAR um comitê.
//
// props:
//   conferences  [{ id, nome }]        — alimenta o select de conferência
//   initial      committee | null      — quando presente, entra em modo edição
//   defaultConferenceId  string?       — pré-seleção no modo criação
//   onSave(payload) → Promise          — payload: { conferenceId, committeeId?, data, newTopics }
//   onClose()

const TIPOS = [
  { id: "crisis", label: "Crise" },
  { id: "general_assembly", label: "Assembleia Geral" },
  { id: "specialized", label: "Especializado" },
  { id: "court", label: "Corte / Tribunal" },
  { id: "historical", label: "Histórico" },
  { id: "other", label: "Outro" },
];
const IDIOMAS = [
  { id: "pt-BR", label: "Português (PT-BR)" },
  { id: "en", label: "Inglês (EN)" },
  { id: "es", label: "Espanhol (ES)" },
];
const STATUSES = [
  { id: "draft", label: "Rascunho" },
  { id: "active", label: "Ativo" },
  { id: "archived", label: "Arquivado" },
];

export default function NewCommitteeModal({
  conferences = [],
  initial = null,
  defaultConferenceId = "",
  onSave,
  onClose,
}) {
  const isEdit = Boolean(initial);

  const [form, setForm] = useState(() => ({
    // No modo edição, `titulo` cai para nomeCompleto/sigla legados.
    titulo: initial?.titulo ?? initial?.nomeCompleto ?? initial?.sigla ?? "",
    sigla: initial?.siglaCurta ?? (initial && initial.nomeCompleto ? initial.sigla : "") ?? "",
    tipo: initial?.tipo ?? "",
    descricao: initial?.descricao ?? "",
    conferenceId: initial ? initial.__conferenceId : defaultConferenceId || (conferences[0]?.id ?? ""),
    idioma: initial?.idioma ?? "pt-BR",
    status: initial?.status ?? "draft",
    dataInicio: initial?.dataInicio ?? "",
    dataFim: initial?.dataFim ?? "",
  }));
  const [topics, setTopics] = useState([]); // tópicos NOVOS a criar (append-only)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const isValid =
    form.titulo.trim() &&
    form.tipo &&
    form.descricao.trim() &&
    form.conferenceId;

  function buildData() {
    const titulo = form.titulo.trim();
    const siglaCurta = form.sigla.trim();
    // Card mostra `sigla` grande + `nomeCompleto` como subtítulo. Se a sigla
    // curta foi informada, ela vira o rótulo grande e o título vira subtítulo;
    // senão o título assume o rótulo grande (sem subtítulo redundante).
    return {
      titulo,
      siglaCurta: siglaCurta || null,
      sigla: siglaCurta || titulo,
      nomeCompleto: siglaCurta ? titulo : "",
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      idioma: form.idioma || "pt-BR",
      status: form.status || "draft",
      dataInicio: form.dataInicio || null,
      dataFim: form.dataFim || null,
    };
  }

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true);
    setError("");
    try {
      const cleanTopics = topics
        .map((t) => ({
          titulo: t.titulo.trim(),
          subtopics: (t.subtopics ?? [])
            .map((s) => ({ titulo: s.titulo.trim() }))
            .filter((s) => s.titulo),
        }))
        .filter((t) => t.titulo);
      await onSave({
        conferenceId: form.conferenceId,
        committeeId: initial?.id,
        data: buildData(),
        newTopics: cleanTopics,
      });
    } catch (err) {
      setError(`Falha ao salvar: ${err?.code || err?.message || err}`);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" style={overlayStyle} onClick={onClose}>
      <div className="modal-content" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            margin: "0 0 16px",
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          {isEdit ? "Editar comitê" : "Nova simulação"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <p style={labelStyle}>Título / nome *</p>
            <input
              placeholder="Ex: INTERPOL, DISEC, CIJ"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <p style={labelStyle}>Sigla curta (badges/cards)</p>
            <input
              placeholder="Opcional — ex: INT"
              value={form.sigla}
              onChange={(e) => set("sigla", e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Tipo *</p>
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} style={inputStyle}>
                <option value="">Selecione…</option>
                {TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Idioma</p>
              <select value={form.idioma} onChange={(e) => set("idioma", e.target.value)} style={inputStyle}>
                {IDIOMAS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p style={labelStyle}>Descrição *</p>
            <textarea
              placeholder="1 a 3 parágrafos sobre o comitê"
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div>
            <p style={labelStyle}>Conferência *</p>
            <select
              value={form.conferenceId}
              onChange={(e) => set("conferenceId", e.target.value)}
              style={{ ...inputStyle, opacity: isEdit ? 0.6 : 1 }}
              disabled={isEdit}
            >
              <option value="">Selecione…</option>
              {conferences.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome ?? c.name ?? c.id}
                </option>
              ))}
            </select>
            {isEdit && (
              <p style={{ ...hintStyle, marginTop: 4 }}>
                A conferência não pode ser alterada na edição.
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Status</p>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} style={inputStyle}>
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Início</p>
              <input
                type="date"
                value={form.dataInicio}
                onChange={(e) => set("dataInicio", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Fim</p>
              <input
                type="date"
                value={form.dataFim}
                min={form.dataInicio || undefined}
                onChange={(e) => set("dataFim", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Tópicos iniciais / novos tópicos */}
        <div style={{ marginTop: 16 }}>
          <p style={{ ...labelStyle, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            {isEdit ? "Adicionar novos tópicos" : "Tópicos iniciais"}
          </p>
          {isEdit && (
            <p style={hintStyle}>Tópicos já existentes não são alterados aqui — só adicionados.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {topics.map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: 8,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "var(--bg-base)",
                }}
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    placeholder={`Título do tópico ${i + 1}`}
                    value={t.titulo}
                    onChange={(e) =>
                      setTopics((prev) => prev.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))
                    }
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    aria-label="Remover tópico"
                    onClick={() => setTopics((prev) => prev.filter((_, j) => j !== i))}
                    style={removeBtnStyle}
                  >
                    ×
                  </button>
                </div>

                {/* Subtópicos (só título; numeração {n}.{m} automática) */}
                {(t.subtopics ?? []).length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      marginTop: 2,
                      paddingLeft: 12,
                      borderLeft: "2px solid var(--border-strong)",
                    }}
                  >
                    {t.subtopics.map((s, m) => (
                      <div key={m} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={subNumStyle}>
                          {i + 1}.{m + 1}
                        </span>
                        <input
                          placeholder="Título do subtópico"
                          value={s.titulo}
                          onChange={(e) =>
                            setTopics((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      subtopics: x.subtopics.map((y, k) =>
                                        k === m ? { ...y, titulo: e.target.value } : y
                                      ),
                                    }
                                  : x
                              )
                            )
                          }
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                          type="button"
                          aria-label="Remover subtópico"
                          onClick={() =>
                            setTopics((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? { ...x, subtopics: x.subtopics.filter((_, k) => k !== m) }
                                  : x
                              )
                            )
                          }
                          style={removeBtnStyle}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setTopics((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, subtopics: [...(x.subtopics ?? []), { titulo: "" }] } : x
                      )
                    )
                  }
                  style={addSubBtnStyle}
                >
                  + Adicionar subtópico
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTopics((prev) => [...prev, { titulo: "", subtopics: [] }])}
            style={addTopicBtnStyle}
          >
            + Adicionar tópico
          </button>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "var(--warning, #e24b4a)", margin: "12px 0 0" }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={cancelBtnStyle}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            style={{ ...saveBtnStyle, opacity: saving || !isValid ? 0.55 : 1 }}
          >
            {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar comitê"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles (espelham AddEventModal.jsx) ───────────────────────────────────────
const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "hsl(210 42% 5% / 0.75)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
};

const modalStyle = {
  background: "var(--bg-overlay)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-dialog)",
  boxShadow: "0 24px 64px hsl(210 42% 2% / 0.6), var(--ring-soft)",
  padding: 20,
  width: 460,
  maxWidth: "94vw",
  fontFamily: "var(--font-ui)",
  maxHeight: "90dvh",
  overflowY: "auto",
};

const inputStyle = {
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid var(--border-strong)",
  borderRadius: 7,
  outline: "none",
  width: "100%",
  fontFamily: "var(--font-ui)",
  color: "var(--text-primary)",
  background: "var(--bg-base)",
  boxSizing: "border-box",
};

const labelStyle = { fontSize: 11, color: "var(--text-muted)", marginBottom: 4 };
const hintStyle = { fontSize: 11, color: "var(--text-muted)", margin: 0 };

const cancelBtnStyle = {
  flex: 1,
  padding: "8px 0",
  fontSize: 13,
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-btn)",
  background: "transparent",
  cursor: "pointer",
  color: "var(--text-secondary)",
};

const saveBtnStyle = {
  flex: 1,
  padding: "8px 0",
  fontSize: 13,
  background: "var(--brand-500)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-btn)",
  cursor: "pointer",
  fontWeight: 600,
};

const removeBtnStyle = {
  width: 28,
  height: 28,
  flexShrink: 0,
  fontSize: 18,
  lineHeight: 1,
  color: "var(--text-muted)",
  background: "transparent",
  border: "1px solid var(--border-strong)",
  borderRadius: 7,
  cursor: "pointer",
};

const addTopicBtnStyle = {
  marginTop: 8,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--brand-400)",
  background: "transparent",
  border: "1px dashed var(--border-strong)",
  borderRadius: 7,
  padding: "7px 12px",
  cursor: "pointer",
  width: "100%",
};

const addSubBtnStyle = {
  marginTop: 2,
  alignSelf: "flex-start",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--indigo-300)",
  background: "transparent",
  border: "none",
  borderRadius: 6,
  padding: "3px 4px",
  cursor: "pointer",
};

const subNumStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--indigo-300)",
  minWidth: 30,
  flexShrink: 0,
};
