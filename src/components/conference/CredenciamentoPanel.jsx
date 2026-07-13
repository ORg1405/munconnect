// src/components/conference/CredenciamentoPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Seções do diretor na página do comitê (renderizadas só quando isDirector):
//   • Credenciamento — lista de membros com estado pareado / não pareado e o
//     fluxo "aguardando leitura" que escuta o totem e grava o rfidUid.
//   • Presença — check-ins de hoje em tempo real (attendance).
//
// O totem físico (ESP32) nunca fala com a UI: ele chama /api/checkin, que grava
// devices/{deviceId}.pendingPairing (pareamento) ou attendance (check-in). Aqui
// só lemos esses dados em tempo real e concluímos o pareamento (ver pairMemberBadge).
//
// Os 3 totens são fixos e genéricos — o diretor escolhe qual usar no seletor.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import {
  subscribeMembers,
  subscribeDevicePairing,
  subscribeAttendance,
  pairMemberBadge,
  clearDevicePairing,
} from "../../data/firestore";

// Totens físicos disponíveis (fixos). Os ids têm de bater com os documentos
// devices/{id} criados no console e com o firmware de cada ESP32.
const DEVICE_IDS = [
  { id: "totem-01", label: "Totem 1" },
  { id: "totem-02", label: "Totem 2" },
  { id: "totem-03", label: "Totem 3" },
];

// Chave estável de uma pendência para detectar leituras NOVAS sem precisar apagar
// o doc do totem (a UI não escreve em devices — só a Cloud Function). Ao entrar
// em espera guardamos a chave atual como baseline e só reagimos quando muda.
function pendingKey(p) {
  if (!p || !p.rfidUid) return "none";
  return `${p.rfidUid}|${toMillis(p.timestamp)}`;
}

export default function CredenciamentoPanel({ conferenceId, committeeId }) {
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    const unsubs = [
      subscribeMembers(conferenceId, committeeId, setMembers),
      subscribeAttendance(conferenceId, committeeId, setAttendance),
    ];
    return () => unsubs.forEach((u) => u());
  }, [conferenceId, committeeId]);

  return (
    <>
      <PairingSection
        conferenceId={conferenceId}
        committeeId={committeeId}
        members={members}
      />
      <AttendanceSection attendance={attendance} />
    </>
  );
}

/* ── Credenciamento: seletor de totem + lista de membros + pareamento ────────── */

