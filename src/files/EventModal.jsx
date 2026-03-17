export default function EventModal({ event, onClose }) {
  const [y, m, d] = event.date.split("-");
  const formatted = `${d}/${m}/${y}`;

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
        <button onClick={onClose} style={closeBtnStyle}>Fechar</button>
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
  width: "100%",
  padding: "7px 0",
  fontSize: 13,
  border: "0.5px solid #ddd",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  color: "#555",
};
