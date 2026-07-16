// src/pages/CheckinPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Página pública de check-in (rota /checkin), SEM login. Abre quando o delegado
// escaneia o QR do próprio crachá — o QR contém {origin}/checkin?m={memberId}.
//
// Fluxo em DUAS etapas (presença tipada por sessão):
//   1. Ao carregar, faz GET /api/checkin (peek): valida o delegado e descobre a
//      SESSÃO ativa. Mostra nome/país/comitê/sessão + dois botões grandes:
//        🟢 Presente (P)      — verde
//        🔵 Presente e Votante (PV) — dourado/azul (var(--accent-400))
//   2. O delegado toca num botão → POST /api/checkin com o status escolhido →
//      confirmação.
// Estética Diplomatic Tech.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const STATE = {
  LOADING: "loading", // resolvendo delegado + sessão (peek)
  CHOICE: "choice", // pronto: mostra os botões P / PV
  SUBMITTING: "submitting", // gravando a escolha
  OK: "ok", // presença registrada
  NOT_FOUND: "not_found", // QR não corresponde a delegado
  NO_SESSIONS: "no_sessions", // conference sem sessões cadastradas
  NO_ACTIVE: "no_active_session", // fora do horário de qualquer sessão
  ERROR: "error",
};

export default function CheckinPage() {
  const [params] = useSearchParams();
  const memberId = params.get("m");
  const [state, setState] = useState(STATE.LOADING);
  const [data, setData] = useState(null); // resposta do peek (member + session)
  const [result, setResult] = useState(null); // resposta do commit
  const [errorMsg, setErrorMsg] = useState("");

  // Etapa 1 — peek: resolve delegado e sessão ativa (não grava).
  useEffect(() => {
    if (!memberId) {
      setState(STATE.NOT_FOUND);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/checkin?m=${encodeURIComponent(memberId)}&source=qr_web`
        );
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (json.status === "ready") {
          setData(json);
          setState(STATE.CHOICE);
        } else if (res.status === 404 || json.status === "not_found") {
          setState(STATE.NOT_FOUND);
        } else if (json.status === "no_sessions") {
          setState(STATE.NO_SESSIONS);
        } else if (json.status === "no_active_session") {
          setState(STATE.NO_ACTIVE);
        } else {
          setErrorMsg(json.message || "");
          setState(STATE.ERROR);
        }
      } catch {
        if (alive) setState(STATE.ERROR);
      }
    })();
    return () => {
      alive = false;
    };
  }, [memberId]);

  // Etapa 2 — commit: grava o status escolhido (P ou PV).
  const choose = useCallback(
    async (status) => {
      setState(STATE.SUBMITTING);
      setErrorMsg("");
      try {
        const res = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ m: memberId, source: "qr_web", status }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.status === "ok") {
          setResult(json);
          setState(STATE.OK);
        } else if (json.status === "no_active_session") {
          // A sessão pode ter encerrado entre o peek e o toque.
          setState(STATE.NO_ACTIVE);
        } else if (json.status === "no_sessions") {
          setState(STATE.NO_SESSIONS);
        } else {
          setErrorMsg(json.message || "");
          setState(STATE.ERROR);
        }
      } catch {
        setErrorMsg("");
        setState(STATE.ERROR);
      }
    },
    [memberId]
  );

  return (
    <div style={wrap}>
      <div aria-hidden style={aurora} />
      <main style={card}>
        <div style={brand}>MUNConnect</div>
        <Content
          state={state}
          data={data}
          result={result}
          errorMsg={errorMsg}
          onChoose={choose}
        />
      </main>
    </div>
  );
}

function Content({ state, data, result, errorMsg, onChoose }) {
  if (state === STATE.LOADING) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={dot} />
        <p style={lead}>Carregando…</p>
      </div>
    );
  }

  // Etapa 1 concluída: escolha de P / PV.
  if (state === STATE.CHOICE || state === STATE.SUBMITTING) {
    const busy = state === STATE.SUBMITTING;
    return (
      <>
        <h1 style={title}>Confirmar presença</h1>
        <p style={lead}>
          <strong style={{ color: "var(--text-primary)" }}>{data.memberName || "Delegado(a)"}</strong>
          {data.memberCountry ? ` · ${data.memberCountry}` : ""}
        </p>
        {data.committeeName && <p style={sub}>{data.committeeName}</p>}
        {data.session?.name && (
          <p style={sessionPill}>{data.session.name}</p>
        )}

        {data.currentStatus && (
          <p style={{ ...time, color: "var(--accent-400)" }}>
            Você já marcou {statusLabel(data.currentStatus)} nesta sessão. Toque para alterar.
          </p>
        )}

        <div style={choiceRow}>
          <button
            type="button"
            onClick={() => onChoose("P")}
            disabled={busy}
            style={{ ...choiceBtn, ...pBtn, opacity: busy ? 0.55 : 1 }}
          >
            <span style={choiceGlyph}>🟢</span>
            Presente
            <span style={choiceTag}>P</span>
          </button>
          <button
            type="button"
            onClick={() => onChoose("PV")}
            disabled={busy}
            style={{ ...choiceBtn, ...pvBtn, opacity: busy ? 0.55 : 1 }}
          >
            <span style={choiceGlyph}>🔵</span>
            Presente e Votante
            <span style={choiceTag}>PV</span>
          </button>
        </div>
        {busy && <p style={{ ...time, textAlign: "center" }}>Registrando…</p>}
      </>
    );
  }

  if (state === STATE.OK) {
    const chosen = result?.chosenStatus;
    return (
      <>
        <Mark kind="ok" />
        <h1 style={title}>Presença registrada</h1>
        <p style={lead}>
          <strong style={{ color: "var(--text-primary)" }}>{result?.memberName || "Delegado(a)"}</strong>
          {result?.committeeName ? ` · ${result.committeeName}` : ""}
        </p>
        {result?.session?.name && <p style={sub}>{result.session.name}</p>}
        <p style={{ ...statusBanner, ...(chosen === "PV" ? pvBanner : pBanner) }}>
          {statusLabel(chosen)}
        </p>
        {result?.checkinAt && <p style={time}>Horário: {formatTime(result.checkinAt)}</p>}
      </>
    );
  }

  if (state === STATE.NOT_FOUND) {
    return (
      <>
        <Mark kind="err" />
        <h1 style={title}>QR não reconhecido</h1>
        <p style={lead}>
          Este código não corresponde a nenhum delegado. Procure a organização do evento.
        </p>
      </>
    );
  }

  if (state === STATE.NO_SESSIONS) {
    return (
      <>
        <Mark kind="warn" />
        <h1 style={title}>Chamada indisponível</h1>
        <p style={lead}>Sessões ainda não configuradas — procure a organização.</p>
      </>
    );
  }

  if (state === STATE.NO_ACTIVE) {
    return (
      <>
        <Mark kind="warn" />
        <h1 style={title}>Nenhuma chamada aberta</h1>
        <p style={lead}>
          Fora do horário de sessão — nenhuma chamada aberta no momento. Tente novamente quando a
          sessão começar.
        </p>
      </>
    );
  }

  return (
    <>
      <Mark kind="err" />
      <h1 style={title}>Não foi possível registrar</h1>
      <p style={lead}>
        {errorMsg || "Tente novamente em instantes. Se persistir, procure a organização."}
      </p>
    </>
  );
}

/* ── Ícone de estado ─────────────────────────────────────────────────────── */

function Mark({ kind }) {
  const color =
    kind === "ok" ? "var(--success)" : kind === "warn" ? "var(--accent-400)" : "var(--danger)";
  const glyph = kind === "ok" ? "✓" : kind === "warn" ? "!" : "✕";
  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        margin: "0 auto 20px",
        display: "grid",
        placeItems: "center",
        fontSize: 34,
        fontWeight: 700,
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `2px solid color-mix(in srgb, ${color} 55%, transparent)`,
      }}
    >
      {glyph}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function statusLabel(status) {
  if (status === "PV") return "Presente e Votante (PV)";
  if (status === "P") return "Presente (P)";
  return "—";
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ── Estilos ─────────────────────────────────────────────────────────────── */

const wrap = {
  minHeight: "100vh",
  background: "var(--bg-base)",
  color: "var(--text-secondary)",
  display: "grid",
  placeItems: "center",
  padding: 20,
  position: "relative",
  overflow: "hidden",
};

const aurora = {
  position: "absolute",
  inset: 0,
  background: "var(--grad-aurora)",
  pointerEvents: "none",
};

const card = {
  position: "relative",
  width: "100%",
  maxWidth: 420,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--ring-soft)",
  padding: "36px 28px 40px",
  textAlign: "center",
};

const brand = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-tiny)",
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: "var(--accent-400)",
  marginBottom: 28,
};

const title = {
  fontFamily: "var(--font-display)",
  fontSize: "1.9rem",
  fontWeight: 400,
  color: "var(--text-primary)",
  margin: "0 0 10px",
  lineHeight: 1.1,
};

const lead = { fontSize: "var(--fs-body)", margin: "0 0 6px", lineHeight: 1.5 };
const sub = { fontSize: "var(--fs-small)", color: "var(--indigo-300)", margin: "2px 0 0", fontWeight: 600 };

const sessionPill = {
  display: "inline-block",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-tiny)",
  letterSpacing: "0.04em",
  color: "var(--text-secondary)",
  background: "var(--bg-overlay)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-badge)",
  padding: "4px 12px",
  margin: "12px 0 4px",
};

const time = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-small)",
  color: "var(--text-muted)",
  margin: "14px 0 0",
};

const choiceRow = {
  display: "flex",
  gap: 12,
  marginTop: 24,
};

const choiceBtn = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: "20px 12px",
  borderRadius: "var(--radius-lg)",
  fontSize: "var(--fs-small)",
  fontWeight: 700,
  lineHeight: 1.2,
  cursor: "pointer",
  transition: "transform 0.1s, filter 0.1s",
};

const pBtn = {
  color: "var(--success)",
  background: "color-mix(in srgb, var(--success) 12%, transparent)",
  border: "2px solid color-mix(in srgb, var(--success) 55%, transparent)",
};

const pvBtn = {
  color: "var(--accent-400)",
  background: "color-mix(in srgb, var(--accent-400) 12%, transparent)",
  border: "2px solid color-mix(in srgb, var(--accent-400) 55%, transparent)",
};

const choiceGlyph = { fontSize: 26, lineHeight: 1 };

const choiceTag = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-tiny)",
  letterSpacing: "0.1em",
  opacity: 0.85,
};

const statusBanner = {
  display: "inline-block",
  fontWeight: 700,
  fontSize: "var(--fs-small)",
  borderRadius: "var(--radius-badge)",
  padding: "6px 16px",
  margin: "14px 0 0",
};

const pBanner = {
  color: "var(--success)",
  background: "color-mix(in srgb, var(--success) 14%, transparent)",
  border: "1px solid color-mix(in srgb, var(--success) 45%, transparent)",
};

const pvBanner = {
  color: "var(--accent-400)",
  background: "color-mix(in srgb, var(--accent-400) 14%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent-400) 45%, transparent)",
};

const dot = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  margin: "0 auto 22px",
  background: "var(--indigo-400)",
  animation: "pulse-ring 1.4s ease-in-out infinite",
};
