// Chama o LLM por PAPEL (opponent, turnAnalysis, summary, report): resolve o
// modelo na config, limita concorrência, aplica retry/fallback e registra uso.

import {
  FLEX_TIMEOUT_MS,
  LLM_MAX_CONCURRENT_PER_INSTANCE,
  LLM_QUEUE_TIMEOUT_MS,
  RETRY,
  ROLES,
  SAFETY_SETTINGS,
  type Role,
} from "../config.js";
import { estimateCostUsd, logBlocked, logCall, logFailedAttempt } from "../telemetry.js";
import { LLMError, type LLMProvider, type LLMRequest, type LLMResult } from "./provider.js";
import { withRetryAndFallback, type RetryDeps } from "./retry.js";
import { Semaphore } from "./semaphore.js";

export const llmSemaphore = new Semaphore(LLM_MAX_CONCURRENT_PER_INSTANCE);

export interface ModelCallResult extends LLMResult {
  costUsd: number;
  latencyMs: number;
  usedFallback: boolean;
}

export interface CallModelOptions {
  role: Role;
  systemInstruction: string;
  userContent: string;
  responseJsonSchema?: Record<string, unknown>;
  // Quando presente, usa streaming e repassa cada pedaço de texto.
  onChunk?: (text: string) => void | Promise<void>;
  debateId?: string;
  retryDeps?: RetryDeps;
}

export async function callModel(provider: LLMProvider, opts: CallModelOptions): Promise<ModelCallResult> {
  const role = ROLES[opts.role];
  const release = await llmSemaphore.acquire(LLM_QUEUE_TIMEOUT_MS);
  try {
    const { value, info } = await withRetryAndFallback(
      async ({ model, isFallback }) => {
        // O modelo de reserva roda sempre no tier standard (Flex não tem garantia).
        const tier = isFallback ? "standard" : role.serviceTier;
        const req: LLMRequest = {
          model,
          systemInstruction: opts.systemInstruction,
          userContent: opts.userContent,
          // Alguns modelos não aceitam "minimal" (ex.: 3.8 Flash) — usa "low".
          thinkingLevel: role.thinkingLevel === "minimal" && !supportsMinimal(model) ? "low" : role.thinkingLevel,
          maxOutputTokens: role.maxOutputTokens,
          temperature: role.temperature,
          responseJsonSchema: opts.responseJsonSchema,
          safetySettings: SAFETY_SETTINGS,
          serviceTier: tier,
          timeoutMs: tier === "flex" ? FLEX_TIMEOUT_MS : role.timeoutMs,
        };
        const t0 = Date.now();
        const result = opts.onChunk ? await provider.stream(req, opts.onChunk) : await provider.generate(req);
        return { result, latencyMs: Date.now() - t0 };
      },
      {
        model: role.model,
        fallbackModel: role.fallbackModel,
        policy: RETRY,
        fallbackAttempts: RETRY.fallbackMaxAttempts,
        deps: opts.retryDeps,
        onFailedAttempt: (f) =>
          logFailedAttempt({
            role: opts.role,
            model: f.model,
            attempt: f.attempt,
            isFallback: f.isFallback,
            kind: f.error.kind,
            status: f.error.status,
            debateId: opts.debateId,
          }),
      },
    );
    const { result, latencyMs } = value;
    const costUsd = estimateCostUsd(info.model, result.usage, result.serviceTier);
    logCall({
      role: opts.role,
      model: result.model,
      attempt: info.attempt,
      isFallback: info.isFallback,
      latencyMs,
      usage: result.usage,
      costUsd,
      serviceTier: result.serviceTier,
      finishReason: result.finishReason,
      debateId: opts.debateId,
    });
    return { ...result, costUsd, latencyMs, usedFallback: info.isFallback };
  } catch (err) {
    if (err instanceof LLMError && err.kind === "blocked" && err.blockInfo) {
      logBlocked({ role: opts.role, model: role.model, ...err.blockInfo, debateId: opts.debateId });
    }
    throw err;
  } finally {
    release();
  }
}

function supportsMinimal(model: string): boolean {
  return model.includes("flash-lite");
}
