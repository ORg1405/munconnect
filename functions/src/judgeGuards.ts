// Guardas em código sobre a saída do juiz (análise por turno). O schema garante
// a forma; estas regras corrigem o que o modelo erra com frequência:
//   - falácia cujo trecho não está na fala do estudante nem do oponente → descartada
//     (log judge_trecho_invalido, sem conteúdo);
//   - premissa de valor marcada "falsa" → "fraca";
//   - "falsa" sem evidencia_dossie → "nao_verificavel";
//   - turno 1 → refutacao = null (não há argumento adverso a refutar).

import { logger } from "firebase-functions";
import type { TurnAnalysis } from "./schemas/turnAnalysis.js";

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
  refutacaoNulled: boolean;
}

export function applyJudgeGuards(analysis: TurnAnalysis, ctx: GuardContext): { analysis: TurnAnalysis; report: GuardReport } {
  const report: GuardReport = { fallaciesDropped: 0, valueFalseToWeak: 0, falseWithoutEvidence: 0, refutacaoNulled: false };

  const falacias = analysis.falacias.filter((f) => {
    const ok = quoteAppearsIn(f.trecho ?? "", ctx.userText) || quoteAppearsIn(f.trecho ?? "", ctx.opponentText);
    if (!ok) {
      report.fallaciesDropped++;
      logger.warn("judge_trecho_invalido", { debateId: ctx.debateId, turnIndex: ctx.turnIndex, lado: f.lado, tipo: f.tipo });
    }
    return ok;
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

  return {
    analysis: { ...analysis, falacias, rubrica, argumento_estudante: { ...analysis.argumento_estudante, premissas } },
    report,
  };
}

