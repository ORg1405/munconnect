// Botão "Contestar" de uma falácia apontada pelo juiz. A contestação só fica
// registrada (debates/{id}/turns/{turnId}.disputes) para calibrar o juiz depois;
// não muda nota nem análise. O texto digitado não se perde em erro.

import { useState } from "react";
import { DISPUTE_MAX_CHARS, DISPUTE_MAX_FALLACIES, contestFallacy } from "../../services/debateAI";
import { GHOST_BTN, INPUT } from "./styles";

export default function DisputeControl({ debateId, turnId, index, existing }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(existing ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (index >= DISPUTE_MAX_FALLACIES) return null;

  if (existing && !open) {
    return (
      <div style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", marginTop: 4 }}>
        Contestação registrada para revisão (a nota não muda): “{existing}”{" "}
        <button onClick={() => setOpen(true)} style={{ ...GHOST_BTN, padding: "1px 8px", fontSize: "var(--fs-tiny)" }}>
          Editar
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...GHOST_BTN, padding: "2px 10px", fontSize: "var(--fs-tiny)", marginTop: 4 }}>
        Contestar esta hipótese
      </button>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await contestFallacy(debateId, turnId, index, text);
      setOpen(false); // o onSnapshot traz `existing` atualizado
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  const tooLong = text.trim().length > DISPUTE_MAX_CHARS;
  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Por que esta não é uma falácia? (fica registrado para revisão do juiz)"
        style={{ ...INPUT, fontSize: "var(--fs-tiny)", resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--fs-tiny)" }}>
        <button
          onClick={save}
          disabled={saving || !text.trim() || tooLong}
          style={{ ...GHOST_BTN, padding: "2px 10px", fontSize: "var(--fs-tiny)", color: "var(--text-primary)", opacity: saving || !text.trim() || tooLong ? 0.5 : 1 }}
        >
          {saving ? "Registrando…" : "Registrar contestação"}
        </button>
        <button onClick={() => setOpen(false)} style={{ ...GHOST_BTN, padding: "2px 10px", fontSize: "var(--fs-tiny)" }}>
          Cancelar
        </button>
        <span style={{ color: tooLong ? "var(--danger)" : "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {text.trim().length}/{DISPUTE_MAX_CHARS}
        </span>
      </div>
      {error && <span style={{ fontSize: "var(--fs-tiny)", color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
