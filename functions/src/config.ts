// ─────────────────────────────────────────────────────────────────────────────
// Configuração ÚNICA do backend de IA do Debate Trainer.
// Cotas, modelos por papel, retry, safety, preços e limites de instância moram
// aqui — nada disso deve aparecer espalhado pelo código.
// ─────────────────────────────────────────────────────────────────────────────

import type { SafetySetting } from "./llm/provider.js";

// Região: mesma do banco Firestore (southamerica-east1) — obrigatório para o
// trigger da análise por turno e reduz latência para usuários no Brasil.
export const REGION = "southamerica-east1";

// ── Cotas por usuário ────────────────────────────────────────────────────────
export const QUOTA = {
  debatesPerDay: 3,
  turnsPerDebate: 12,
  minSecondsBetweenTurns: 20,
  // O "dia" da cota vira à meia-noite deste fuso.
  timeZone: "America/Sao_Paulo",
  timeZoneLabel: "horário de Brasília",
  // Trava de turno em andamento: se um turno ficar preso (crash da instância),
  // a trava expira depois disso. Deve ser > FUNCTIONS.debateTurn.timeoutSeconds
  // (e a de relatório > FUNCTIONS.debateReport.timeoutSeconds) para nunca haver
  // duas execuções sobrepostas.
  turnLockSeconds: 130,
  reportLockSeconds: 960,
  // Mínimo de falas do aluno para gerar o relatório final (mesma regra do
  // avaliador original em api/evaluate.js).
  minUserTurnsForReport: 4,
} as const;

// ── Limites de entrada ───────────────────────────────────────────────────────
export const LIMITS = {
  maxUserTextChars: 2000,
  maxSetupFieldChars: 200,
} as const;

// ── Controle de contexto ─────────────────────────────────────────────────────
export const CONTEXT = {
  // Últimos N turnos enviados literalmente ao modelo.
  windowTurns: 4,
  // Se o resumo atrasar, a janela cresce para não perder turnos — até este teto.
  maxWindowTurns: 7,
  // O resumo do debate é refeito a cada N turnos (chamada barata, assíncrona).
  summaryEveryTurns: 3,
  summaryTargetTokens: 300,
  // Alvo para o prefixo fixo (system prompt + dossiê) ativar o cache implícito
  // do Gemini (mínimo documentado de 4.096 tokens nos modelos 3.x Flash).
  cachePrefixMinTokens: 4096,
} as const;

// ── Modelos por papel ────────────────────────────────────────────────────────
// IDs confirmados com chamada real à Gemini API em 2026-10-17
// (models.list + generateContent): gemini-3.1-flash-lite, gemini-3.5-flash-lite,
// gemini-3.8-flash.
//
// ATENÇÃO: o preço do gemini-3.8-flash DOBRA em 01/01/2027 (input, output e
// cache). Ver PRICES abaixo antes de trocar o oponente para ele.
export const MODEL_IDS = {
  flashLite31: "gemini-3.1-flash-lite",
  flashLite35: "gemini-3.5-flash-lite",
  flash38: "gemini-3.8-flash",
} as const;

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";
export type Role = "opponent" | "turnAnalysis" | "summary" | "report";

export interface RoleConfig {
  model: string;
  fallbackModel: string | null;
  thinkingLevel: ThinkingLevel;
  // Tokens de raciocínio contam como saída — o teto cobre raciocínio + resposta.
  maxOutputTokens: number;
  temperature: number;
  // Timeout por tentativa (ms).
  timeoutMs: number;
  // "flex" = 50% mais barato, latência variável (minutos). Só para papéis em
  // que a latência não importa.
  serviceTier: "standard" | "flex";
}

