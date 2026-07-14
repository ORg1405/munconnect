// src/pages/CheckinPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Página pública de check-in (rota /checkin), SEM login. É o que abre quando o
// delegado escaneia o QR do próprio crachá com a câmera do celular — o QR
// contém {origin}/checkin?m={memberId}. A página chama /api/checkin com
// source=qr_web e renderiza a confirmação. Estética Diplomatic Tech.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const STATE = {
  LOADING: "loading",
  OK: "ok",
  ALREADY: "already_present",
  NOT_FOUND: "not_found",
  ERROR: "error",
};

export default function CheckinPage() {
  const [params] = useSearchParams();
  const memberId = params.get("m");
  const [state, setState] = useState(STATE.LOADING);
  const [data, setData] = useState(null);

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
        if (res.status === 404 || json.status === "not_found") {
          setState(STATE.NOT_FOUND);
        } else if (json.status === "already_present") {
          setData(json);
          setState(STATE.ALREADY);
        } else if (res.ok && json.status === "ok") {
          setData(json);
          setState(STATE.OK);
        } else {
          setData(json);
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

  return (
    <div style={wrap}>
      <div aria-hidden style={aurora} />
      <main style={card}>
        <div style={brand}>MUNConnect</div>
        <Content state={state} data={data} />
      </main>
    </div>
  );
}

function Content({ state, data }) {
  if (state === STATE.LOADING) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={dot} />
        <p style={lead}>Registrando presença…</p>
      </div>
    );
  }

  if (state === STATE.OK) {
    return (
      <>
        <Mark kind="ok" />
        <h1 style={title}>Presença registrada</h1>
        <p style={lead}>
          Bem-vindo(a),{" "}
          <strong style={{ color: "var(--text-primary)" }}>{data.memberName || "delegado(a)"}</strong>
          {data.memberCountry ? `, delegado(a) de ${data.memberCountry}` : ""}
          {data.committeeName ? ` no ${data.committeeName}` : ""}.
        </p>
        {data.checkinAt && (
          <p style={time}>Horário: {formatTime(data.checkinAt)}</p>
        )}
      </>
    );
  }

  if (state === STATE.ALREADY) {
    return (
      <>
        <Mark kind="warn" />
        <h1 style={title}>Você já fez check-in</h1>
        <p style={lead}>
          {data.memberName ? `${data.memberName}, ` : ""}sua presença já estava registrada
          {data.checkinAt ? ` ${agoText(data.checkinAt)}` : ""}.
        </p>
        {data.committeeName && <p style={sub}>Comitê {data.committeeName}</p>}
      </>
    );
  }

  if (state === STATE.NOT_FOUND) {
    return (
      <>
        <Mark kind="err" />
        <h1 style={title}>QR não reconhecido</h1>
        <p style={lead}>
          Este código não corresponde a nenhum delegado. Procure a organização do
          evento.
        </p>
      </>
    );
  }

  return (
    <>
      <Mark kind="err" />
      <h1 style={title}>Não foi possível registrar</h1>
      <p style={lead}>
        Tente novamente em instantes. Se persistir, procure a organização.
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

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function agoText(iso) {
  const d = new Date(iso);
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "agora há pouco";
  if (mins === 1) return "há 1 minuto";
  if (mins < 60) return `há ${mins} minutos`;
  const h = Math.round(mins / 60);
  return h === 1 ? "há 1 hora" : `há ${h} horas`;
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
const time = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-small)",
  color: "var(--text-muted)",
  margin: "14px 0 0",
};

const dot = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  margin: "0 auto 22px",
  background: "var(--indigo-400)",
  animation: "pulse-ring 1.4s ease-in-out infinite",
};
