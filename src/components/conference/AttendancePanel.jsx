// src/components/conference/AttendancePanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Painel de presença do diretor (renderizado só quando isDirector). Matriz de
// chamada por SESSÃO:
//   • Linhas  = delegados do comitê (nome + país)
//   • Colunas = sessões da conference, agrupadas por dia (Dia 1: S1 S2 S3 …)
//   • Células = status por par sessão+delegado:
//       P  → verde   |  PV → dourado/azul (var(--accent-400))  |  — → cinza (sem doc)
//
// O diretor clica numa célula para corrigir (Marcar P / PV / ausente) e pode
// "Marcar todos como PV" na sessão em foco. Todas as edições passam pelo endpoint
// /api/checkin (source manual_director, ID token) — o client NUNCA escreve
// attendance direto (gravam lastEditedAt/lastEditedBy). Diretores não entram na
// contagem (role != "delegate"): só delegados fazem check-in.
//
// attendance legado (docs sem sessionId, do modelo antigo) é ignorado: a matriz
// só indexa docs com sessionId. Pode ser apagado à mão no console.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import {
  subscribeMembers,
  subscribeAttendance,
  subscribeSessions,
  markPresenceManually,
  bulkMarkPresence,
} from "../../data/firestore";
import { exportAttendanceMatrixXlsx } from "../../utils/spreadsheet";

