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

// ── Encerrar e relatório final ──────────────────────────────────────────────
// Mesmo mínimo do backend (functions/src/config.ts → QUOTA.minUserTurnsForReport):
// com menos falas o relatório seria recusado (too-few-turns).
export const MIN_USER_TURNS_FOR_REPORT = 4;

export function canEndDebate(userTurns) {
  return Number.isInteger(userTurns) && userTurns >= MIN_USER_TURNS_FOR_REPORT;
}

const REPORT_ERRORS = {
  "too-few-turns": `O relatório precisa de pelo menos ${MIN_USER_TURNS_FOR_REPORT} falas suas. Continue o debate e encerre depois.`,
  TRANSCRIPT_INVALIDA: "Não foi possível avaliar esta sessão: as falas foram consideradas insuficientes para um relatório.",
  stale: "A geração do relatório parou no meio do caminho. Tente de novo.",
  blocked: "O relatório foi barrado pelos filtros de segurança.",
  "turn-in-progress": "Aguarde a resposta da última fala antes de encerrar.",
};
const REPORT_FALLBACK = "O relatório não ficou pronto desta vez. Tente de novo em alguns segundos.";

// error: DebateAIError ({ reason, message }) ou o reportError do Firestore ({ reason, detalhe }).
export function reportErrorMessage(error) {
  return REPORT_ERRORS[error?.reason] ?? REPORT_FALLBACK;
}

export const REPORT_CRITERIA_LABELS = [
  ["clarezaArticulacao", "Clareza e articulação"],
  ["argumentacaoLogica", "Argumentação e lógica"],
  ["posturaDiplomatica", "Postura"],
  ["engajamento", "Engajamento"],
  ["conhecimentoTema", "Conhecimento do tema"],
  ["reacaoContraArgumentos", "Reação a contra-argumentos"],
  ["consistenciaPoliticaExterna", "Consistência com a posição do bloco"],
];
