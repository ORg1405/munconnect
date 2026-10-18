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
// "config": problema do nosso lado (ex.: GEMINI_API_KEY ausente ou inválida) —
// nunca re-tentado: falha na hora com mensagem clara no log.
export type LLMErrorKind =
  | "rate_limit"
  | "unavailable"
  | "network"
  | "timeout"
  | "blocked"
  | "malformed"
  | "bad_request"
  | "config"
  | "other";

// Diagnóstico de erro sem status HTTP (rede, SDK, configuração): nome,
// mensagem e cause, já sem a chave da API.
export interface ErrorDetail {
  name: string;
  message: string;
  cause: { name?: string; code?: string; message?: string } | null;
}

export class LLMError extends Error {
  readonly kind: LLMErrorKind;
  readonly status: number | null;
  readonly retryable: boolean;
  // Preenchido quando kind = "blocked" (categorias/motivo, nunca o texto).
  readonly blockInfo: { reason: string; categories: string[] } | null;
  // Erro original (sem a chave), para o log de falhas sem status.
  readonly detail: ErrorDetail | null;
  // true se algum chunk já foi entregue ao cliente (impossível re-tentar).
  partialOutput = false;

  constructor(
    message: string,
    opts: {
      kind: LLMErrorKind;
      status?: number | null;
      retryable?: boolean;
      blockInfo?: LLMError["blockInfo"];
      detail?: ErrorDetail | null;
    },
  ) {
    super(message);
    this.name = "LLMError";
    this.kind = opts.kind;
    this.status = opts.status ?? null;
    this.retryable = opts.retryable ?? false;
    this.blockInfo = opts.blockInfo ?? null;
    this.detail = opts.detail ?? null;
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

// Tira a chave de qualquer texto que vá para log.
export function redactSecrets(text: string, secret?: string): string {
  let out = secret ? text.split(secret).join("[redacted]") : text;
  out = out.replace(/AIza[0-9A-Za-z_-]{10,}/g, "AIza…[redacted]").replace(/([?&]key=)[^&\s]+/g, "$1[redacted]");
  return out;
}

export function errorDetail(err: unknown, secret?: string): ErrorDetail {
  const e = err as { name?: string; message?: string; cause?: { name?: string; code?: string; message?: string } };
  const c = e?.cause;
  return {
    name: String(e?.name ?? "Error"),
    message: redactSecrets(String(e?.message ?? err), secret).slice(0, 500),
    cause: c
      ? {
          name: c.name,
          code: typeof c.code === "string" ? c.code : undefined,
          message: c.message ? redactSecrets(String(c.message), secret).slice(0, 500) : undefined,
        }
      : null,
  };
}
