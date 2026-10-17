// Cliente dos callables de IA do Debate Trainer (Cloud Functions debateTurn /
// debateReport). Ainda NÃO é usado pela tela atual — o DebateTrainer continua
// chamando /api/debate até a troca.
//
// sendDebateTurn usa httpsCallable(...).stream(): os pedaços da réplica chegam
// por onChunk; a Promise resolve com o resultado final (texto completo, uso,
// cota restante). Erros viram DebateAIError com mensagem pronta para a UI.

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const debateTurnFn = httpsCallable(functions, "debateTurn");
// O relatório pode levar mais de 1 min (modelo mais forte).
const debateReportFn = httpsCallable(functions, "debateReport", { timeout: 300_000 });

export class DebateAIError extends Error {
  constructor({ code, message, reason, resetsAt, retryAfterSeconds, detalhe }) {
    super(message);
    this.name = "DebateAIError";
    this.code = code; // ex.: "resource-exhausted", "unavailable"
    this.reason = reason; // ex.: "daily-debates", "debate-turns", "cooldown", "model-busy"
    this.resetsAt = resetsAt ? new Date(resetsAt) : null;
    this.retryAfterSeconds = retryAfterSeconds ?? null;
    this.detalhe = detalhe ?? null;
  }

  get isQuota() {
    return this.code === "resource-exhausted";
  }

  get isRetryable() {
    return this.code === "unavailable" || this.reason === "cooldown" || this.reason === "turn-in-progress";
  }
}

const FALLBACK_MESSAGE = "O delegado está formulando a resposta, tente de novo em alguns segundos.";

export function toDebateAIError(err) {
  if (err instanceof DebateAIError) return err;
  const code = String(err?.code || "internal").replace(/^functions\//, "");
  const details = err?.details || {};
  // As mensagens do backend já vêm em português e amigáveis; para erros de
  // rede/SDK sem mensagem útil, usa a mensagem padrão.
  const serverMessage = err?.message && code !== "internal" && code !== "unknown" ? err.message : null;
  return new DebateAIError({
    code,
    message: code === "unauthenticated" ? "Faça login para usar o treino de debate." : serverMessage || FALLBACK_MESSAGE,
    reason: details.reason,
    resetsAt: details.resetsAt,
    retryAfterSeconds: details.retryAfterSeconds,
    detalhe: details.detalhe,
  });
}

/**
 * @param {{ debateId?: string, committeeId: string, userText: string, locale?: string,
 *           setup?: { committeeName?: string, topic: string, userCountry: {code2,name},
 *                     aiDelegation: {code2,name}, difficulty?: string,
 *                     nivelDelegado?: string, simsAnteriores?: number|null } }} input
 *        `setup` só no primeiro turno (sem debateId).
 * @param {{ onChunk?: (text: string) => void, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ debateId, turnIndex, text, model, usedFallback, usage, quota }>}
 */
export async function sendDebateTurn(input, { onChunk, signal } = {}) {
  const payload = {
    debateId: input.debateId ?? null,
    committeeId: input.committeeId,
    userText: input.userText,
    locale: input.locale ?? "pt-BR",
    ...(input.debateId ? {} : { setup: input.setup }),
  };
  try {
    const { stream, data } = await debateTurnFn.stream(payload, { signal });
    for await (const chunk of stream) {
      if (typeof chunk === "string") onChunk?.(chunk);
    }
    return await data;
  } catch (err) {
    throw toDebateAIError(err);
  }
}

/**
 * Relatório final (mesmo formato do antigo /api/evaluate). Chamadas repetidas
 * devolvem o relatório já salvo (`cached: true`).
 * @returns {Promise<{ debateId, report, cached, model?, usage? }>}
 */
export async function requestDebateReport(debateId) {
  try {
    const res = await debateReportFn({ debateId });
    return res.data;
  } catch (err) {
    throw toDebateAIError(err);
  }
}