export const ROLES: Record<Role, RoleConfig> = {
  opponent: {
    // Para testar o 3.8 Flash no oponente, troque SÓ a linha abaixo para
    // MODEL_IDS.flash38 (lembre: preço dobra em 01/01/2027; não aceita "minimal").
    model: MODEL_IDS.flashLite31,
    fallbackModel: MODEL_IDS.flashLite35,
    thinkingLevel: "low",
    maxOutputTokens: 1024,
    temperature: 0.8,
    timeoutMs: 30_000,
    serviceTier: "standard",
  },
  turnAnalysis: {
    model: MODEL_IDS.flashLite31,
    fallbackModel: MODEL_IDS.flashLite35,
    thinkingLevel: "low",
    maxOutputTokens: 2048,
    temperature: 0.2,
    timeoutMs: 60_000,
    serviceTier: "standard",
  },
  summary: {
    model: MODEL_IDS.flashLite31,
    fallbackModel: MODEL_IDS.flashLite35,
    thinkingLevel: "minimal",
    maxOutputTokens: 600,
    temperature: 0.2,
    timeoutMs: 30_000,
    serviceTier: "standard",
  },
  report: {
    model: MODEL_IDS.flash38,
    fallbackModel: MODEL_IDS.flashLite35,
    thinkingLevel: "low",
    maxOutputTokens: 8192,
    temperature: 0.3,
    // Em testes o 3.8 Flash levou ~60–115 s no tier standard.
    timeoutMs: 240_000,
    // Troque para "flex" quando a latência do relatório não importar (ex.:
    // relatório entregue depois, por e-mail/tela de histórico). Flex usa
    // capacidade ociosa e pode levar minutos; ver FUNCTIONS.debateReport.
    serviceTier: "standard",
  },
};

// Timeout por tentativa quando serviceTier = "flex" (a doc recomenda ≥ 10 min).
export const FLEX_TIMEOUT_MS = 600_000;

// ── Retry / fallback ─────────────────────────────────────────────────────────
// Backoff exponencial com jitter: 1 s, 2 s, 4 s (8 s seria a próxima) entre as
// tentativas no modelo principal; esgotou → modelo de reserva; esgotou → erro
// amigável. Só re-tenta erros transitórios (429, 503 e falha de rede).
export const RETRY = {
  maxAttempts: 4,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  // Jitter multiplicativo: espera = base·2^n · (1 ± jitterRatio).
  jitterRatio: 0.3,
  fallbackMaxAttempts: 2,
  retryableStatus: [429, 503] as readonly number[],
} as const;

// Máximo de chamadas simultâneas ao LLM por instância (semáforo).
export const LLM_MAX_CONCURRENT_PER_INSTANCE = 24;
// Quanto tempo uma requisição espera por uma vaga no semáforo antes de desistir.
export const LLM_QUEUE_TIMEOUT_MS = 15_000;

// ── Cloud Functions: escala ──────────────────────────────────────────────────
// 200 usuários × 1 turno/20 s ≈ 10 turnos/s no pico; cada turno leva ~2–4 s →
// ~30–40 chamadas simultâneas. 10 instâncias × 40 dão folga de sobra.
export const FUNCTIONS = {
  debateTurn: { concurrency: 40, maxInstances: 10, timeoutSeconds: 120, memory: "512MiB" },
  debateReport: { concurrency: 20, maxInstances: 5, timeoutSeconds: 900, memory: "512MiB" },
  onTurnCreated: { concurrency: 40, maxInstances: 10, timeoutSeconds: 120, memory: "512MiB" },
} as const;

// ── Safety settings ──────────────────────────────────────────────────────────
// O oponente defende posições históricas/políticas controversas dentro de uma
// simulação educacional — limiares mais tolerantes nas categorias de discurso,
// mantendo bloqueio de conteúdo sexual. Ajuste aqui (único lugar).
export const SAFETY_SETTINGS: SafetySetting[] = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
];

// ── Preços (USD por 1M de tokens, tier standard) ─────────────────────────────
// Fonte: ai.google.dev/gemini-api/docs/pricing, consultado em 2026-10-17.
// output inclui tokens de raciocínio. Flex/Batch = 50% (FLEX_PRICE_MULTIPLIER).
// Cada modelo tem uma lista de vigências; vale a última com `from` <= hoje.
export interface Price {
  from: string; // AAAA-MM-DD
  input: number;
  output: number;
  cachedInput: number;
}

export const PRICES: Record<string, Price[]> = {
  [MODEL_IDS.flashLite31]: [{ from: "2000-01-01", input: 0.25, output: 1.5, cachedInput: 0.025 }],
  [MODEL_IDS.flashLite35]: [{ from: "2000-01-01", input: 0.3, output: 2.5, cachedInput: 0.03 }],
  [MODEL_IDS.flash38]: [
    { from: "2000-01-01", input: 0.75, output: 3.75, cachedInput: 0.075 },
    // Preço DOBRA em 01/01/2027.
    { from: "2027-01-01", input: 1.5, output: 7.5, cachedInput: 0.15 },
  ],
};

export const FLEX_PRICE_MULTIPLIER = 0.5;
