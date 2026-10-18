// Implementação LLMProvider para a Gemini API (SDK oficial @google/genai).

import { GoogleGenAI, type GenerateContentConfig, type GenerateContentResponse } from "@google/genai";
import { LLMError, emptyUsage, errorDetail, redactSecrets, type LLMProvider, type LLMRequest, type LLMResult, type LLMUsage } from "./provider.js";

const THINKING_LEVEL = { minimal: "MINIMAL", low: "LOW", medium: "MEDIUM", high: "HIGH" } as const;

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly ai: GoogleGenAI;
  private readonly apiKey: string;

  // Chave inválida falha AQUI, na hora: sem isso o fetch recusa o cabeçalho e
  // o erro parecia "network" (6 tentativas inúteis).
  constructor(apiKey: string | undefined) {
    const problem = apiKeyProblem(apiKey);
    if (problem) throw new LLMError(`GEMINI_API_KEY ${problem}`, { kind: "config" });
    this.apiKey = apiKey!;
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
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
      throw toLLMError(err, this.apiKey);
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
      throw toLLMError(err, this.apiKey);
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
      const e = toLLMError(err, this.apiKey);
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

// Problema de formato da chave (null = ok). Uma chave da Gemini API é ASCII
// imprimível, sem espaços; qualquer outra coisa o fetch recusa como cabeçalho.
export function apiKeyProblem(key: string | undefined): string | null {
  if (key === undefined || key === null) return "ausente: defina o secret (no emulador, functions/.secret.local).";
  if (!key.trim()) return "vazia: defina o secret (no emulador, functions/.secret.local).";
  if (/[^\x21-\x7e]/.test(key)) {
    return (
      `inválida: ${key.length} caractere(s), com caractere de controle, espaço ou não ASCII ` +
      "(ex.: Ctrl+V gravado no lugar da chave colada). Regrave o secret com a chave do AI Studio."
    );
  }
  return null;
}

export function toLLMError(err: unknown, secret?: string): LLMError {
  if (err instanceof LLMError) return err;
  const anyErr = err as { status?: number; code?: number; name?: string; message?: string; cause?: { code?: string; message?: string } };
  const status = typeof anyErr?.status === "number" ? anyErr.status : typeof anyErr?.code === "number" ? anyErr.code : null;
  const message = redactSecrets(String(anyErr?.message ?? err), secret);
  const detail = status === null ? errorDetail(err, secret) : null;
  // fetch (undici) recusou montar a requisição — ex.: cabeçalho x-goog-api-key
  // com caractere inválido. Nada saiu para a rede: é configuração, não re-tenta.
  if (status === null && (anyErr?.cause?.code === "UND_ERR_INVALID_ARG" || /invalid .*header/i.test(String(anyErr?.cause?.message ?? "")))) {
    return new LLMError(`Requisição recusada antes de sair (configuração): ${detail?.cause?.message ?? message}`, { kind: "config", detail });
  }
  if (status === 429) return new LLMError(message, { detail, kind: "rate_limit", status, retryable: true });
  if (status === 503) return new LLMError(message, { detail, kind: "unavailable", status, retryable: true });
  // httpOptions.timeout também vira deadline no servidor: estourou → 504 DEADLINE_EXCEEDED.
  if (status === 504) return new LLMError(message, { detail, kind: "timeout", status, retryable: true });
  if (status === 400 || status === 404) return new LLMError(message, { detail, kind: "bad_request", status });
  if (anyErr?.name === "AbortError" || /timed? ?out|aborted/i.test(message)) {
    return new LLMError(message, { detail, kind: "timeout", status, retryable: true });
  }
  if (status === null && /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(message)) {
    return new LLMError(message, { detail, kind: "network", retryable: true });
  }
  return new LLMError(message, { detail, kind: "other", status });
}

// A API devolve usageMetadata.serviceTier ("standard" | "flex"), mas o tipo do
// SDK não declara o campo.
function readServiceTier(res: GenerateContentResponse): string | null {
  return (res.usageMetadata as { serviceTier?: string } | undefined)?.serviceTier ?? null;
}
