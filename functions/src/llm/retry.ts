// Retry com backoff exponencial + jitter, seguido de modelo de reserva, tudo
// dentro de um orçamento total de tempo (deadline).

import { LLMError } from "./provider.js";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  // Não inicia tentativa com menos que isto de orçamento restante. A Gemini API
  // recusa (400) deadlines < 10 s, então este é também o timeout mínimo.
  minAttemptMs: number;
}

export interface RetryDeps {
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  now: () => number;
}

export const defaultRetryDeps: RetryDeps = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  random: Math.random,
  now: Date.now,
};

// Espera antes da tentativa `attempt + 1` (attempt começa em 1): 1 s, 2 s, 4 s, 8 s…
export function backoffDelay(attempt: number, policy: Pick<RetryPolicy, "baseDelayMs" | "maxDelayMs" | "jitterRatio">, random: () => number): number {
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
  // Orçamento que ainda resta (ms) — o chamador limita o timeout da tentativa a isto.
  remainingMs: number;
}

export interface FailedAttempt extends AttemptInfo {
  error: LLMError;
}

/**
 * Executa `call` no modelo principal com até `policy.maxAttempts` tentativas;
 * se todas falharem com erro transitório, tenta o `fallbackModel` com até
 * `fallbackAttempts`. Erros não-transitórios (bloqueio, 400, saída parcial já
 * entregue) sobem imediatamente. Nenhuma tentativa ou espera passa do
 * `deadlineMs`: sem orçamento, sobe o último erro (ou um timeout).
 * `fallbackReserveMs` do orçamento fica guardado para o modelo de reserva: o
 * principal não pode consumi-lo (senão um modelo lento esgota tudo e a reserva
 * nunca é tentada).
 */
export async function withRetryAndFallback<T>(
  call: (info: AttemptInfo) => Promise<T>,
  opts: {
    model: string;
    fallbackModel: string | null;
    policy: RetryPolicy;
    fallbackAttempts: number;
    deadlineMs: number;
    fallbackReserveMs?: number;
    deps?: Partial<RetryDeps>;
    onFailedAttempt?: (f: FailedAttempt) => void;
  },
): Promise<{ value: T; info: AttemptInfo }> {
  const deps = { ...defaultRetryDeps, ...opts.deps };
  const startedAt = deps.now();
  const remaining = () => opts.deadlineMs - (deps.now() - startedAt);
  const plan: Array<{ model: string; attempts: number; isFallback: boolean }> = [
    { model: opts.model, attempts: opts.policy.maxAttempts, isFallback: false },
  ];
  if (opts.fallbackModel && opts.fallbackModel !== opts.model && opts.fallbackAttempts > 0) {
    plan.push({ model: opts.fallbackModel, attempts: opts.fallbackAttempts, isFallback: true });
  }

  let lastError: unknown = null;
  for (const [s, step] of plan.entries()) {
    // Orçamento deste passo: o principal deixa a reserva intocada.
    const reserve = s < plan.length - 1 ? (opts.fallbackReserveMs ?? 0) : 0;
    const stepRemaining = () => remaining() - reserve;
    for (let attempt = 1; attempt <= step.attempts; attempt++) {
      const left = stepRemaining();
      if (left < opts.policy.minAttemptMs) break;
      const info: AttemptInfo = { model: step.model, attempt, isFallback: step.isFallback, remainingMs: left };
      try {
        return { value: await call(info), info };
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) throw err;
        opts.onFailedAttempt?.({ ...info, error: err as LLMError });
        if (attempt < step.attempts) {
          const wait = backoffDelay(attempt, opts.policy, deps.random);
          // Esperar mais do que o orçamento permite não adianta.
          if (wait > stepRemaining() - opts.policy.minAttemptMs) break;
          await deps.sleep(wait);
        }
      }
    }
  }
  throw lastError ?? new LLMError("Orçamento de tempo esgotado antes da chamada", { kind: "timeout", retryable: true });
}
