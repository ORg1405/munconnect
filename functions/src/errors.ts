// Converte erros internos em HttpsError com mensagem amigável em português.

import { logger } from "firebase-functions";
import { HttpsError } from "firebase-functions/v2/https";
import { LLMError } from "./llm/provider.js";
import { SemaphoreTimeoutError } from "./llm/semaphore.js";
import type { QuotaViolation } from "./quota.js";

export const MODEL_BUSY_MESSAGE = "O delegado está formulando a resposta, tente de novo em alguns segundos.";

export function quotaError(v: QuotaViolation): HttpsError {
  const code = v.reason === "turn-in-progress" ? "failed-precondition" : "resource-exhausted";
  return new HttpsError(code, v.message, {
    reason: v.reason,
    resetsAt: v.resetsAt,
    retryAfterSeconds: v.retryAfterSeconds,
  });
}

export function toHttpsError(err: unknown, context: string): HttpsError {
  if (err instanceof HttpsError) return err;
  if (err instanceof LLMError) {
    // Configuração do servidor (ex.: GEMINI_API_KEY inválida): o aluno vê a
    // mensagem padrão; o log e `details` dizem o que ajustar (sem a chave).
    if (err.kind === "config") {
      logger.error(`${context}_config_error`, { message: err.message, detail: err.detail });
      return new HttpsError("internal", MODEL_BUSY_MESSAGE, { reason: "config", kind: err.kind, detalhe: err.message });
    }
    if (err.kind === "blocked") {
      return new HttpsError(
        "failed-precondition",
        "Essa troca foi barrada pelos filtros de segurança. Reformule sua fala e tente de novo.",
        { reason: "blocked" },
      );
    }
    if (err.retryable || err.kind === "other") {
      return new HttpsError("unavailable", MODEL_BUSY_MESSAGE, { reason: "model-busy", kind: err.kind });
    }
  }
  if (err instanceof SemaphoreTimeoutError) {
    return new HttpsError("unavailable", MODEL_BUSY_MESSAGE, { reason: "model-busy" });
  }
  logger.error(`${context}_unexpected_error`, { message: err instanceof Error ? err.message : String(err) });
  return new HttpsError("internal", MODEL_BUSY_MESSAGE, { reason: "internal" });
}
