// src/components/admin/Sessions.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Tela de gestão de SESSÕES (rota /app/sessoes) — só admin GLOBAL. As sessões
// valem para TODOS os comitês da conference ao mesmo tempo (mesma janela de
// horário) e são o que o endpoint /api/checkin usa para descobrir a chamada ativa
// no momento do scan. Fluxo: escolhe a conference → lista as sessões → cria/edita/
// exclui. Cada sessão: nome, dia (relativo: 1,2,3…), início, fim, ordem.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../AuthContext";
import {
  subscribeConferences,
  subscribeSessions,
  createSession,
  updateSession,
  deleteSession,
} from "../../data/firestore";

const EMPTY_FORM = { id: null, name: "", day: 1, start: "", end: "", order: 0 };

export default function Sessions() {
  const { isAdmin, user } = useAuth();

  const [conferences, setConferences] = useState(undefined);
  const [conferenceId, setConferenceId] = useState("");
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => subscribeConferences(setConferences), []);

  useEffect(() => {
    if (conferences?.length && !conferenceId) setConferenceId(conferences[0].id);
  }, [conferences, conferenceId]);

  useEffect(() => {
    if (!conferenceId) {
      setSessions([]);
      return;
    }
    return subscribeSessions(conferenceId, setSessions);
  }, [conferenceId]);

  const editing = form.id != null;

  // Ordem sugerida para uma sessão nova: quantas já existem no mesmo dia.
  const nextOrderForDay = useMemo(() => {
    const map = new Map();
    for (const s of sessions) map.set(s.day ?? 0, (map.get(s.day ?? 0) ?? 0) + 1);
    return map;
  }, [sessions]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setError("");
  }

  function startEdit(s) {
    setError("");
    setForm({
      id: s.id,
      name: s.name || "",
      day: s.day ?? 1,
      start: toLocalInput(s.startAt),
      end: toLocalInput(s.endAt),
      order: s.order ?? 0,
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    const name = form.name.trim();
    const day = Number(form.day);
    const startAt = form.start ? new Date(form.start) : null;
    const endAt = form.end ? new Date(form.end) : null;

    if (!name) return setError("Informe o nome da sessão.");
    if (!Number.isFinite(day) || day < 1) return setError("Dia deve ser um número ≥ 1.");
    if (!startAt || Number.isNaN(startAt.getTime())) return setError("Informe o horário de início.");
    if (!endAt || Number.isNaN(endAt.getTime())) return setError("Informe o horário de fim.");
    if (endAt <= startAt) return setError("O fim deve ser depois do início.");

    const data = { name, day, startAt, endAt, order: Number(form.order) || 0 };
    setBusy(true);
    try {
      if (editing) {
        await updateSession(conferenceId, form.id, data, user?.uid);
        showToast("Sessão atualizada.");
      } else {
        await createSession(conferenceId, data, user?.uid);
        showToast("Sessão criada.");
      }
      resetForm();
    } catch (err) {
      setError(`Falha ao salvar: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(s) {
    if (!window.confirm(`Excluir a sessão "${s.name || s.id}"? Isso não apaga a presença já registrada.`))
      return;
    try {
      await deleteSession(conferenceId, s.id);
      if (form.id === s.id) resetForm();
      showToast("Sessão excluída.");
    } catch (err) {
      showToast(`Falha ao excluir: ${err?.message || err}`);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  }

  if (!isAdmin) {
    return (
      <div style={container}>
        <p style={{ color: "var(--text-secondary)" }}>
          Acesso restrito. Esta tela é só para administradores globais.
        </p>
      </div>
    );
  }

  return (
    <div style={container}>
      <header>
        <h1 style={h1}>Sessões</h1>
        <p style={{ color: "var(--text-muted)", margin: "8px 0 0", fontSize: "var(--fs-small)" }}>
          Cadastre as chamadas do evento. Cada sessão vale para <strong>todos os comitês</strong> ao
          mesmo tempo — o check-in por QR usa a janela de horário para saber qual chamada está aberta.
        </p>
      </header>

      {/* Conference */}
      <div className="mt-8">
        <Label>Conferência</Label>
        <select
          value={conferenceId}
          onChange={(e) => {
            setConferenceId(e.target.value);
            resetForm();
          }}
          style={selectStyle}
        >
          {(conferences ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome || c.id}
            </option>
          ))}
        </select>
        <p style={hint}>{sessions.length} sessão(ões) cadastrada(s) nesta conferência.</p>
      </div>

      {/* Formulário (criar / editar) */}
      <form onSubmit={handleSave} style={formCard} className="mt-8">
        <p style={{ fontWeight: 700, color: "var(--text-primary)", margin: "0 0 14px" }}>
          {editing ? "Editar sessão" : "Nova sessão"}
        </p>

        <div className="flex flex-col gap-4">
          <Field label="Nome">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Sessão 1 — Dia 1 Manhã"
              style={inputStyle}
            />
          </Field>

          <div className="flex flex-wrap gap-4">
            <Field label="Dia" style={{ maxWidth: 100 }}>
              <input
                type="number"
                min={1}
                value={form.day}
                onChange={(e) => {
                  const day = e.target.value;
                  setForm((f) => ({
                    ...f,
                    day,
                    // sugere a ordem só ao criar (não sobrescreve edição existente)
                    order: f.id == null ? nextOrderForDay.get(Number(day)) ?? 0 : f.order,
                  }));
                }}
                style={inputStyle}
              />
            </Field>
            <Field label="Ordem" style={{ maxWidth: 100 }}>
              <input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4">
            <Field label="Início">
              <input
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                style={inputStyle}
              />
            </Field>
            <Field label="Fim">
              <input
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                style={inputStyle}
              />
            </Field>
          </div>
        </div>

        {error && <p style={{ ...hint, color: "var(--warning)" }}>{error}</p>}

        <div className="flex items-center gap-3 mt-6">
          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.5 : 1 }}>
            {busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar sessão"}
          </button>
          {editing && (
            <button type="button" onClick={resetForm} style={ghostBtn}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Lista de sessões */}
      <div className="mt-8">
        <Label>Sessões cadastradas</Label>
        {sessions.length === 0 ? (
          <p style={hint}>Nenhuma sessão ainda. Crie a primeira acima.</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-card)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-small)" }}>
              <thead>
                <tr>
                  {["Nome", "Dia", "Início", "Fim", "Ordem", ""].map((hd, i) => (
                    <th key={i} style={th}>
                      {hd}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={td}>{s.name || s.id}</td>
                    <td style={td}>{s.day ?? "—"}</td>
                    <td style={tdMono}>{fmt(s.startAt)}</td>
                    <td style={tdMono}>{fmt(s.endAt)}</td>
                    <td style={td}>{s.order ?? 0}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                      <button type="button" onClick={() => startEdit(s)} style={linkBtn}>
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        style={{ ...linkBtn, color: "var(--danger)" }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <div style={toastStyle}>{toast}</div>}
    </div>
  );
}

/* ── Helpers de data ───────────────────────────────────────────────────────── */

// Timestamp/Date → "YYYY-MM-DDTHH:mm" no fuso local (valor de <input datetime-local>).
function toLocalInput(ts) {
  const d = tsToDate(ts);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(ts) {
  const d = tsToDate(ts);
  if (!d) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  return null;
}

/* ── Pequenos componentes / estilos ───────────────────────────────────────── */

function Label({ children }) {
  return (
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
      {children}
    </p>
  );
}

function Field({ label, style, children }) {
  return (
    <label className="flex flex-col gap-1" style={{ flex: 1, minWidth: 180, ...style }}>
      <span style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

const container = {
  maxWidth: 1000,
  margin: "0 auto",
  padding: "40px clamp(16px, 5vw, 64px)",
  fontFamily: "var(--font-ui)",
  color: "var(--text-secondary)",
};

const h1 = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h1)",
  fontWeight: 400,
  color: "var(--text-primary)",
  margin: 0,
};

const hint = { fontSize: "var(--fs-tiny)", color: "var(--text-muted)", margin: "8px 0 0" };

const selectStyle = {
  fontSize: "var(--fs-small)",
  color: "var(--text-primary)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-btn)",
  padding: "8px 12px",
  minWidth: 260,
};

const formCard = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "22px 24px",
};

const inputStyle = {
  fontSize: "var(--fs-small)",
  color: "var(--text-primary)",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-btn)",
  padding: "8px 12px",
  width: "100%",
};

const primaryBtn = {
  fontSize: "var(--fs-small)",
  fontWeight: 700,
  color: "var(--bg-base)",
  background: "linear-gradient(90deg, var(--indigo-500), var(--accent-400))",
  border: "none",
  borderRadius: "var(--radius-btn)",
  padding: "9px 18px",
  cursor: "pointer",
};

const ghostBtn = {
  fontSize: "var(--fs-small)",
  fontWeight: 600,
  color: "var(--text-secondary)",
  background: "transparent",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-btn)",
  padding: "8px 16px",
  cursor: "pointer",
};

const linkBtn = {
  fontSize: "var(--fs-tiny)",
  fontWeight: 600,
  color: "var(--text-secondary)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "4px 8px",
};

const th = {
  textAlign: "left",
  padding: "10px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-tiny)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  background: "var(--bg-overlay)",
};

const td = { padding: "9px 14px", color: "var(--text-primary)" };
const tdMono = { ...td, fontFamily: "var(--font-mono)", fontSize: "var(--fs-tiny)", color: "var(--text-secondary)" };

const toastStyle = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  background: "var(--bg-overlay)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-btn)",
  padding: "10px 18px",
  fontSize: "var(--fs-small)",
  color: "var(--text-primary)",
  boxShadow: "var(--ring-soft)",
  zIndex: 50,
};
