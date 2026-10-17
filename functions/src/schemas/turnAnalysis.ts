// Schema PROVISÓRIO da análise por turno (o schema completo vem na próxima fase).
// Passado ao Gemini como responseJsonSchema.

const rubricItem = { type: "integer", minimum: 0, maximum: 5 };

export const TURN_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    alegacao: { type: "string", description: "Alegação central da fala, em uma frase." },
    premissas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          texto: { type: "string" },
          tipo: { type: "string", description: "Ex.: factual, causal, valorativa, normativa." },
          status: { type: "string", enum: ["sustentada", "nao_sustentada", "nao_verificavel"] },
        },
        required: ["texto", "tipo", "status"],
        additionalProperties: false,
      },
    },
    falacias: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string" },
          trecho: { type: "string", description: "Trecho literal da fala." },
          confianca: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["tipo", "trecho", "confianca"],
        additionalProperties: false,
      },
    },
    rubrica: {
      type: "object",
      properties: {
        estrutura: rubricItem,
        logica: rubricItem,
        evidencia: rubricItem,
        refutacao: rubricItem,
        persuasao: rubricItem,
      },
      required: ["estrutura", "logica", "evidencia", "refutacao", "persuasao"],
      additionalProperties: false,
    },
    melhorias: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
  required: ["alegacao", "premissas", "falacias", "rubrica", "melhorias"],
  additionalProperties: false,
} as const;

export interface TurnAnalysis {
  alegacao: string;
  premissas: Array<{ texto: string; tipo: string; status: "sustentada" | "nao_sustentada" | "nao_verificavel" }>;
  falacias: Array<{ tipo: string; trecho: string; confianca: number }>;
  rubrica: { estrutura: number; logica: number; evidencia: number; refutacao: number; persuasao: number };
  melhorias: string[];
}
