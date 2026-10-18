// Funções PURAS da interface do Debate Trainer (sem React nem Firebase), com
// testes em debateUi.test.js.

// ── Comitês de blocos (ex.: TPI) ────────────────────────────────────────────
// O comitê declara `blocs` em src/data/munCommittees.js; o aluno escolhe um e o
// oponente fica com o outro (o backend recusa blocos iguais).

export function isBlocCommittee(committee) {
  return Array.isArray(committee?.blocs) && committee.blocs.length === 2;
}

export function opposingBloc(committee, userBloc) {
  return committee.blocs.find((b) => b.code2 !== userBloc.code2);
}

// `setup` do callable debateTurn (só vai no primeiro turno).
export function blocDebateSetup({ committee, userBloc, topic, difficulty, nivelDelegado, simsAnteriores }) {
  const aiBloc = opposingBloc(committee, userBloc);
  return {
    committeeName: committee.name,
    topic,
    userCountry: { code2: userBloc.code2, name: userBloc.name },
    aiDelegation: { code2: aiBloc.code2, name: aiBloc.name },
    difficulty,
    nivelDelegado,
    simsAnteriores,
  };
}

// ── Feedback do juiz (rótulos) ──────────────────────────────────────────────
export const RUBRIC_LABELS = [
  ["estrutura", "Estrutura"],
  ["logica", "Lógica"],
  ["evidencia", "Evidência"],
  ["refutacao", "Refutação"],
  ["persuasao", "Persuasão"],
  ["adequacao_comite", "Adequação ao comitê"],
];

// refutacao vem null no turno 1 (ainda não há argumento adverso).
export function formatScore(value) {
  return typeof value === "number" ? `${value}/5` : "—";
}

export const PREMISE_STATUS = {
  sustentada: { label: "Sustentada", color: "var(--success)" },
  fraca: { label: "Fraca", color: "var(--warning)" },
  falsa: { label: "Falsa", color: "var(--danger)" },
  nao_verificavel: { label: "Não verificável", color: "var(--text-muted)" },
};

export const PREMISE_TYPES = { fatual: "fatual", valor: "de valor", inferencial: "inferencial", implicita: "implícita" };

export const FALLACY_TYPES = {
  ataque_pessoal: "Ataque pessoal",
  espantalho: "Espantalho",
  falso_dilema: "Falso dilema",
  apelo_autoridade: "Apelo à autoridade",
  declive_escorregadio: "Declive escorregadio",
  generalizacao_apressada: "Generalização apressada",
  causa_falsa: "Causa falsa",
  outra: "Outra",
};

export const FALLACY_CONFIDENCE = { alta: "alta", media: "média", possivel: "possível" };
