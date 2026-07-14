// src/components/conference/AttendancePanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Painel de presença do diretor (renderizado só quando isDirector). Lista os
// DELEGADOS do comitê (vindos da importação de planilha) com selo Presente /
// Ausente calculado a partir de attendance, contador "X de Y presentes", botão
// de marcar presença manualmente (quando o QR falhou) e exportação .xlsx.
//
// Diretores não entram nesta contagem (role != "delegate"): só delegados têm QR
// e fazem check-in. attendance é escrito SÓ pelo endpoint /api/checkin — o botão
// manual também passa por lá (markPresenceManually), o client nunca grava direto.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import {
  subscribeMembers,
  subscribeAttendance,
  markPresenceManually,
} from "../../data/firestore";
import { exportAttendanceXlsx } from "../../utils/spreadsheet";

// Limiar de presença: um delegado conta como "Presente" se tem check-in nas
// últimas 4h. Ajuste aqui se o evento tiver blocos mais curtos/longos.
const PRESENCE_WINDOW_MS = 4 * 60 * 60 * 1000;

export default function AttendancePanel({ conferenceId, committeeId }) {
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  // Tick de 1 min: força o recálculo de Presente/Ausente contra o Date.now()
  // atual mesmo sem novos check-ins — senão um delegado nunca "expiraria" para
  // Ausente ao cruzar o limiar (o componente só re-renderiza em snapshot novo).
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubs = [
      subscribeMembers(conferenceId, committeeId, setMembers),
      subscribeAttendance(conferenceId, committeeId, setAttendance),
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

  // memberId → ms do check-in mais recente.
  const lastById = useMemo(() => {
    const map = new Map();
    for (const a of attendance) {
      const ms = toMillis(a.checkinAt);
      if (!ms) continue;
      if (ms > (map.get(a.memberId) ?? 0)) map.set(a.memberId, ms);
    }
    return map;
  }, [attendance]);

  const now = Date.now();
  const isPresent = (memberId) => {
    const ms = lastById.get(memberId);
    return Boolean(ms) && now - ms < PRESENCE_WINDOW_MS;
  };

  const presentCount = delegates.filter((m) => isPresent(m.id)).length;

  function handleExport() {
    const rows = delegates.map((m) => {
      const ms = lastById.get(m.id);
      const present = Boolean(ms) && now - ms < PRESENCE_WINDOW_MS;
      return {
        nome: m.nome || "",
        pais: m.pais || "",
        comite: m.committeeName || "",
        status: present ? "Presente" : "Ausente",
        horario: ms ? new Date(ms).toLocaleString("pt-BR") : "",
      };
    });
    const label = (delegates[0]?.committeeName || committeeId).replace(/\s+/g, "_");
    exportAttendanceXlsx(rows, `presenca_${label}.xlsx`);
  }

  return (
    <section
      aria-label="Presença"
      className="anim-fade-up mt-12"
      style={{ animationDelay: "0.25s" }}
    >
      <Heading>Presença</Heading>

      <div className="flex flex-wrap items-center gap-3" style={{ margin: "12px 0 0" }}>
        <p style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)", margin: 0 }}>
          {delegates.length === 0
            ? "Nenhum delegado importado neste comitê."
            : `${presentCount} de ${delegates.length} presentes.`}
        </p>
        <span aria-hidden className="flex-1" style={{ minWidth: 12 }} />
        {delegates.length > 0 && (
          <button type="button" onClick={handleExport} style={ghostButtonStyle}>
            Exportar presença (.xlsx)
          </button>
        )}
      </div>

      {delegates.length > 0 && (
        <ul className="mt-5 flex list-none flex-col gap-2 p-0 m-0">
          {delegates.map((m) => (
            <MemberRow
              key={m.id}
              conferenceId={conferenceId}
              committeeId={committeeId}
              member={m}
              present={isPresent(m.id)}
              lastMs={lastById.get(m.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberRow({ conferenceId, committeeId, member, present, lastMs }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function markPresent() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await markPresenceManually({ conferenceId, committeeId, memberId: member.id });
      // A subscription de attendance atualiza o selo em tempo real; nada a fazer.
    } catch (err) {
      setError(err?.message || "Falha ao marcar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className="flex flex-wrap items-center gap-3"
      style={{ padding: "10px 4px", borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex flex-col" style={{ minWidth: 180 }}>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {member.nome || member.id}
        </span>
        {member.pais && (
          <span style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}>
            {member.pais}
          </span>
        )}
      </div>

      <span
        aria-hidden
        className="flex-1"
        style={{ borderBottom: "1px dotted var(--border-strong)", transform: "translateY(4px)", minWidth: 20 }}
      />

      {present && lastMs && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}>
          {new Date(lastMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}

      <PresenceBadge present={present} />

      {!present && (
        <button
          type="button"
          onClick={markPresent}
          disabled={busy}
          style={{ ...ghostButtonStyle, opacity: busy ? 0.5 : 1, cursor: busy ? "not-allowed" : "pointer" }}
        >
          {busy ? "Marcando…" : "Marcar presença"}
        </button>
      )}

      {error && (
        <span style={{ fontSize: "var(--fs-tiny)", color: "var(--warning)", width: "100%" }}>
          {error}
        </span>
      )}
    </li>
  );
}

function PresenceBadge({ present }) {
  const color = present ? "var(--success)" : "var(--text-muted)";
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-tiny)",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color,
        background: present ? "hsl(158 70% 40% / 0.12)" : "var(--bg-overlay)",
        border: `1px solid ${present ? "hsl(158 70% 40% / 0.4)" : "var(--border)"}`,
        borderRadius: "var(--radius-badge)",
        padding: "3px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: "50%", background: present ? "var(--success)" : "var(--border-strong)" }}
      />
      {present ? "Presente" : "Ausente"}
    </span>
  );
}

/* ── Auxiliares ─────────────────────────────────────────────────────────────── */

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
