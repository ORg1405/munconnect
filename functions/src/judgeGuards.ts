// Guardas em código sobre a saída do juiz (análise por turno). O schema garante
// a forma; estas regras corrigem o que o modelo erra com frequência:
//   - falácia cujo trecho não está na fala do estudante nem do oponente → descartada
//     (log judge_trecho_invalido, sem conteúdo);
//   - premissa de valor marcada "falsa" → "fraca";
//   - "falsa" sem evidencia_dossie → "nao_verificavel";
//   - falácia tipo "outra" → confianca no máximo "possivel";
//   - turno 1 → refutacao = null (não há argumento adverso a refutar);
//   - fala sem fonte específica → todas as notas da rubrica limitadas a 3.

import { logger } from "firebase-functions";
import { RUBRIC_KEYS, type TurnAnalysis } from "./schemas/turnAnalysis.js";

// Nota máxima quando a fala do estudante não cita fonte específica.
export const MAX_SCORE_WITHOUT_SOURCE = 3;

// HEURÍSTICA (não é verificação jurídica): a fala "cita fonte específica" se
// tiver número de artigo, regra ou resolução, ou citação nominal de decisão —
// uma palavra de decisão (decisão, acórdão, sentença, Câmara, caso, mandado)
// seguida, na mesma frase, de uma data ou de um nome próprio. Não confere se a
// fonte existe nem se está no dossiê; falso positivo/negativo é esperado em
// falas fora desse padrão (ex.: "como decidiu a Câmara" sem data nem nome não conta).
const NUMBERED_SOURCE_RE = [/\bart(igo)?s?\.?\s*\d+/i, /\bregra\s*\d+/i, /\bresolu[cç][aã]o\s*(n[º°o.]*\s*)?\d+/i];
const DECISION_RE =
  /(?<![\p{L}])([Dd]ecis[ãa]o|[Aa]c[óo]rd[ãa]o|[Ss]enten[çc]a|[Cc][âa]mara|[Cc]aso|[Mm]andado)(?![\p{L}])[^.;!?]{0,80}?(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}º?\s+de\s+[a-zç]+\s+de\s+\d{4}|\s[A-ZÀ-Ú][\p{L}-]+)/u;

export function citesSpecificSource(text: string): boolean {
  return NUMBERED_SOURCE_RE.some((re) => re.test(text)) || DECISION_RE.test(text);
}

// Minúsculas, pontuação e símbolos viram espaço, espaços colapsados.
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// O trecho pode vir com reticências no meio ("A questão... é objeto"): cada
// pedaço tem de aparecer, na ordem, no mesmo texto.
export function quoteAppearsIn(quote: string, source: string): boolean {
  const hay = normalizeForMatch(source);
  const parts = quote.split(/\.{3,}|…/).map(normalizeForMatch).filter(Boolean);
  if (parts.length === 0) return false;
  let from = 0;
  for (const part of parts) {
    const at = hay.indexOf(part, from);
    if (at < 0) return false;
    from = at + part.length;
  }
  return true;
}

// Lança se o texto não for um JSON com as chaves obrigatórias — usado como
// `validate` no callModel (JSON inválido conta como resposta transitória).
export function parseTurnAnalysis(text: string): TurnAnalysis {
  const data = JSON.parse(text) as TurnAnalysis;
  if (!data || typeof data !== "object") throw new Error("análise não é objeto");
  for (const key of ["argumento_estudante", "falacias", "rubrica", "melhorias_prioritarias"] as const) {
    if (data[key] === undefined || data[key] === null) throw new Error(`análise sem ${key}`);
  }
  if (!Array.isArray(data.falacias) || !Array.isArray(data.argumento_estudante.premissas)) throw new Error("análise com listas inválidas");
  return data;
}

export interface GuardContext {
  turnIndex: number;
  userText: string;
  opponentText: string;
  debateId?: string;
}

export interface GuardReport {
  fallaciesDropped: number;
  valueFalseToWeak: number;
  falseWithoutEvidence: number;
  otherFallacyDowngraded: number;
  refutacaoNulled: boolean;
  // Heurística citesSpecificSource: false → notas limitadas a MAX_SCORE_WITHOUT_SOURCE.
  citesSource: boolean;
  scoresCapped: number;
}

export function applyJudgeGuards(analysis: TurnAnalysis, ctx: GuardContext): { analysis: TurnAnalysis; report: GuardReport } {
  const report: GuardReport = {
    fallaciesDropped: 0,
    valueFalseToWeak: 0,
    falseWithoutEvidence: 0,
    otherFallacyDowngraded: 0,
    refutacaoNulled: false,
    citesSource: citesSpecificSource(ctx.userText),
    scoresCapped: 0,
  };

  const falacias = analysis.falacias
    .filter((f) => {
      const ok = quoteAppearsIn(f.trecho ?? "", ctx.userText) || quoteAppearsIn(f.trecho ?? "", ctx.opponentText);
      if (!ok) {
        report.fallaciesDropped++;
        logger.warn("judge_trecho_invalido", { debateId: ctx.debateId, turnIndex: ctx.turnIndex, lado: f.lado, tipo: f.tipo });
      }
      return ok;
    })
    .map((f) => {
      if (f.tipo !== "outra" || f.confianca === "possivel") return f;
      report.otherFallacyDowngraded++;
      return { ...f, confianca: "possivel" as const };
    });

  const premissas = analysis.argumento_estudante.premissas.map((p) => {
    if (p.status !== "falsa") return p;
    if (p.tipo === "valor") {
      report.valueFalseToWeak++;
      return { ...p, status: "fraca" as const };
    }
    if (!p.evidencia_dossie?.trim()) {
      report.falseWithoutEvidence++;
      return { ...p, status: "nao_verificavel" as const };
    }
    return p;
  });

  const rubrica = { ...analysis.rubrica };
  if (ctx.turnIndex <= 1) {
    report.refutacaoNulled = rubrica.refutacao !== null;
    rubrica.refutacao = null;
  }
  if (!report.citesSource) {
    for (const key of RUBRIC_KEYS) {
      const v = rubrica[key];
      if (typeof v === "number" && v > MAX_SCORE_WITHOUT_SOURCE) {
        rubrica[key] = MAX_SCORE_WITHOUT_SOURCE;
        report.scoresCapped++;
      }
    }
  }

  return {
    analysis: { ...analysis, falacias, rubrica, argumento_estudante: { ...analysis.argumento_estudante, premissas } },
    report,
  };
}