function PairingSection({ conferenceId, committeeId, members }) {
  // Totem selecionado (os 3 são genéricos; o diretor escolhe qual encostar a tag).
  const [deviceId, setDeviceId] = useState(DEVICE_IDS[0].id);
  const [pending, setPending] = useState(null);
  // uid do membro em pareamento (null = ninguém aguardando leitura).
  const [waitingUid, setWaitingUid] = useState(null);
  // Baseline da pendência no instante em que a espera começou (ver pendingKey).
  const baselineRef = useRef("none");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null); // { kind: "ok"|"err", text }

  // Assina a pendência do totem selecionado. Trocar de totem cancela qualquer
  // espera em andamento (o baseline pertencia ao device anterior).
  useEffect(() => {
    setWaitingUid(null);
    setPending(null);
    baselineRef.current = "none";
    const unsub = subscribeDevicePairing(deviceId, setPending);
    return () => unsub();
  }, [deviceId]);

  const waitingMember = members.find((m) => m.id === waitingUid) || null;

  function startWaiting(uid) {
    baselineRef.current = pendingKey(pending); // ignora a pendência atual (stale)
    setFeedback(null);
    setWaitingUid(uid);
  }

  function cancelWaiting() {
    setWaitingUid(null);
  }

  // Enquanto aguardando: ao surgir uma leitura NOVA (chave != baseline), conclui o
  // pareamento (rfidUid no membro + rfidTags). Sem deps de funções p/ não re-rodar.
  useEffect(() => {
    if (!waitingUid || busy) return;
    const key = pendingKey(pending);
    if (key === "none" || key === baselineRef.current) return;

    const rfidUid = pending.rfidUid;
    // Guarda: essa tag já é de outro membro DESTE comitê? Não sobrescreve (evita
    // UID duplicado dentro do comitê). Reuso entre comitês é tratado pelas rules.
    const owner = members.find((m) => m.rfidUid === rfidUid && m.id !== waitingUid);
    if (owner) {
      setFeedback({
        kind: "err",
        text: `Esse crachá já está pareado com ${owner.nome || owner.id}.`,
      });
      baselineRef.current = key; // consome a leitura para não repetir o aviso
      return;
    }

    const member = members.find((m) => m.id === waitingUid);
    setBusy(true);
    pairMemberBadge({ conferenceId, committeeId, memberId: waitingUid, rfidUid })
      .then(() => {
        setFeedback({
          kind: "ok",
          text: `Crachá pareado com ${member?.nome || waitingUid}.`,
        });
        setWaitingUid(null);
        // Limpa a pendência residual no totem (via Cloud Function). Best-effort:
        // a baseline já protege o próximo pareamento, então falha aqui é benigna.
        clearDevicePairing({ deviceId, conferenceId, committeeId }).catch((e) =>
          console.warn("[clearDevicePairing]", e?.message || e)
        );
      })
      .catch((err) => {
        // permission-denied = a tag pertence a outro comitê e o batch bateu na
        // rule de rfidTags. Mensagem amigável na tela; detalhe técnico só no log.
        const text =
          err?.code === "permission-denied"
            ? "Esse crachá já está pareado com outro comitê. Peça pro diretor daquele comitê liberar, ou repareie por lá."
            : `Falha ao parear: ${err?.code || err?.message || err}`;
        setFeedback({ kind: "err", text });
        console.warn("[pairMemberBadge]", err?.code || err?.message || err);
      })
      .finally(() => {
        baselineRef.current = key;
        setBusy(false);
      });
  }, [pending, waitingUid, busy, members, conferenceId, committeeId, deviceId]);

  const pairedCount = members.filter((m) => m.rfidUid).length;

  return (
    <section
      aria-label="Credenciamento"
      className="anim-fade-up mt-12"
      style={{ animationDelay: "0.25s" }}
    >
      <Heading>Credenciamento</Heading>

      {/* Seletor do totem que será usado no pareamento */}
      <TotemSelector
        selected={deviceId}
        onSelect={setDeviceId}
        disabled={busy || waitingUid !== null}
      />

      <p style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)", margin: "12px 0 0" }}>
        {members.length === 0
          ? "Nenhum membro cadastrado neste comitê."
          : `${pairedCount} de ${members.length} membros com crachá pareado.`}
      </p>

      {/* Estado de espera (aguardando leitura no totem) */}
      {waitingMember && (
        <WaitingCard
          member={waitingMember}
          deviceLabel={DEVICE_IDS.find((d) => d.id === deviceId)?.label ?? deviceId}
          busy={busy}
          onCancel={cancelWaiting}
        />
      )}

      {feedback && (
        <p
          style={{
            fontSize: "var(--fs-small)",
            fontWeight: 600,
            color: feedback.kind === "ok" ? "var(--indigo-300)" : "var(--warning)",
            margin: "12px 0 0",
          }}
        >
          {feedback.text}
        </p>
      )}

      <ul className="mt-5 flex list-none flex-col gap-2 p-0 m-0">
        {members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            waiting={m.id === waitingUid}
            disabled={busy || (waitingUid !== null && m.id !== waitingUid)}
            onPair={() => startWaiting(m.id)}
          />
        ))}
      </ul>
    </section>
  );
}

