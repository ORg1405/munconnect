// src/data/conferenceModel.js
// ─────────────────────────────────────────────────────────────────────────────
// Lógica pura da simulação (sem dados mockados nem Firestore). Fica aqui para
// sobreviver à remoção do mock — tanto as telas quanto a camada de Firestore
// importam STATUS e computeProgress daqui.
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS = {
  complete: {
    label: "Completo",
    color: "var(--success)",
    bg: "hsl(160 70% 50% / 0.12)",
    border: "hsl(160 70% 50% / 0.3)",
    weight: 1,
  },
  needs_revision: {
    label: "Precisa de revisão",
    suffix: "*",
    color: "var(--warning)",
    bg: "hsl(38 95% 60% / 0.12)",
    border: "hsl(38 95% 60% / 0.3)",
    weight: 0.5,
  },
  incomplete: {
    label: "Incompleto",
    color: "var(--text-muted)",
    bg: "hsl(220 8% 50% / 0.12)",
    border: "hsl(220 8% 50% / 0.3)",
    weight: 0,
  },
};

// Ordem dos status no ciclo de edição do diretor (clicar avança para o próximo).
export const STATUS_CYCLE = ["incomplete", "needs_revision", "complete"];

// progresso = (complete × 1 + needs_revision × 0.5) / total de subitems
// Recebe um array plano de subitems: [{ status }, ...]
export function computeProgress(subitems = []) {
  if (subitems.length === 0) return { ratio: 0, counts: emptyCounts(), total: 0 };

  const counts = emptyCounts();
  let score = 0;
  for (const s of subitems) {
    const status = STATUS[s.status] ? s.status : "incomplete";
    counts[status] += 1;
    score += STATUS[status].weight;
  }
  return { ratio: score / subitems.length, counts, total: subitems.length };
}

function emptyCounts() {
  return { complete: 0, needs_revision: 0, incomplete: 0 };
}
