// Implementação LLMProvider para a Gemini API (SDK oficial @google/genai).

import { GoogleGenAI, type GenerateContentConfig, type GenerateContentResponse } from "@google/genai";
import { LLMError, emptyUsage, type LLMProvider, type LLMRequest, type LLMResult, type LLMUsage } from "./provider.js";

const THINKING_LEVEL = { minimal: "MINIMAL", low: "LOW", medium: "MEDIUM", high: "HIGH" } as const;

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(req: LLMRequest): Promise<LLMResult> {
    let res: GenerateContentResponse;
    try {
      res = await this.ai.models.generateContent({
        model: req.model,
        contents: req.userContent,
        config: buildConfig(req),
      });
    } catch (err) {
      throw toLLMError(err);
    }
    const text = res.text ?? "";
    assertNotBlocked(res, text);
    assertUsable(res.candidates?.[0]?.finishReason ?? null, text);
    return {
      text,
      usage: readUsage(res),
      model: res.modelVersion ?? req.model,
      finishReason: res.candidates?.[0]?.finishReason ?? null,
      serviceTier: readServiceTier(res),
    };
  }

  async countTokens(model: string, text: string): Promise<number> {
    try {
      const res = await this.ai.models.countTokens({ model, contents: text });
      return res.totalTokens ?? 0;
    } catch (err) {
      throw toLLMError(err);
    }
  }

  async stream(req: LLMRequest, onChunk: (text: string) => void | Promise<void>): Promise<LLMResult> {
    let text = "";
    let last: GenerateContentResponse | null = null;
    let usage: LLMUsage = emptyUsage();
    let delivered = false;
    try {
      const stream = await this.ai.models.generateContentStream({
        model: req.model,
        contents: req.userContent,
        config: buildConfig(req),
      });
      for await (const chunk of stream) {
        last = chunk;
        if (chunk.usageMetadata) usage = readUsage(chunk);
        const piece = chunk.text ?? "";
        if (piece) {
          text += piece;
          delivered = true;
          await onChunk(piece);
        }
      }
    } catch (err) {
      const e = toLLMError(err);
      e.partialOutput = delivered;
      throw e;
    }
    if (last) assertNotBlocked(last, text);
    // Nada entregue → dá para re-tentar. Com texto já entregue, um finishReason
    // estranho não é re-tentado (o aluno já viu a réplica); fica no log llm_call.
    if (!text.trim()) assertUsable(last?.candidates?.[0]?.finishReason ?? null, text);
    return {
      text,
      usage,
      model: last?.modelVersion ?? req.model,
      finishReason: last?.candidates?.[0]?.finishReason ?? null,
      serviceTier: last ? readServiceTier(last) : null,
    };
  }
}

function buildConfig(req: LLMRequest): GenerateContentConfig {
  const config: GenerateContentConfig = {
    systemInstruction: req.systemInstruction,
    temperature: req.temperature,
    maxOutputTokens: req.maxOutputTokens,
    safetySettings: req.safetySettings as GenerateContentConfig["safetySettings"],
  };
  if (req.thinkingLevel) {
    config.thinkingConfig = { thinkingLevel: THINKING_LEVEL[req.thinkingLevel] as never };
  }
  if (req.responseJsonSchema) {
    config.responseMimeType = "application/json";
    config.responseJsonSchema = req.responseJsonSchema;
  }
  if (req.serviceTier === "flex") config.serviceTier = "flex" as never;
  if (req.timeoutMs) config.httpOptions = { timeout: req.timeoutMs };
  return config;
}

function readUsage(res: GenerateContentResponse): LLMUsage {
  const u = res.usageMetadata;
  return {
    inputTokens: u?.promptTokenCount ?? 0,
    outputTokens: u?.candidatesTokenCount ?? 0,
    thoughtsTokens: u?.thoughtsTokenCount ?? 0,
    cachedTokens: u?.cachedContentTokenCount ?? 0,
  };
}

// Bloqueio pode vir no prompt (promptFeedback) ou na resposta (finishReason).
function assertNotBlocked(res: GenerateContentResponse, text: string): void {
  const promptBlock = res.promptFeedback?.blockReason;
  const cand = res.candidates?.[0];
  const finish = cand?.finishReason;
  const blockedFinish = finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || finish === "BLOCKLIST" || finish === "SPII";
  if (!promptBlock && !(blockedFinish && !text)) return;
  const ratings = cand?.safetyRatings ?? res.promptFeedback?.safetyRatings ?? [];
  const categories = ratings.filter((r) => r.blocked || r.probability === "HIGH").map((r) => String(r.category));
  throw new LLMError("Resposta bloqueada pelos filtros de segurança", {
    kind: "blocked",
    blockInfo: { reason: String(promptBlock ?? finish), categories },
  });
}

// Só STOP e MAX_TOKENS (truncamento, tratado pelo router) são finais esperados.
const EXPECTED_FINISH = new Set(["STOP", "MAX_TOKENS"]);

export function assertUsable(finishReason: string | null, text: string): void {
  if (text.trim() && (finishReason === null || EXPECTED_FINISH.has(finishReason))) return;
  throw new LLMError(`Resposta inutilizável (finishReason ${finishReason ?? "ausente"}, ${text.trim() ? "com" : "sem"} texto)`, {
    kind: "malformed",
    retryable: true,
  });
}

export function toLLMError(err: unknown): LLMError {
  if (err instanceof LLMError) return err;
  const anyErr = err as { status?: number; code?: number; name?: string; message?: string };
  const status = typeof anyErr?.status === "number" ? anyErr.status : typeof anyErr?.code === "number" ? anyErr.code : null;
  const message = String(anyErr?.message ?? err);
  if (status === 429) return new LLMError(message, { kind: "rate_limit", status, retryable: true });
  if (status === 503) return new LLMError(message, { kind: "unavailable", status, retryable: true });
  // httpOptions.timeout também vira deadline no servidor: estourou → 504 DEADLINE_EXCEEDED.
  if (status === 504) return new LLMError(message, { kind: "timeout", status, retryable: true });
  if (status === 400 || status === 404) return new LLMError(message, { kind: "bad_request", status });
  if (anyErr?.name === "AbortError" || /timed? ?out|aborted/i.test(message)) {
    return new LLMError(message, { kind: "timeout", status, retryable: true });
  }
  if (status === null && /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(message)) {
    return new LLMError(message, { kind: "network", retryable: true });
  }
  return new LLMError(message, { kind: "other", status });
}

// A API devolve usageMetadata.serviceTier ("standard" | "flex"), mas o tipo do
// SDK não declara o campo.
function readServiceTier(res: GenerateContentResponse): string | null {
  return (res.usageMetadata as { serviceTier?: string } | undefined)?.serviceTier ?? null;
}