// Botões dos 3 totens (rádio). Desabilitado durante uma espera/gravação para não
// trocar de device no meio de um pareamento.
function TotemSelector({ selected, onSelect, disabled }) {
  return (
    <div className="mt-3">
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
        Totem para pareamento
      </p>
      <div
        role="group"
        aria-label="Selecionar totem"
        className="inline-flex items-center"
        style={{
          gap: 4,
          background: "var(--bg-overlay)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-badge)",
          padding: 3,
        }}
      >
        {DEVICE_IDS.map((d) => {
          const active = d.id === selected;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => !active && onSelect(d.id)}
              disabled={disabled}
              aria-pressed={active}
              style={{
                cursor: disabled ? "not-allowed" : active ? "default" : "pointer",
                border: `1px solid ${active ? "var(--indigo-400)" : "transparent"}`,
                background: active ? "hsl(255 72% 62% / 0.12)" : "transparent",
                color: active ? "var(--indigo-300)" : "var(--text-muted)",
                borderRadius: "var(--radius-badge)",
                padding: "4px 12px",
                fontSize: "var(--fs-tiny)",
                fontWeight: 600,
                opacity: disabled && !active ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MemberRow({ member, waiting, disabled, onPair }) {
  const paired = Boolean(member.rfidUid);
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
            {member.role === "director" && " · Diretor"}
          </span>
        )}
      </div>

      <span
        aria-hidden
        className="flex-1"
        style={{ borderBottom: "1px dotted var(--border-strong)", transform: "translateY(4px)", minWidth: 20 }}
      />

      <PairBadge paired={paired} />

      <button
        type="button"
        onClick={onPair}
        disabled={disabled || waiting}
        style={{
          ...ghostButtonStyle,
          opacity: disabled || waiting ? 0.5 : 1,
          cursor: disabled || waiting ? "not-allowed" : "pointer",
        }}
      >
        {waiting ? "Aguardando…" : paired ? "Reparear" : "Parear crachá"}
      </button>
    </li>
  );
}

function PairBadge({ paired }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-tiny)",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: paired ? "var(--success, #1D9E75)" : "var(--text-muted)",
        background: paired ? "hsl(158 70% 40% / 0.12)" : "var(--bg-overlay)",
        border: `1px solid ${paired ? "hsl(158 70% 40% / 0.4)" : "var(--border)"}`,
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
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: paired ? "var(--success, #1D9E75)" : "var(--border-strong)",
        }}
      />
      {paired ? "Pareado" : "Não pareado"}
    </span>
  );
}

function WaitingCard({ member, deviceLabel, busy, onCancel }) {
  return (
    <div
      className="mt-5"
      style={{
        background: "var(--bg-overlay)",
        border: "1px dashed var(--indigo-400)",
        borderRadius: "var(--radius-lg)",
        padding: "18px 20px",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "var(--indigo-400)",
            animation: "pulse-ring 1.4s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>
          {busy
            ? "Registrando…"
            : `Encoste o crachá de ${member.nome || member.id} no ${deviceLabel} agora…`}
        </p>
      </div>
      <p style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", margin: "8px 0 12px" }}>
        A tela está escutando o {deviceLabel} em tempo real. A primeira tag nova
        lida será vinculada a este membro.
      </p>
      <button type="button" onClick={onCancel} disabled={busy} style={ghostButtonStyle}>
        Cancelar
      </button>
    </div>
  );
}

/* ── Presença: check-ins de hoje ───────────────────────────────────────────── */

function AttendanceSection({ attendance }) {
  const today = useMemo(() => attendance.filter((a) => isToday(a.timestamp)), [attendance]);

  return (
    <section
      aria-label="Presença"
      className="anim-fade-up mt-12"
      style={{ animationDelay: "0.3s" }}
    >
      <Heading>Presença de hoje</Heading>

      <p style={{ fontSize: "var(--fs-small)", color: "var(--text-muted)", margin: "10px 0 0" }}>
        {today.length === 0
          ? "Nenhum check-in registrado hoje."
          : `${today.length} ${today.length === 1 ? "presença registrada" : "presenças registradas"}.`}
      </p>

      {today.length > 0 && (
        <ul className="mt-5 flex list-none flex-col gap-2 p-0 m-0">
          {today.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-card)",
                padding: "8px 12px",
              }}
            >
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                {a.nome || a.memberId}
              </span>
              {a.pais && (
                <span style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}>
                  {a.pais}
                </span>
              )}
              <span aria-hidden className="flex-1" style={{ minWidth: 12 }} />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-tiny)",
                  color: "var(--text-secondary)",
                }}
              >
                {formatTime(a.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── Auxiliares ─────────────────────────────────────────────────────────────── */

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

function toDate(ts) {
  const ms = toMillis(ts);
  return ms ? new Date(ms) : null;
}

function isToday(ts) {
  const d = toDate(ts);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatTime(ts) {
  const d = toDate(ts);
  if (!d) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
