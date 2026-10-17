// Logging estruturado e estimativa de custo. NUNCA registra texto do aluno nem
// do modelo — só metadados (modelo, tokens, latência, custo).

import { logger } from "firebase-functions";
import { FLEX_PRICE_MULTIPLIER, PRICES, type Price, type Role } from "./config.js";
import type { LLMUsage } from "./llm/provider.js";

export function priceFor(model: string, now: Date = new Date()): Price | null {
  // Versões como "gemini-3.1-flash-lite-001" caem no preço do ID base.
  const key = Object.keys(PRICES).find((k) => model === k || model.startsWith(`${k}-`));
  if (!key) return null;
  const today = now.toISOString().slice(0, 10);
  const valid = PRICES[key].filter((p) => p.from <= today);
  return valid[valid.length - 1] ?? null;
}

export function estimateCostUsd(model: string, usage: LLMUsage, serviceTier: string | null, now: Date = new Date()): number {
  const price = priceFor(model, now);
  if (!price) return 0;
  const cached = Math.min(usage.cachedTokens, usage.inputTokens);
  const uncached = usage.inputTokens - cached;
  const output = usage.outputTokens + usage.thoughtsTokens;
  const usd = (uncached * price.input + cached * price.cachedInput + output * price.output) / 1_000_000;
  const multiplier = serviceTier === "flex" ? FLEX_PRICE_MULTIPLIER : 1;
  return round6(usd * multiplier);
}

export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export interface CallLog {
  role: Role;
  model: string;
  attempt: number;
  isFallback: boolean;
  latencyMs: number;
  usage: LLMUsage;
  costUsd: number;
  serviceTier: string | null;
  finishReason: string | null;
  debateId?: string;
}

export function logCall(entry: CallLog): void {
  logger.info("llm_call", { ...entry.usage, ...entry, usage: undefined });
}

export function logFailedAttempt(e: { role: Role; model: string; attempt: number; isFallback: boolean; kind: string; status: number | null; debateId?: string }): void {
  logger.warn("llm_attempt_failed", e);
}

export function logBlocked(e: { role: Role; model: string; reason: string; categories: string[]; debateId?: string }): void {
  logger.warn("llm_blocked", e);
}

export function logCallFailed(e: { role: Role; kind: string; status: number | null; debateId?: string }): void {
  logger.error("llm_call_failed", e);
}

export function logTruncated(e: { role: Role; model: string; outputTokens: number; thoughtsTokens: number; maxOutputTokens: number; debateId?: string }): void {
  logger.warn("llm_truncated", e);
}
