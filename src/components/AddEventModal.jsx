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

// Dark-mode preview pill colors matching Calendar.jsx EVENT_PILL
const PREVIEW_DARK = {
  green:  { pill: "hsl(160 55% 24%)", text: "#d4fced" },
  blue:   { pill: "hsl(207 65% 26%)", text: "#d6edfb" },
  red:    { pill: "hsl(0 58% 28%)",   text: "#fbd6d6" },
  purple: { pill: "hsl(250 48% 30%)", text: "#e8e6fc" },
  amber:  { pill: "hsl(35 72% 28%)",  text: "#faecd4" },
  pink:   { pill: "hsl(330 50% 28%)", text: "#fad4e3" },
  teal:   { pill: "hsl(175 52% 23%)", text: "#ccf5eb" },
  gray:   { pill: "hsl(220 12% 24%)", text: "#e8e7e6" },
};

export { COLORS };

export default function AddEventModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    name: "", dateStart: "", dateEnd: "", local: "", desc: "", color: "blue", region: "",
  });
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

  const preview = PREVIEW_DARK[form.color] ?? PREVIEW_DARK.blue;
  const isValid = form.name.trim() && form.dateStart && form.dateEnd;

  return (
    <div className="modal-overlay" style={overlayStyle} onClick={onClose}>
      <div className="modal-content" style={modalStyle} onClick={(e) => e.stopPropagation()}>

        <h2 style={{
          fontSize: 15, fontWeight: 700, margin: "0 0 16px",
          color: "var(--text-primary)", letterSpacing: "-0.01em",
        }}>
          Nova conferência
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder="Nome da conferência *"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Início *</p>
              <input
                type="date"
                value={form.dateStart}
                onChange={(e) => set("dateStart", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Fim *</p>
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
          <select
            value={form.region}
            onChange={(e) => set("region", e.target.value)}
            style={inputStyle}
          >
            <option value="">Região (opcional)</option>
            <option value="LATAM">LATAM</option>
            <option value="EUA">EUA</option>
            <option value="Europa">Europa</option>
          </select>
        </div>

        {/* Paleta de cores */}
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Cor de destaque
          </p>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {COLORS.map((c) => (
              <button
                key={c.id}
                title={c.label}
                onClick={() => set("color", c.id)}
                style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: c.border, padding: 0, cursor: "pointer",
                  border: form.color === c.id
                    ? "2px solid var(--text-primary)"
                    : "2px solid transparent",
                  outline: form.color === c.id ? `2px solid ${c.border}55` : "none",
                  outlineOffset: 2,
                  transition: "border-color 0.12s, outline 0.12s",
                }}
              />
            ))}
          </div>
        </div>

        {/* Preview — dark mode */}
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
            Prévia{form.dateStart && form.dateEnd
              ? ` (${form.dateStart.split("-").reverse().join("/")} a ${form.dateEnd.split("-").reverse().join("/")})`
              : ""}
          </p>
          <div style={{
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 6,
              background: preview.pill,
              color: preview.text,
              maxWidth: 180,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {form.name || "Nome da conferência"}
            </div>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>← prévia no calendário</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            style={{ ...saveBtnStyle, opacity: saving || !isValid ? 0.55 : 1 }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
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
  width: 380,
  maxWidth: "92vw",
  fontFamily: "var(--font-ui)",
  maxHeight: "90dvh",
  overflowY: "auto",
};

const inputStyle = {
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid var(--border-strong)",
  borderRadius: 7,
  outline: "none",
  width: "100%",
  fontFamily: "var(--font-ui)",
  color: "var(--text-primary)",
  background: "var(--bg-base)",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
};

const cancelBtnStyle = {
  flex: 1, padding: "8px 0", fontSize: 13,
  border: "1px solid var(--border-strong)", borderRadius: "var(--radius-btn)",
  background: "transparent", cursor: "pointer",
  color: "var(--text-secondary)",
  transition: "border-color 0.15s",
};

const saveBtnStyle = {
  flex: 1, padding: "8px 0", fontSize: 13,
  background: "var(--brand-500)", color: "#fff",
  border: "none", borderRadius: "var(--radius-btn)",
  cursor: "pointer", fontWeight: 600,
  transition: "opacity 0.15s",
};
