import { useState } from "react";

export default function AddEventModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: "", date: "", local: "", desc: "" });
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.date) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px", color: "#1a1a1a" }}>
          Nova conferência
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder="Nome da conferência *"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            style={inputStyle}
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Local (ex: Colégio Santo Antônio)"
            value={form.local}
            onChange={(e) => set("local", e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Descrição (opcional)"
            value={form.desc}
            onChange={(e) => set("desc", e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.date}
            style={{
              ...saveBtnStyle,
              opacity: saving || !form.name.trim() || !form.date ? 0.6 : 1,
            }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
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
  width: 340,
  maxWidth: "90vw",
};

const inputStyle = {
  padding: "7px 10px",
  fontSize: 13,
  border: "0.5px solid #ddd",
  borderRadius: 6,
  outline: "none",
  width: "100%",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};

const cancelBtnStyle = {
  flex: 1, padding: "7px 0", fontSize: 13,
  border: "0.5px solid #ddd", borderRadius: 6,
  background: "#fff", cursor: "pointer", color: "#555",
};

const saveBtnStyle = {
  flex: 1, padding: "7px 0", fontSize: 13,
  background: "#1D9E75", color: "#fff",
  border: "none", borderRadius: 6,
  cursor: "pointer", fontWeight: 500,
};
