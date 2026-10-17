// Diagnóstico do cache implícito: registra UMA vez por instância (por papel +
// comitê + modelo) quantos tokens tem o prefixo fixo (system prompt + dossiê),
// com aviso quando ficar abaixo do mínimo do cache. Não bloqueia a requisição.

import { logger } from "firebase-functions";
import { CONTEXT, type Role } from "./config.js";
import type { LLMProvider } from "./llm/provider.js";

const logged = new Set<string>();

export interface PrefixInfo {
  role: Role;
  committeeId: string;
  model: string;
  systemInstruction: string;
}

export function logPrefixTokensOnce(provider: LLMProvider, info: PrefixInfo): Promise<void> {
  const key = `${info.role}|${info.committeeId}|${info.model}`;
  if (logged.has(key)) return Promise.resolve();
  logged.add(key);
  return provider
    .countTokens(info.model, info.systemInstruction)
    .then((tokens) => {
      const min = CONTEXT.cachePrefixMinTokens;
      const entry = { role: info.role, committeeId: info.committeeId, model: info.model, tokens, cacheMinTokens: min };
      if (tokens < min) {
        logger.warn("prefix_tokens", {
          ...entry,
          cacheEligible: false,
          hint: `Prefixo fixo com ${tokens} tokens (< ${min}): o cache implícito do Gemini não deve ativar. Aumente o dossiê do comitê.`,
        });
      } else {
        logger.info("prefix_tokens", { ...entry, cacheEligible: true });
      }
    })
    .catch((err) => {
      // Falhou a contagem: tenta de novo numa próxima requisição.
      logged.delete(key);
      logger.warn("prefix_tokens_failed", { role: info.role, committeeId: info.committeeId, model: info.model, kind: err?.kind ?? "other" });
    });
}

// Só para testes.
export function resetPrefixStatsForTests(): void {
  logged.clear();
}
