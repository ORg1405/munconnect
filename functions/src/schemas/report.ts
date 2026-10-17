// Schema do RELATÓRIO FINAL — mesmo formato que o api/evaluate.js devolve, passado
// ao Gemini como responseJsonSchema. O prompt original também prevê um JSON de
// erro { erro: "TRANSCRIPT_INVALIDA", detalhe }; por isso o schema é um anyOf.

const criterio = {
  type: "object",
  properties: {
    nota: { type: "number", minimum: 0, maximum: 10 },
    feedback: { type: "string" },
  },
  required: ["nota", "feedback"],
  additionalProperties: false,
};

export const REPORT_CRITERIA = [
  "clarezaArticulacao",
  "argumentacaoLogica",
  "posturaDiplomatica",
  "engajamento",
  "conhecimentoTema",
  "reacaoContraArgumentos",
  "consistenciaPoliticaExterna",
] as const;

export const COMMITTEE_TIERS = [
  "Comitê Iniciante",
  "Comitê Intermediário",
  "Comitê Avançado",
  "Comitê de Destaque / Crise",
] as const;

const evaluation = {
  type: "object",
  properties: {
    notaGeral: { type: "number", minimum: 0, maximum: 10 },
    criterios: {
      type: "object",
      properties: Object.fromEntries(REPORT_CRITERIA.map((k) => [k, criterio])),
      required: [...REPORT_CRITERIA],
      additionalProperties: false,
    },
    pontosDeMelhoria: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
    recomendacaoComite: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: [...COMMITTEE_TIERS] },
        justificativa: { type: "string" },
      },
      required: ["tipo", "justificativa"],
      additionalProperties: false,
    },
    observacoes: { type: "string" },
  },
  required: ["notaGeral", "criterios", "pontosDeMelhoria", "recomendacaoComite", "observacoes"],
  additionalProperties: false,
};

const invalidTranscript = {
  type: "object",
  properties: {
    erro: { type: "string", enum: ["TRANSCRIPT_INVALIDA"] },
    detalhe: { type: "string" },
  },
  required: ["erro", "detalhe"],
  additionalProperties: false,
};

export const REPORT_SCHEMA = { anyOf: [evaluation, invalidTranscript] };

export interface ReportEvaluation {
  notaGeral: number;
  criterios: Record<(typeof REPORT_CRITERIA)[number], { nota: number; feedback: string }>;
  pontosDeMelhoria: string[];
  recomendacaoComite: { tipo: (typeof COMMITTEE_TIERS)[number]; justificativa: string };
  observacoes: string;
}

export interface ReportInvalid {
  erro: "TRANSCRIPT_INVALIDA";
  detalhe: string;
}
