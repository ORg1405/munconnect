import { useState } from "react";

const COLORS = [
  { id: "green",  bg: "#E1F5EE", text: "#0F6E56", border: "#1D9E75", label: "Verde" },
  { id: "blue",   bg: "#E6F1FB", text: "#185FA5", border: "#378ADD", label: "Azul" },
  { id: "red",    bg: "#FCEBEB", text: "#A32D2D", border: "#E24B4A", label: "Vermelho" },
  { id: "purple", bg: "#EEEDFE", text: "#3C3489", border: "#7F77DD", label: "Roxo" },
  { id: "amber",  bg: "#FAEEDA", text: "#854F0B", border: "#EF9F27", label: "Laranja" },
  { id: "pink",   bg: "#FBEAF0", text: "#72243E", border: "#D4537E", label: "Rosa" },
  { id: "teal",   bg: "#E1F5EE", text: "#085041", border: "#5DCAA5", label: "Turquesa" },
  { id: "gray",   bg: "#F1EFE8", text: "#444441", border: "#888780", label: "Cinza" },
];

export { COLORS };

export default function AddEventModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: "", dateStart: "", dateEnd: "", local: "", desc: "", color: "green" });
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.dateStart || !form.dateEnd) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  const selectedColor = COLORS.find((c) => c.id === form.color) || COLORS[0];

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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Data de início *</p>
              <input
                type="date"
                value={form.dateStart}
                onChange={(e) => set("dateStart", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Data de fim *</p>
              <input
                type="date"
                value={form.dateEnd}
                min={form.dateStart}
                onChange={(e) => set("dateEnd", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
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

        {/* Paleta de cores */}
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Cor de destaque</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {COLORS.map((c) => (
              <button
                key={c.id}
                title={c.label}
                onClick={() => set("color", c.id)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: c.border,
                  border: form.color === c.id ? "3px solid #1a1a1a" : "3px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Prévia no calendário {form.dateStart && form.dateEnd ? `(${form.dateStart.split('-').reverse().join('/')} a ${form.dateEnd.split('-').reverse().join('/')})` : ""}</p>
          <div style={{
            background: "#f9f9f8",
            border: "0.5px solid #e0ddd6",
            borderRadius: 8,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <div style={{
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 4,
              background: selectedColor.bg,
              color: selectedColor.text,
              border: `1px solid ${selectedColor.border}`,
              fontWeight: 500,
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {form.name || "Nome da conferência"}
            </div>
            <span style={{ fontSize: 11, color: "#aaa" }}>← como aparece no calendário</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.dateStart || !form.dateEnd}
            style={{
              ...saveBtnStyle,
              opacity: saving || !form.name.trim() || !form.dateStart || !form.dateEnd ? 0.6 : 1,
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
  width: 360,
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
