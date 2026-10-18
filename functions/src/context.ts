// Montagem de contexto enviada ao modelo:
//   (a) system prompt fixo + (b) dossiê do comitê  → prefixo ESTÁVEL (cache)
//   (c) resumo do debate + (d) últimos turnos + fala atual → parte variável, no fim
// O histórico inteiro NUNCA é enviado nos turnos (só no relatório final).

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ANALYSIS, CONTEXT } from "./config.js";
import { JUDGE_SYSTEM, JUDGE_TURN } from "./prompts/judge.js";
import { OPPONENT_SYSTEM, OPPONENT_TURN } from "./prompts/opponent.js";
import { REPORT_DOSSIER_BLOCK, REPORT_SYSTEM, REPORT_TURN } from "./prompts/report.js";
import { SUMMARY_SYSTEM, SUMMARY_TURN } from "./prompts/summary.js";
import { render } from "./prompts/template.js";
import { TPI_BLOCS, TPI_JUDGE_SYSTEM, TPI_JUDGE_TURN, TPI_OPPONENT_SYSTEM, TPI_OPPONENT_TURN } from "./prompts/tpi.js";

export interface Delegation {
  code2: string;
  name: string;
}

export interface DebateSetup {
  committeeName: string;
  topic: string;
  userCountry: Delegation;
  aiDelegation: Delegation;
  difficulty: "beginner" | "intermediate" | "advanced";
  nivelDelegado: string;
  simsAnteriores: number | null;
}

export interface TurnRecord {
  index: number;
  userText: string;
  opponentText: string;
}

export interface PromptParts {
  systemInstruction: string;
  userContent: string;
}

// ── Dossiê ───────────────────────────────────────────────────────────────────
// Arquivos em functions/src/dossiers/<committeeId>.md (lidos de src/ tanto no
// código compilado em lib/ quanto nos testes). Sem arquivo → _default.md.
const DOSSIERS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "dossiers");
const SRC_DOSSIERS_DIR = join(dirname(fileURLToPath(import.meta.url)), "dossiers");
const dossierCache = new Map<string, string>();

export const COMMITTEE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function dossiersDir(): string {
  return existsSync(SRC_DOSSIERS_DIR) ? SRC_DOSSIERS_DIR : DOSSIERS_DIR;
}

export function loadDossier(committeeId: string, dir: string = dossiersDir()): string {
  const key = `${dir}::${committeeId}`;
  const cached = dossierCache.get(key);
  if (cached !== undefined) return cached;
  const safeId = COMMITTEE_ID_RE.test(committeeId) ? committeeId : "_default";
  const file = existsSync(join(dir, `${safeId}.md`)) ? join(dir, `${safeId}.md`) : join(dir, "_default.md");
  // Comentários HTML são notas para humanos — não vão ao modelo.
  const text = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
  dossierCache.set(key, text);
  return text;
}

// ── Janela de turnos ─────────────────────────────────────────────────────────
// Normalmente os últimos CONTEXT.windowTurns. Se o resumo estiver atrasado
// (summaryUpTo < início da janela - 1), a janela recua para cobrir os turnos
// ainda não resumidos, até CONTEXT.maxWindowTurns.
export function selectWindow(
  completedTurns: TurnRecord[],
  summaryUpTo: number,
  opts: { windowTurns: number; maxWindowTurns: number } = CONTEXT,
): TurnRecord[] {
  const sorted = [...completedTurns].sort((a, b) => a.index - b.index);
  if (sorted.length === 0) return [];
  const lastIndex = sorted[sorted.length - 1].index;
  const defaultStart = lastIndex - opts.windowTurns + 1;
  const uncoveredStart = summaryUpTo + 1;
  const start = Math.max(Math.min(defaultStart, uncoveredStart), lastIndex - opts.maxWindowTurns + 1, 1);
  return sorted.filter((t) => t.index >= start);
}

export function shouldUpdateSummary(turnIndex: number, every: number = CONTEXT.summaryEveryTurns): boolean {
  return turnIndex > 0 && turnIndex % every === 0;
}

// Turnos 1, 1+N, 1+2N… — o primeiro turno sempre recebe feedback.
export function shouldAnalyzeTurn(turnIndex: number, every: number = ANALYSIS.analyzeEveryTurns): boolean {
  return turnIndex > 0 && (turnIndex - 1) % Math.max(1, every) === 0;
}

const LANGUAGE: Record<string, string> = {
  pt: "português brasileiro",
  en: "English",
  es: "español",
};

export function languageFor(locale: string): string {
  return LANGUAGE[locale.slice(0, 2).toLowerCase()] ?? LANGUAGE.pt;
}

const NO_SUMMARY = "(ainda não há resumo — o debate está no começo)";

export function formatTurns(turns: TurnRecord[], setup: DebateSetup): string {
  if (turns.length === 0) return "(nenhum turno anterior)";
  return turns
    .map(
      (t) =>
        `[Turno ${t.index}] Delegação de ${setup.userCountry.name} (aluno): ${t.userText}\n` +
        `[Turno ${t.index}] Delegação de ${setup.aiDelegation.name}: ${t.opponentText}`,
    )
    .join("\n\n");
}

