// Interface neutra de provedor de LLM. Hoje só existe a implementação Gemini
// (gemini.ts); outro provedor só precisa implementar LLMProvider e mapear seus
// erros para LLMError.

export interface SafetySetting {
  category: string;
  threshold: string;
}

export interface LLMRequest {
  model: string;
  // Prefixo fixo (system prompt + dossiê) — mantido estável para cache.
  systemInstruction: string;
  // Parte variável (resumo, janela de turnos, fala atual) — sempre no fim.
  userContent: string;
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
  maxOutputTokens?: number;
  temperature?: number;
  // JSON Schema da saída estruturada (quando presente, a resposta é JSON).
  responseJsonSchema?: Record<string, unknown>;
  safetySettings?: SafetySetting[];
  serviceTier?: "standard" | "flex";
  timeoutMs?: number;
}

export interface LLMUsage {
  inputTokens: number; // inclui os tokens cacheados
  outputTokens: number; // resposta visível
  thoughtsTokens: number; // raciocínio (cobrado como saída)
  cachedTokens: number;
}

export interface LLMResult {
  text: string;
  usage: LLMUsage;
  model: string;
  finishReason: string | null;
  serviceTier: string | null;
}

// "malformed": resposta inutilizável (vazia, MALFORMED_RESPONSE, finishReason
// inesperado, JSON inválido) — transitória: retry e depois reserva.
export type LLMErrorKind = "rate_limit" | "unavailable" | "network" | "timeout" | "blocked" | "malformed" | "bad_request" | "other";

export class LLMError extends Error {
  readonly kind: LLMErrorKind;
  readonly status: number | null;
  readonly retryable: boolean;
  // Preenchido quando kind = "blocked" (categorias/motivo, nunca o texto).
  readonly blockInfo: { reason: string; categories: string[] } | null;
  // true se algum chunk já foi entregue ao cliente (impossível re-tentar).
  partialOutput = false;

  constructor(
    message: string,
    opts: { kind: LLMErrorKind; status?: number | null; retryable?: boolean; blockInfo?: LLMError["blockInfo"] },
  ) {
    super(message);
    this.name = "LLMError";
    this.kind = opts.kind;
    this.status = opts.status ?? null;
    this.retryable = opts.retryable ?? false;
    this.blockInfo = opts.blockInfo ?? null;
  }
}

export interface LLMProvider {
  readonly name: string;
  generate(req: LLMRequest): Promise<LLMResult>;
  // onChunk recebe cada pedaço de texto visível à medida que chega.
  stream(req: LLMRequest, onChunk: (text: string) => void | Promise<void>): Promise<LLMResult>;
  // Conta tokens de um texto no tokenizador do modelo (diagnóstico do prefixo).
  countTokens(model: string, text: string): Promise<number>;
}

export function emptyUsage(): LLMUsage {
  return { inputTokens: 0, outputTokens: 0, thoughtsTokens: 0, cachedTokens: 0 };
}
