import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_CONFERENCE_ID } from "../data/firestore";

const IS_ADMIN = true;

export default function EventModal({ event, onClose }) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function fmt(str) {
    if (!str) return "";
    const [y, m, d] = str.split("-");
    return `${d}/${m}/${y}`;
  }

  const start = event.dateStart || event.date;
  const end   = event.dateEnd || event.dateStart || event.date;
  const formatted = start === end ? fmt(start) : `${fmt(start)} a ${fmt(end)}`;

  async function handleDelete() {
    setDeleting(true);
    await deleteDoc(doc(db, "conferences", event.id));
    onClose();
  }

  return (
    <div className="modal-overlay" style={overlayStyle} onClick={onClose}>
      <div className="modal-content" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header strip with event color */}
        <div style={{
          height: 3,
          borderRadius: "var(--radius-dialog) var(--radius-dialog) 0 0",
          background: "var(--brand-500)",
          margin: "-20px -20px 16px",
        }} />

        <h2 style={{
          fontSize: 16, fontWeight: 700, margin: "0 0 4px",
          color: "var(--text-primary)", letterSpacing: "-0.01em",
        }}>
          {event.name}
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px" }}>
          {formatted}{event.local ? ` · ${event.local}` : ""}
          {event.region && (
            <span style={{
              marginLeft: 8, fontSize: 10,
              padding: "1px 7px", borderRadius: "var(--radius-badge)",
              background: "var(--bg-base)", color: "var(--brand-400)",
              border: "1px solid var(--brand-600)",
            }}>
              {event.region}
            </span>
          )}
        </p>

        {event.desc && (
          <p style={{
            fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65,
            margin: "0 0 18px",
            padding: "10px 12px",
            background: "var(--bg-base)",
            borderRadius: "var(--radius-btn)",
            border: "1px solid var(--border)",
          }}>
            {event.desc}
          </p>
        )}

        {/* Protótipo: por enquanto toda conferência abre a simulação mockada.
            Com o Firestore, trocar DEFAULT_CONFERENCE_ID por event.id. */}
        <button
          onClick={() => navigate(`/conference/${DEFAULT_CONFERENCE_ID}`)}
          style={committeesBtnStyle}
        >
          Ver comitês
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={closeBtnStyle}>Fechar</button>
          {IS_ADMIN && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} style={deleteBtnStyle}>
              Excluir
            </button>
          )}
          {IS_ADMIN && confirmDelete && (
            <button onClick={handleDelete} disabled={deleting} style={confirmBtnStyle}>
              {deleting ? "Excluindo…" : "Confirmar exclusão"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0,
  background: "hsl(210 42% 5% / 0.75)",
  backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 100,
};

const modalStyle = {
  background: "var(--bg-overlay)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-dialog)",
  boxShadow: "0 24px 64px hsl(210 42% 2% / 0.6), var(--ring-soft)",
  padding: 20,
  width: 340,
  maxWidth: "92vw",
  fontFamily: "var(--font-ui)",
};

const committeesBtnStyle = {
  width: "100%", padding: "9px 0", fontSize: 13, fontWeight: 600,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  border: "none", borderRadius: "var(--radius-btn)",
  background: "var(--grad-brand)", cursor: "pointer",
  color: "#fff", marginBottom: 10,
  boxShadow: "var(--glow-brand)",
};

const closeBtnStyle = {
  flex: 1, padding: "7px 0", fontSize: 13,
  border: "1px solid var(--border-strong)", borderRadius: "var(--radius-btn)",
  background: "transparent", cursor: "pointer",
  color: "var(--text-secondary)",
  transition: "border-color 0.15s, color 0.15s",
};

const deleteBtnStyle = {
  flex: 1, padding: "7px 0", fontSize: 13,
  border: "1px solid hsl(0 60% 35%)", borderRadius: "var(--radius-btn)",
  background: "hsl(0 55% 12%)", cursor: "pointer",
  color: "hsl(0 70% 65%)",
  transition: "background 0.15s",
};

const confirmBtnStyle = {
  flex: 1, padding: "7px 0", fontSize: 13,
  border: "none", borderRadius: "var(--radius-btn)",
  background: "hsl(0 60% 32%)", cursor: "pointer",
  color: "#fff", fontWeight: 600,
};
