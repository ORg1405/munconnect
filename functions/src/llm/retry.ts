// Retry com backoff exponencial + jitter, seguido de modelo de reserva.

import { LLMError } from "./provider.js";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export interface RetryDeps {
  sleep: (ms: number) => Promise<void>;
  random: () => number;
}

export const defaultRetryDeps: RetryDeps = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  random: Math.random,
};

// Espera antes da tentativa `attempt + 1` (attempt começa em 1): 1 s, 2 s, 4 s, 8 s…
export function backoffDelay(attempt: number, policy: RetryPolicy, random: () => number): number {
  const base = Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
  const jitter = (random() * 2 - 1) * policy.jitterRatio; // [-ratio, +ratio)
  return Math.max(0, Math.round(base * (1 + jitter)));
}

function isRetryable(err: unknown): boolean {
  return err instanceof LLMError && err.retryable && !err.partialOutput;
}

export interface AttemptInfo {
  model: string;
  attempt: number; // 1-based dentro do modelo
  isFallback: boolean;
}

export interface FailedAttempt extends AttemptInfo {
  error: LLMError;
}

/**
 * Executa `call` no modelo principal com até `policy.maxAttempts` tentativas;
 * se todas falharem com erro transitório, tenta o `fallbackModel` com até
 * `fallbackAttempts`. Erros não-transitórios (bloqueio, 400, saída parcial já
 * entregue) sobem imediatamente.
 */
export async function withRetryAndFallback<T>(
  call: (info: AttemptInfo) => Promise<T>,
  opts: {
    model: string;
    fallbackModel: string | null;
    policy: RetryPolicy;
    fallbackAttempts: number;
    deps?: RetryDeps;
    onFailedAttempt?: (f: FailedAttempt) => void;
  },
): Promise<{ value: T; info: AttemptInfo }> {
  const deps = opts.deps ?? defaultRetryDeps;
  const plan: Array<{ model: string; attempts: number; isFallback: boolean }> = [
    { model: opts.model, attempts: opts.policy.maxAttempts, isFallback: false },
  ];
  if (opts.fallbackModel && opts.fallbackModel !== opts.model && opts.fallbackAttempts > 0) {
    plan.push({ model: opts.fallbackModel, attempts: opts.fallbackAttempts, isFallback: true });
  }

  let lastError: unknown;
  for (const step of plan) {
    for (let attempt = 1; attempt <= step.attempts; attempt++) {
      const info: AttemptInfo = { model: step.model, attempt, isFallback: step.isFallback };
      try {
        return { value: await call(info), info };
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) throw err;
        opts.onFailedAttempt?.({ ...info, error: err as LLMError });
        if (attempt < step.attempts) await deps.sleep(backoffDelay(attempt, opts.policy, deps.random));
      }
    }
  }
  throw lastError;
}
