import { useState } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

const IS_ADMIN = true;

export default function EventModal({ event, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [y, m, d] = event.date.split("-");
  const formatted = `${d}/${m}/${y}`;

  async function handleDelete() {
    setDeleting(true);
    await deleteDoc(doc(db, "conferences", event.id));
    onClose();
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px", color: "#1a1a1a" }}>
          {event.name}
        </h2>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 12px" }}>
          {formatted} · {event.local}
        </p>
        {event.desc && (
          <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: "0 0 16px" }}>
            {event.desc}
          </p>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={closeBtnStyle}>Fechar</button>
          {IS_ADMIN && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} style={deleteBtnStyle}>
              Excluir
            </button>
          )}
          {IS_ADMIN && confirmDelete && (
            <button onClick={handleDelete} disabled={deleting} style={confirmBtnStyle}>
              {deleting ? "Excluindo..." : "Confirmar exclusão"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.3)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 100,
};

const modalStyle = {
  background: "#fff",
  border: "0.5px solid #ddd",
  borderRadius: 12,
  padding: 20,
  width: 320,
  maxWidth: "90vw",
};

const closeBtnStyle = {
  flex: 1,
  padding: "7px 0",
  fontSize: 13,
  border: "0.5px solid #ddd",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  color: "#555",
};

const deleteBtnStyle = {
  flex: 1,
  padding: "7px 0",
  fontSize: 13,
  border: "0.5px solid #ffcccc",
  borderRadius: 6,
  background: "#fff5f5",
  cursor: "pointer",
  color: "#cc0000",
};

const confirmBtnStyle = {
  flex: 1,
  padding: "7px 0",
  fontSize: 13,
  border: "none",
  borderRadius: 6,
  background: "#cc0000",
  cursor: "pointer",
  color: "#fff",
  fontWeight: 500,
};