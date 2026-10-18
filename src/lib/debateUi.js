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

// ── Cota e erros do debate ──────────────────────────────────────────────────
// Espelham functions/src/config.ts → QUOTA (há teste conferindo). O servidor é
// quem decide; aqui é só para a mensagem e a contagem regressiva ao vivo.
export const QUOTA_LIMITS = { debatesPerDay: 3, turnsPerDebate: 12, minSecondsBetweenTurns: 20 };
export const QUOTA_TIME_ZONE = "America/Sao_Paulo";
const TIME_ZONE_LABEL = "horário de Brasília";

const FORMULATING_MESSAGE = "O delegado está formulando a resposta. Sua fala continua na caixa: envie de novo em alguns segundos.";

// 45 s · 7 min · 2 h · 3 h 5 min (arredonda para cima: nunca promete antes da hora).
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// "à meia-noite (horário de Brasília), daqui a 6 h" · "às 14:30 (horário de Brasília), daqui a 20 min"
export function formatResetTime(resetsAt, now = new Date(), timeZone = QUOTA_TIME_ZONE) {
  const at = resetsAt instanceof Date ? resetsAt : new Date(resetsAt);
  if (Number.isNaN(at.getTime())) return "";
  const hhmm = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  const when = hhmm === "00:00" ? "à meia-noite" : `às ${hhmm}`;
  return `${when} (${TIME_ZONE_LABEL}), daqui a ${formatDuration(at.getTime() - now.getTime())}`;
}

// Segundos até poder falar de novo (0 = liberado).
export function secondsUntil(at, now = new Date()) {
  if (!at) return 0;
  const t = (at instanceof Date ? at : new Date(at)).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.ceil((t - now.getTime()) / 1000));
}

// Mensagem de cota em português (null se o erro não for de cota/trava de turno).
export function quotaMessage(err, now = new Date()) {
  switch (err?.reason) {
    case "daily-debates":
      return (
        `Você já usou seus ${QUOTA_LIMITS.debatesPerDay} debates de hoje. ` +
        (err.resetsAt ? `Sua cota renova ${formatResetTime(err.resetsAt, now)}.` : "Sua cota renova à meia-noite.")
      );
    case "debate-turns":
      return `Este debate chegou ao limite de ${QUOTA_LIMITS.turnsPerDebate} falas. Encerre a sessão para receber seu relatório ou comece um novo debate.`;
    case "cooldown": {
      const s = err.resetsAt ? secondsUntil(err.resetsAt, now) : (err.retryAfterSeconds ?? QUOTA_LIMITS.minSecondsBetweenTurns);
      return s > 0
        ? `Respire e prepare o próximo argumento: você poderá falar de novo em ${s} s.`
        : "Pronto: você já pode enviar sua fala.";
    }
    case "turn-in-progress":
      return "A delegação ainda está respondendo à sua fala anterior. Aguarde a resposta antes de enviar outra.";
    default:
      return null;
  }
}

// Qualquer erro do envio → mensagem para o aluno, nunca o texto técnico.
// tone: "quota" | "busy" | "blocked" | "error" (a tela escolhe a cor).
export function turnErrorMessage(err, now = new Date()) {
  const quota = quotaMessage(err, now);
  if (quota) return { tone: "quota", message: quota };
  if (err?.reason === "blocked") {
    return { tone: "blocked", message: "Essa troca foi barrada pelos filtros de segurança. Reformule sua fala e tente de novo." };
  }
  if (err?.code === "unauthenticated") return { tone: "error", message: "Faça login com sua conta para usar o treino de debate." };
  if (err?.code === "invalid-argument") {
    return { tone: "error", message: "Não foi possível enviar esta fala. Revise o texto (até 2.000 caracteres) e tente de novo." };
  }
  return { tone: "busy", message: FORMULATING_MESSAGE };
}

export const PEDAGOGICAL_NOTICE =
  "Exercício pedagógico: o oponente defende a posição processual do bloco dele, não uma opinião sobre o caso real. " +
  "O feedback é automático e pode errar.";
