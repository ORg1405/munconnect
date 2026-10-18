// Schema da análise por turno (juiz). Fonte: docs/prompts-tpi.md, seção 3.
// Passado ao Gemini como responseJsonSchema. Adaptações ao original:
// additionalProperties: false em cada objeto (mesma convenção dos outros
// schemas) e rubrica.refutacao nullable (null no turno 1; ver judgeGuards.ts).
// Enums, limites da rubrica e maxItems: 3 nas melhorias são os do original.

const rubricItem = { type: "integer", minimum: 0, maximum: 5 };
const str = { type: "string" };

export const PREMISE_TYPES = ["fatual", "valor", "inferencial", "implicita"] as const;
export const PREMISE_STATUS = ["sustentada", "fraca", "falsa", "nao_verificavel"] as const;
export const FALLACY_SIDES = ["estudante", "oponente"] as const;
export const FALLACY_TYPES = [
  "ataque_pessoal",
  "espantalho",
  "falso_dilema",
  "apelo_autoridade",
  "declive_escorregadio",
  "generalizacao_apressada",
  "causa_falsa",
  "outra",
] as const;
export const FALLACY_CONFIDENCE = ["alta", "media", "possivel"] as const;
export const RUBRIC_KEYS = ["estrutura", "logica", "evidencia", "refutacao", "persuasao", "adequacao_comite"] as const;

export const TURN_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    turno: { type: "integer" },
    argumento_estudante: {
      type: "object",
      properties: {
        alegacao: str,
        dados: { type: "array", items: str },
        garantia: str,
        qualificador: str,
        premissas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              texto: str,
              tipo: { type: "string", enum: [...PREMISE_TYPES] },
              status: { type: "string", enum: [...PREMISE_STATUS] },
              evidencia_dossie: str,
              comentario: str,
            },
            required: ["texto", "tipo", "status", "comentario"],
            additionalProperties: false,
          },
        },
      },
      required: ["alegacao", "dados", "garantia", "premissas"],
      additionalProperties: false,
    },
    premissas_oponente: {
      type: "array",
      items: {
        type: "object",
        properties: { texto: str, problema: str, como_refutar: str },
        required: ["texto", "problema", "como_refutar"],
        additionalProperties: false,
      },
    },
    falacias: {
      type: "array",
      items: {
        type: "object",
        properties: {
          lado: { type: "string", enum: [...FALLACY_SIDES] },
          tipo: { type: "string", enum: [...FALLACY_TYPES] },
          trecho: str,
          confianca: { type: "string", enum: [...FALLACY_CONFIDENCE] },
          explicacao: str,
        },
        required: ["lado", "tipo", "trecho", "confianca", "explicacao"],
        additionalProperties: false,
      },
    },
    rubrica: {
      type: "object",
      properties: Object.fromEntries(
        RUBRIC_KEYS.map((k) => [k, k === "refutacao" ? { ...rubricItem, type: ["integer", "null"] } : rubricItem]),
      ),
      required: [...RUBRIC_KEYS],
      additionalProperties: false,
    },
    pontos_fortes: { type: "array", items: str },
    melhorias_prioritarias: { type: "array", items: str, maxItems: 3 },
    sugestao_de_replica: str,
  },
  required: [
    "turno",
    "argumento_estudante",
    "premissas_oponente",
    "falacias",
    "rubrica",
    "pontos_fortes",
    "melhorias_prioritarias",
    "sugestao_de_replica",
  ],
  additionalProperties: false,
} as const;

export interface TurnAnalysis {
  turno: number;
  argumento_estudante: {
    alegacao: string;
    dados: string[];
    garantia: string;
    qualificador?: string;
    premissas: Array<{
      texto: string;
      tipo: (typeof PREMISE_TYPES)[number];
      status: (typeof PREMISE_STATUS)[number];
      evidencia_dossie?: string;
      comentario: string;
    }>;
  };
  premissas_oponente: Array<{ texto: string; problema: string; como_refutar: string }>;
  falacias: Array<{
    lado: (typeof FALLACY_SIDES)[number];
    tipo: (typeof FALLACY_TYPES)[number];
    trecho: string;
    confianca: (typeof FALLACY_CONFIDENCE)[number];
    explicacao: string;
  }>;
  rubrica: Record<Exclude<(typeof RUBRIC_KEYS)[number], "refutacao">, number> & { refutacao: number | null };
  pontos_fortes: string[];
  melhorias_prioritarias: string[];
  sugestao_de_replica: string;
}
