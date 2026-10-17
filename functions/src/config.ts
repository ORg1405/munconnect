// ─────────────────────────────────────────────────────────────────────────────
// Configuração ÚNICA do backend de IA do Debate Trainer.
// Cotas, modelos por papel, retry, safety, preços e limites de instância moram
// aqui — nada disso deve aparecer espalhado pelo código.
// ─────────────────────────────────────────────────────────────────────────────

import type { SafetySetting } from "./llm/provider.js";

// Região: mesma do banco Firestore (southamerica-east1) — obrigatório para o
// trigger da análise por turno e reduz latência para usuários no Brasil.
export const REGION = "southamerica-east1";

// ── Modelos ──────────────────────────────────────────────────────────────────
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

// Tier do relatório final. "flex" = 50% mais barato, mas latência de minutos
// (capacidade ociosa, sem garantia). Trocar aqui ajusta sozinho o timeout por
// tentativa, o orçamento de retry e o timeoutSeconds da função debateReport.
// O cliente não precisa mudar: se a chamada passar do timeout dele, a UI segue
// acompanhando o status pelo Firestore (ver src/services/debateAI.js).
const REPORT_SERVICE_TIER = "standard" as "standard" | "flex";

// ── Cloud Functions: escala e timeouts ───────────────────────────────────────
// Cálculo de pico (200 alunos) em functions/README.md → "Capacidade (RPM)".
// Pior caso ≈ 600 turnos/min → ~30–40 chamadas simultâneas ao oponente;
// 10 instâncias × 40 dão folga.
export const FUNCTIONS = {
  debateTurn: { concurrency: 40, maxInstances: 10, timeoutSeconds: 120, memory: "512MiB" },
  // O relatório levou 56–115 s em testes (3.8 Flash, standard): 300 s cobre
  // isso com retry. Com Flex, 1800 s (o máximo de um callable é 3600 s).
  debateReport: {
    concurrency: 20,
    maxInstances: 5,
    timeoutSeconds: REPORT_SERVICE_TIER === "flex" ? 1800 : 300,
    memory: "512MiB",
  },
  onTurnCreated: { concurrency: 40, maxInstances: 10, timeoutSeconds: 120, memory: "512MiB" },
} as const;

// ── Cotas por usuário ────────────────────────────────────────────────────────
export const QUOTA = {
  debatesPerDay: 3,
  turnsPerDebate: 12,
  minSecondsBetweenTurns: 20,
  // O "dia" da cota vira à meia-noite deste fuso.
  timeZone: "America/Sao_Paulo",
  timeZoneLabel: "horário de Brasília",
  // Travas de turno/relatório em andamento: se uma execução ficar presa (crash
  // da instância), a trava expira depois disso. São sempre MAIORES que o
  // timeout da função, para nunca haver duas execuções sobrepostas.
  turnLockSeconds: FUNCTIONS.debateTurn.timeoutSeconds + 10,
  reportLockSeconds: FUNCTIONS.debateReport.timeoutSeconds + 60,
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
  // do Gemini (mínimo documentado de 4.096 tokens nos modelos 3.x Flash). O
  // tamanho real é registrado no log "prefix_tokens", uma vez por instância.
  cachePrefixMinTokens: 4096,
} as const;

// ── Análise por turno ────────────────────────────────────────────────────────
export const ANALYSIS = {
  // Analisa os turnos 1, 1+N, 1+2N… (N = 1 analisa todos). Os demais ficam com
  // analysisStatus "skipped". Subir N reduz RPM/custo da análise na mesma proporção.
  analyzeEveryTurns: 1,
} as const;

// ── Papéis ───────────────────────────────────────────────────────────────────
export type ThinkingLevel = "minimal" | "low" | "medium" | "high";
export type Role = "opponent" | "turnAnalysis" | "summary" | "report";

export interface RoleConfig {
  model: string;
  fallbackModel: string | null;
  thinkingLevel: ThinkingLevel;
  // Tokens de raciocínio contam como saída — o teto cobre raciocínio + resposta.
  maxOutputTokens: number;
  temperature: number;
  // Timeout de UMA tentativa (ms).
  timeoutMs: number;
  // Orçamento TOTAL (ms) para todas as tentativas + esperas + reserva. Tem de
  // caber no timeoutSeconds da função que chama o papel.
  deadlineMs: number;
  // Parte do deadlineMs que o modelo principal NÃO pode usar: fica para o
  // modelo de reserva (senão um principal lento esgota tudo antes da reserva).
  fallbackReserveMs: number;
  serviceTier: "standard" | "flex";
}