export default function AttendancePanel({ conferenceId, committeeId }) {
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [sessions, setSessions] = useState([]);
  // Tick de 1 min: recalcula qual sessão está ativa contra o Date.now() atual.
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(null); // { sessionId, memberId } | null
  const [menuPos, setMenuPos] = useState(null); // { x, y, flipUp } do popover (fixed)
  const [busyKey, setBusyKey] = useState(""); // `${sessionId}_${memberId}` em gravação
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeMembers(conferenceId, committeeId, setMembers),
      subscribeAttendance(conferenceId, committeeId, setAttendance),
      subscribeSessions(conferenceId, setSessions),
    ];
    return () => unsubs.forEach((u) => u());
  }, [conferenceId, committeeId]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Só delegados entram na presença (diretores organizam, não fazem check-in).
  const delegates = useMemo(
    () => members.filter((m) => m.role === "delegate"),
    [members]
  );

  // `${sessionId}_${memberId}` → status. Só docs com sessionId (ignora legado).
  const statusByKey = useMemo(() => {
    const map = new Map();
    for (const a of attendance) {
      if (!a.sessionId || !a.memberId) continue;
      map.set(`${a.sessionId}_${a.memberId}`, a.status ?? null);
    }
    return map;
  }, [attendance]);

  // Colunas = sessões, numeradas por dia (S1, S2… dentro de cada dia).
  const columns = useMemo(() => {
    const perDay = new Map();
    return sessions.map((s) => {
      const day = s.day ?? 0;
      const n = (perDay.get(day) ?? 0) + 1;
      perDay.set(day, n);
      return { ...s, code: `S${n}`, exportLabel: `S${n} D${day}` };
    });
  }, [sessions]);

  // Agrupa colunas contíguas por dia (para o cabeçalho de dois níveis).
  const dayGroups = useMemo(() => {
    const groups = [];
    for (const c of columns) {
      const day = c.day ?? 0;
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.cols.push(c);
      else groups.push({ day, cols: [c] });
    }
    return groups;
  }, [columns]);

  // Sessão em foco: a ativa (now entre início e fim) ou, se nenhuma, a última já
  // iniciada (fallback pedido no spec — "última sessão do dia"). Depende de `tick`
  // (1 min) para avançar ao cruzar o limite de uma sessão mesmo sem novos scans.
  const focus = useMemo(() => {
    if (!columns.length) return null;
    const now = Date.now();
    const active = columns.find((c) => {
      const s = toMillis(c.startAt);
      const e = toMillis(c.endAt);
      return s && e && now >= s && now <= e;
    });
    if (active) return { session: active, active: true, upcoming: false };
    const started = columns.filter((c) => {
      const s = toMillis(c.startAt);
      return s && s <= now;
    });
    if (started.length)
      return { session: started[started.length - 1], active: false, upcoming: false };
    // Nenhuma sessão começou ainda → a primeira é a PRÓXIMA (não "última").
    return { session: columns[0], active: false, upcoming: true };
    // `tick` entra como dependência para reavaliar a janela ao longo do tempo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, tick]);

  // Contadores da sessão em foco.
  const stats = useMemo(() => {
    if (!focus) return { p: 0, pv: 0 };
    let p = 0;
    let pv = 0;
    for (const m of delegates) {
      const st = statusByKey.get(`${focus.session.id}_${m.id}`);
      if (st === "P") p++;
      else if (st === "PV") pv++;
    }
    return { p, pv };
  }, [focus, delegates, statusByKey]);

  // Abre o popover (menu único, posição fixa a partir do rect da célula — evita o
  // clipping do container com overflow-x). Vira para cima se estiver perto do fim
  // da viewport.
  function openMenu(e, sessionId, memberId) {
    const r = e.currentTarget.getBoundingClientRect();
    const flipUp = r.bottom + 140 > window.innerHeight;
    setMenuPos({ x: r.left + r.width / 2, y: flipUp ? r.top : r.bottom, flipUp });
    setEditing({ sessionId, memberId });
  }

  function closeMenu() {
    setEditing(null);
    setMenuPos(null);
  }

  async function setCell(sessionId, memberId, status) {
    const key = `${sessionId}_${memberId}`;
    setBusyKey(key);
    setError("");
    closeMenu();
    try {
      await markPresenceManually({ conferenceId, committeeId, sessionId, memberId, status });
      // A subscription de attendance atualiza a célula em tempo real.
    } catch (err) {
      setError(err?.message || "Falha ao gravar");
    } finally {
      setBusyKey("");
    }
  }

  async function markAllPV() {
    if (!focus || !delegates.length) return;
    const label = focus.session.name || focus.session.code;
    if (
      !window.confirm(
        `Marcar TODOS os ${delegates.length} delegados como PV na sessão "${label}"? Isso sobrescreve o status atual deles nesta sessão.`
      )
    )
      return;
    setBulkBusy(true);
    setError("");
    try {
      await bulkMarkPresence({
        conferenceId,
        committeeId,
        sessionId: focus.session.id,
        memberIds: delegates.map((m) => m.id),
        status: "PV",
      });
    } catch (err) {
      setError(err?.message || "Falha ao marcar todos");
    } finally {
      setBulkBusy(false);
    }
  }

  function handleExport() {
    const rows = delegates.map((m) => ({
      nome: m.nome || "",
      pais: m.pais || "",
      cells: columns.map((c) => cellChar(statusByKey.get(`${c.id}_${m.id}`))),
    }));
    const label = (delegates[0]?.committeeName || committeeId).replace(/\s+/g, "_");
    exportAttendanceMatrixXlsx(
      { sessionColumns: columns.map((c) => c.exportLabel), rows },
      `chamada_${label}.xlsx`
    );
  }

  return (
    <section
      aria-label="Presença"
      className="anim-fade-up mt-12"
      style={{ animationDelay: "0.25s" }}
    >
      <Heading>Presença por sessão</Heading>

      {/* Cabeçalho: contador da sessão em foco + ações */}
      <div className="flex flex-wrap items-center gap-3" style={{ margin: "12px 0 0" }}>
        {delegates.length === 0 ? (
          <p style={muted}>Nenhum delegado importado neste comitê.</p>
        ) : columns.length === 0 ? (
          <p style={muted}>
            Nenhuma sessão cadastrada — peça à organização para configurar as sessões da conferência.
          </p>
        ) : (
          <p style={{ ...muted, color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>
              {focus.active ? "Sessão atual" : focus.upcoming ? "Próxima sessão" : "Última sessão"}:
            </strong>{" "}
            {focus.session.name || focus.session.code} — {stats.p + stats.pv} presentes ({stats.p} P
            + {stats.pv} PV) de {delegates.length} delegados
          </p>
        )}

        <span aria-hidden className="flex-1" style={{ minWidth: 12 }} />

        {delegates.length > 0 && columns.length > 0 && (
          <>
            <button
              type="button"
              onClick={markAllPV}
              disabled={bulkBusy}
              style={{ ...ghostButtonStyle, opacity: bulkBusy ? 0.5 : 1 }}
            >
              {bulkBusy ? "Marcando…" : "Marcar todos como PV nesta sessão"}
            </button>
            <button type="button" onClick={handleExport} style={ghostButtonStyle}>
              Exportar chamada (.xlsx)
            </button>
          </>
        )}
      </div>

      {error && (
        <p style={{ fontSize: "var(--fs-tiny)", color: "var(--warning)", margin: "8px 0 0" }}>
          {error}
        </p>
      )}

      {delegates.length > 0 && columns.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 18 }}>
          <table style={matrixTable}>
            <thead>
              {/* Nível 1: dias */}
              <tr>
                <th style={{ ...cornerTh, minWidth: 200 }} rowSpan={2}>
                  Delegado
                </th>
                {dayGroups.map((g) => (
                  <th key={g.day} colSpan={g.cols.length} style={dayTh}>
                    Dia {g.day}
                  </th>
                ))}
              </tr>
              {/* Nível 2: sessões (código Sn, nome no title) */}
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    style={{
                      ...sessionTh,
                      background:
                        focus?.session.id === c.id
                          ? "hsl(38 92% 65% / 0.12)"
                          : "var(--bg-overlay)",
                    }}
                    title={c.name || c.code}
                  >
                    {c.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {delegates.map((m) => (
                <tr key={m.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={nameTd}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                      {m.nome || m.id}
                    </span>
                    {m.pais && (
                      <span style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", display: "block" }}>
                        {m.pais}
                      </span>
                    )}
                  </td>
                  {columns.map((c) => {
                    const key = `${c.id}_${m.id}`;
                    return (
                      <Cell
                        key={key}
                        status={statusByKey.get(key)}
                        busy={busyKey === key}
                        onOpen={(e) => openMenu(e, c.id, m.id)}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && menuPos && (
        <>
          {/* backdrop para fechar ao clicar fora */}
          <div
            onClick={closeMenu}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "transparent" }}
          />
          <div
            style={{
              ...popover,
              left: menuPos.x,
              top: menuPos.y,
              transform: menuPos.flipUp
                ? "translate(-50%, -100%)"
                : "translate(-50%, 4px)",
            }}
          >
            <MenuItem color="var(--success)" onClick={() => setCell(editing.sessionId, editing.memberId, "P")}>
              Marcar P
            </MenuItem>
            <MenuItem color="var(--accent-400)" onClick={() => setCell(editing.sessionId, editing.memberId, "PV")}>
              Marcar PV
            </MenuItem>
            <MenuItem color="var(--text-muted)" onClick={() => setCell(editing.sessionId, editing.memberId, "ausente")}>
              Marcar ausente
            </MenuItem>
          </div>
        </>
      )}

      <Legend show={delegates.length > 0 && columns.length > 0} />
    </section>
  );
}

/* ── Célula clicável com popover ───────────────────────────────────────────── */

function Cell({ status, busy, onOpen }) {
  return (
    <td style={{ padding: 0, textAlign: "center" }}>
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        style={{
          ...cellButton,
          ...cellStyleFor(status),
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.5 : 1,
        }}
        title="Editar presença"
      >
        {busy ? "…" : cellChar(status)}
      </button>
    </td>
  );
}

function MenuItem({ color, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "8px 14px",
        fontSize: "var(--fs-small)",
        fontWeight: 600,
        color,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Legend({ show }) {
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center gap-4" style={{ marginTop: 14 }}>
      <LegendItem status="P" label="Presente" />
      <LegendItem status="PV" label="Presente e Votante" />
      <LegendItem status={undefined} label="Ausente / sem check-in" />
      <span style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}>
        Clique numa célula para corrigir.
      </span>
    </div>
  );
}

function LegendItem({ status, label }) {
  return (
    <span className="flex items-center gap-2" style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}>
      <span style={{ ...cellButton, ...cellStyleFor(status), width: 28, height: 22, borderRadius: 5 }}>
        {cellChar(status)}
      </span>
      {label}
    </span>
  );
}

/* ── Auxiliares ─────────────────────────────────────────────────────────────── */

function cellChar(status) {
  if (status === "P") return "P";
  if (status === "PV") return "PV";
  return "—"; // ausente ou sem doc
}

function cellStyleFor(status) {
  if (status === "P") {
    return {
      color: "var(--success)",
      background: "hsl(158 70% 40% / 0.16)",
      borderColor: "hsl(158 70% 40% / 0.4)",
    };
  }
  if (status === "PV") {
    return {
      color: "var(--accent-400)",
      background: "hsl(38 92% 60% / 0.16)",
      borderColor: "hsl(38 92% 60% / 0.45)",
    };
  }
  return {
    color: "var(--text-muted)",
    background: "var(--bg-overlay)",
    borderColor: "var(--border)",
  };
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

function Heading({ children }) {
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
      <span aria-hidden className="flex-1" style={{ height: 1, background: "var(--border-strong)" }} />
    </div>
  );
}

const muted = { fontSize: "var(--fs-small)", color: "var(--text-muted)", margin: 0 };

const ghostButtonStyle = {
  fontSize: "var(--fs-tiny)",
  fontWeight: 600,
  color: "var(--text-secondary)",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-badge)",
  padding: "5px 12px",
  cursor: "pointer",
};

const matrixTable = {
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: "var(--fs-small)",
  minWidth: "100%",
};

const cornerTh = {
  position: "sticky",
  left: 0,
  zIndex: 2,
  textAlign: "left",
  padding: "8px 12px",
  background: "var(--bg-overlay)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-tiny)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)",
};

const dayTh = {
  padding: "6px 8px",
  textAlign: "center",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-tiny)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  background: "var(--bg-overlay)",
  borderBottom: "1px solid var(--border)",
  borderLeft: "1px solid var(--border)",
};

const sessionTh = {
  padding: "6px 10px",
  textAlign: "center",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-tiny)",
  fontWeight: 700,
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--border)",
  borderLeft: "1px solid var(--border)",
  minWidth: 46,
};

const nameTd = {
  position: "sticky",
  left: 0,
  zIndex: 1,
  padding: "8px 12px",
  background: "var(--bg-base)",
  minWidth: 200,
};

const cellButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minWidth: 44,
  height: 34,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-tiny)",
  fontWeight: 700,
  border: "1px solid transparent",
  borderLeft: "1px solid var(--border)",
};

const popover = {
  position: "fixed",
  zIndex: 41,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-btn)",
  boxShadow: "var(--ring-soft)",
  padding: "4px 0",
  minWidth: 150,
};