// ── Prompts por comitê ───────────────────────────────────────────────────────
// Comitê com prompts próprios (ex.: TPI) usa o seu conjunto; os demais usam os
// prompts genéricos de MUN. `blocs`, quando presente, são os únicos papéis
// válidos para aluno e oponente (sempre opostos).
export interface PromptSet {
  opponentSystem: string;
  opponentTurn: string;
  judgeSystem: string;
  judgeTurn: string;
  blocs?: readonly [string, string];
}

const GENERIC_PROMPTS: PromptSet = {
  opponentSystem: OPPONENT_SYSTEM,
  opponentTurn: OPPONENT_TURN,
  judgeSystem: JUDGE_SYSTEM,
  judgeTurn: JUDGE_TURN,
};

const COMMITTEE_PROMPTS: Record<string, PromptSet> = {
  TPI: {
    opponentSystem: TPI_OPPONENT_SYSTEM,
    opponentTurn: TPI_OPPONENT_TURN,
    judgeSystem: TPI_JUDGE_SYSTEM,
    judgeTurn: TPI_JUDGE_TURN,
    blocs: TPI_BLOCS,
  },
};

export function promptsFor(committeeId: string | undefined): PromptSet {
  return (committeeId && COMMITTEE_PROMPTS[committeeId]) || GENERIC_PROMPTS;
}

const NIVEL: Record<DebateSetup["difficulty"], string> = {
  beginner: "iniciante",
  intermediate: "intermediário",
  advanced: "avançado",
};

// Variáveis comuns a todos os templates de turno (render ignora as que o
// template não usa). papel_* / nivel / tema_do_ciclo são os nomes dos prompts
// por comitê; os demais, dos genéricos.
function setupVars(setup: DebateSetup, locale: string, summary: string): Record<string, string> {
  return {
    comite: setup.committeeName,
    topico: setup.topic,
    tema_do_ciclo: setup.topic,
    delegacaoOponente: setup.aiDelegation.name,
    papel_oponente: setup.aiDelegation.name,
    delegacaoAluno: setup.userCountry.name,
    papel_aluno: setup.userCountry.name,
    dificuldade: setup.difficulty,
    nivel: NIVEL[setup.difficulty],
    idioma: languageFor(locale),
    resumo: summary || NO_SUMMARY,
  };
}

// ── Prompts por papel ────────────────────────────────────────────────────────
export function buildOpponentPrompt(args: {
  committeeId?: string;
  dossier: string;
  setup: DebateSetup;
  summary: string;
  window: TurnRecord[];
  userText: string;
  locale: string;
}): PromptParts {
  const prompts = promptsFor(args.committeeId);
  const vars = setupVars(args.setup, args.locale, args.summary);
  return {
    systemInstruction: render(prompts.opponentSystem, { ...vars, dossie: args.dossier }),
    userContent: render(prompts.opponentTurn, {
      ...vars,
      janela: formatTurns(args.window, args.setup),
      fala: args.userText,
    }),
  };
}

export function buildJudgePrompt(args: {
  committeeId?: string;
  dossier: string;
  setup: DebateSetup;
  summary: string;
  turn: TurnRecord;
  locale: string;
}): PromptParts {
  const prompts = promptsFor(args.committeeId);
  const vars = setupVars(args.setup, args.locale, args.summary);
  return {
    systemInstruction: render(prompts.judgeSystem, { ...vars, dossie: args.dossier }),
    userContent: render(prompts.judgeTurn, {
      ...vars,
      turno: String(args.turn.index),
      fala: args.turn.userText,
      replica: args.turn.opponentText,
    }),
  };
}

export function buildSummaryPrompt(args: { setup: DebateSetup; previousSummary: string; newTurns: TurnRecord[] }): PromptParts {
  return {
    systemInstruction: render(SUMMARY_SYSTEM, { alvoTokens: String(CONTEXT.summaryTargetTokens) }),
    userContent: render(SUMMARY_TURN, {
      resumo: args.previousSummary || NO_SUMMARY,
      turnos: formatTurns(args.newTurns, args.setup),
    }),
  };
}

// Relatório: mesma montagem do api/evaluate.js (transcrição inteira, uma vez só).
export function buildReportPrompt(args: { dossier: string; setup: DebateSetup; turns: TurnRecord[] }): PromptParts {
  const { setup } = args;
  const sims = setup.simsAnteriores === null ? "Não informado" : String(setup.simsAnteriores);
  const vars = {
    comite: setup.committeeName,
    topico: setup.topic,
    delegacaoUsuario: setup.userCountry.name,
    delegacaoOponente: setup.aiDelegation.name,
    nivelDelegado: setup.nivelDelegado,
    simsAnteriores: sims,
  };
  const transcricao = [...args.turns]
    .sort((a, b) => a.index - b.index)
    .map((t) => `Delegação ${setup.userCountry.name}: ${t.userText}\nDelegação ${setup.aiDelegation.name}: ${t.opponentText}`)
    .join("\n");
  return {
    systemInstruction: render(REPORT_SYSTEM, vars) + render(REPORT_DOSSIER_BLOCK, { dossie: args.dossier }),
    userContent: render(REPORT_TURN, { ...vars, transcricao }),
  };
}