export const ROLES: Record<Role, RoleConfig> = {
  opponent: {
    // Para testar o 3.8 Flash no oponente, troque SÓ a linha abaixo para
    // MODEL_IDS.flash38 (lembre: preço dobra em 01/01/2027; não aceita "minimal";
    // em testes levou 31–114 s por turno).
    model: MODEL_IDS.flashLite31,
    fallbackModel: MODEL_IDS.flashLite35,
    thinkingLevel: "low",
    // Teto de raciocínio + resposta. Com 1024, um turno de teste gastou 949 em
    // raciocínio e a réplica saiu cortada (MAX_TOKENS). Só se paga o que for gerado.
    maxOutputTokens: 2048,
    temperature: 0.8,
    timeoutMs: 30_000,
    deadlineMs: 100_000, // < debateTurn.timeoutSeconds (120 s)
    fallbackReserveMs: 25_000,
    serviceTier: "standard",
  },
  turnAnalysis: {
    // Modelo SEPARADO do oponente para usar outro pool de limite (RPM/TPM são
    // por modelo): o oponente não disputa cota com a análise.
    model: MODEL_IDS.flashLite35,
    fallbackModel: MODEL_IDS.flashLite31,
    thinkingLevel: "low",
    maxOutputTokens: 2048,
    temperature: 0.2,
    timeoutMs: 60_000,
    deadlineMs: 100_000, // < onTurnCreated.timeoutSeconds (120 s)
    fallbackReserveMs: 30_000,
    serviceTier: "standard",
  },
  summary: {
    model: MODEL_IDS.flashLite31,
    fallbackModel: MODEL_IDS.flashLite35,
    thinkingLevel: "minimal",
    maxOutputTokens: 600,
    temperature: 0.2,
    timeoutMs: 30_000,
    deadlineMs: 100_000, // < onTurnCreated.timeoutSeconds (120 s)
    fallbackReserveMs: 25_000,
    serviceTier: "standard",
  },
  report: {
    model: MODEL_IDS.flash38,
    fallbackModel: MODEL_IDS.flashLite35,
    thinkingLevel: "low",
    maxOutputTokens: 8192,
    temperature: 0.3,
    // Standard: 1 tentativa demorada (~115 s) + 1 retry cabem nos 270 − 60 s do
    // principal; os 60 s finais ficam para a reserva (3.5 Flash-Lite gerou o
    // relatório em ~4 s no teste em que o 3.8 Flash devolveu 503 repetidos).
    timeoutMs: 150_000,
    deadlineMs: REPORT_SERVICE_TIER === "flex" ? 1_700_000 : 270_000, // < debateReport.timeoutSeconds
    fallbackReserveMs: 60_000,
    serviceTier: REPORT_SERVICE_TIER,
  },
};

// Timeout por tentativa quando serviceTier = "flex" (a doc recomenda ≥ 10 min).
export const FLEX_TIMEOUT_MS = 600_000;

// ── Retry / fallback ─────────────────────────────────────────────────────────
// Backoff exponencial com jitter: 1 s, 2 s, 4 s (8 s seria a próxima) entre as
// tentativas no modelo principal; esgotou → modelo de reserva; esgotou → erro
// amigável. Só re-tenta erros transitórios (429, 503, 504, rede, timeout). Tudo
// dentro do deadlineMs do papel: não começa tentativa sem tempo para terminá-la.
// Obs.: o timeout por tentativa (httpOptions.timeout) também é enviado ao
// servidor como deadline — estourou, a API responde 504 DEADLINE_EXCEEDED.
export const RETRY = {
  maxAttempts: 4,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  // Jitter multiplicativo: espera = base·2^n · (1 ± jitterRatio).
  jitterRatio: 0.3,
  fallbackMaxAttempts: 2,
  // Tempo mínimo restante para iniciar uma tentativa — e timeout mínimo de uma
  // tentativa: a Gemini API recusa (400) deadlines abaixo de 10 s.
  minAttemptMs: 10_000,
  retryableStatus: [429, 503] as readonly number[],
} as const;

// Máximo de chamadas simultâneas ao LLM por instância (semáforo).
export const LLM_MAX_CONCURRENT_PER_INSTANCE = 24;
// Quanto tempo uma requisição espera por uma vaga no semáforo antes de desistir.
export const LLM_QUEUE_TIMEOUT_MS = 15_000;

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
