// Cliente dos callables de IA do Debate Trainer (Cloud Functions debateTurn /
// debateReport). Usado pelos comitês de blocos (TPI, em
// components/debate/BlocChatScreen.jsx); os demais comitês seguem em /api/debate.
//
// sendDebateTurn usa httpsCallable(...).stream(): os pedaços da réplica chegam
// por onChunk; a Promise resolve com o resultado final (texto completo, uso,
// cota restante). Erros viram DebateAIError com mensagem pronta para a UI.

import { httpsCallable } from "firebase/functions";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db, functions } from "../firebase";

// Timeouts do CLIENTE — acompanham functions/src/config.ts (FUNCTIONS.*.timeoutSeconds).
// debateTurn: função 120 s (o SDK usa 70 s por padrão — curto demais com retry).
const TURN_TIMEOUT_MS = 125_000;
// debateReport: função 300 s (relatório leva ~1–2 min). Se o relatório passar
// para Flex (função 1800 s), NÃO precisa mudar: estourando este timeout, a UI
// continua acompanhando o status pelo Firestore (subscribeReportStatus).
export const REPORT_TIMEOUT_MS = 310_000;
// Trava do servidor (QUOTA.reportLockSeconds = 300 + 60 s): um "generating" mais
// velho que isso ficou preso (instância caiu) — a UI pode oferecer "tentar de novo".
export const REPORT_STALE_AFTER_MS = 360_000;

const debateTurnFn = httpsCallable(functions, "debateTurn", { timeout: TURN_TIMEOUT_MS });
const debateReportFn = httpsCallable(functions, "debateReport", { timeout: REPORT_TIMEOUT_MS });

export class DebateAIError extends Error {
  constructor({ code, message, reason, resetsAt, retryAfterSeconds, detalhe }) {
    super(message);
    this.name = "DebateAIError";
    this.code = code; // ex.: "resource-exhausted", "unavailable"
    this.reason = reason; // ex.: "daily-debates", "debate-turns", "cooldown", "model-busy"
    this.resetsAt = resetsAt ? new Date(resetsAt) : null;
    this.retryAfterSeconds = retryAfterSeconds ?? null;
    this.detalhe = detalhe ?? null;
  }

  get isQuota() {
    return this.code === "resource-exhausted";
  }

  get isRetryable() {
    return this.code === "unavailable" || this.reason === "cooldown" || this.reason === "turn-in-progress";
  }
}

const FALLBACK_MESSAGE = "O delegado está formulando a resposta, tente de novo em alguns segundos.";

// Com o Emulator Suite (VITE_USE_EMULATORS=true), mostra no console o erro
// real devolvido pela função — o aluno continua vendo só a mensagem amigável.
const LOG_REAL_ERRORS = import.meta.env.VITE_USE_EMULATORS === "true";

export function toDebateAIError(err) {
  if (err instanceof DebateAIError) return err;
  const code = String(err?.code || "internal").replace(/^functions\//, "");
  const details = err?.details || {};
  if (LOG_REAL_ERRORS) {
    console.error("[debateAI] erro da função:", { code, reason: details.reason, kind: details.kind, detalhe: details.detalhe, message: err?.message, details });
  }
  // As mensagens do backend já vêm em português e amigáveis; para erros de
  // rede/SDK sem mensagem útil, usa a mensagem padrão.
  const serverMessage = err?.message && code !== "internal" && code !== "unknown" ? err.message : null;
  return new DebateAIError({
    code,
    message: code === "unauthenticated" ? "Faça login para usar o treino de debate." : serverMessage || FALLBACK_MESSAGE,
    reason: details.reason,
    resetsAt: details.resetsAt,
    retryAfterSeconds: details.retryAfterSeconds,
    detalhe: details.detalhe,
  });
}

/**
 * @param {{ debateId?: string, committeeId: string, userText: string, locale?: string,
 *           setup?: { committeeName?: string, topic: string, userCountry: {code2,name},
 *                     aiDelegation: {code2,name}, difficulty?: string,
 *                     nivelDelegado?: string, simsAnteriores?: number|null } }} input
 *        `setup` só no primeiro turno (sem debateId).
 * @param {{ onChunk?: (text: string) => void, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ debateId, turnIndex, text, model, usedFallback, usage, quota }>}
 */
export async function sendDebateTurn(input, { onChunk, signal } = {}) {
  const payload = {
    debateId: input.debateId ?? null,
    committeeId: input.committeeId,
    userText: input.userText,
    locale: input.locale ?? "pt-BR",
    ...(input.debateId ? {} : { setup: input.setup }),
  };
  try {
    const { stream, data } = await debateTurnFn.stream(payload, { signal });
    for await (const chunk of stream) {
      if (typeof chunk === "string") onChunk?.(chunk);
    }
    return await data;
  } catch (err) {
    throw toDebateAIError(err);
  }
}

/**
 * Relatório final (mesmo formato do antigo /api/evaluate). Chamadas repetidas
 * devolvem o relatório já salvo (`cached: true`).
 * @returns {Promise<{ debateId, report, cached, model?, usage? }>}
 */
export async function requestDebateReport(debateId) {
  try {
    const res = await debateReportFn({ debateId });
    return res.data;
  } catch (err) {
    throw toDebateAIError(err);
  }
}

// Erros em que o relatório pode estar (ou continuar) sendo gerado no servidor:
// a UI deve seguir o status pelo Firestore em vez de mostrar falha.
export function isReportStillRunning(err) {
  return (
    err?.reason === "report-in-progress" ||
    err?.code === "deadline-exceeded" || // timeout do cliente; a função segue rodando
    err?.code === "cancelled"
  );
}

/**
 * Acompanha o status do relatório em debates/{debateId} (as rules deixam o
 * dono ler). cb recebe:
 *   { status: "idle" | "generating" | "done" | "error",
 *     report, startedAt: Date|null, error: { reason, detalhe }|null, stale: boolean }
 * `stale` = "generating" há mais que REPORT_STALE_AFTER_MS (execução morreu).
 * @returns {() => void} unsubscribe
 */
export function subscribeReportStatus(debateId, cb, onError) {
  return onSnapshot(
    doc(db, "debates", debateId),
    (snap) => {
      const d = snap.data() || {};
      const startedAt = d.reportStartedAt?.toDate?.() ?? null;
      const status = d.reportStatus ?? "idle";
      cb({
        status,
        report: d.report ?? null,
        startedAt,
        error: d.reportError ?? null,
        stale: status === "generating" && !!startedAt && Date.now() - startedAt.getTime() > REPORT_STALE_AFTER_MS,
      });
    },
    onError,
  );
}

/**
 * Acompanha os turnos de debates/{debateId}/turns, em ordem. O juiz grava a
 * análise de forma assíncrona (trigger onTurnCreated), então cada turno passa
 * por analysisStatus "pending" → "running" → "done" | "error" | "blocked"
 * ("skipped" = fora da cadência de análise).
 * cb recebe [{ id, index, analysisStatus, analysis, analysisGuards, disputes }].
 * @returns {() => void} unsubscribe
 */
export function subscribeTurns(debateId, cb, onError) {
  return onSnapshot(
    query(collection(db, "debates", debateId, "turns"), orderBy("index")),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const t = d.data();
          return {
            id: d.id,
            index: t.index,
            analysisStatus: t.analysisStatus ?? "pending",
            analysis: t.analysis ?? null,
            analysisGuards: t.analysisGuards ?? null,
            disputes: t.disputes ?? {},
          };
        }),
      ),
    onError,
  );
}

// Limites de disputes (mesmos de firestore.rules → validDisputes).
export const DISPUTE_MAX_CHARS = 500;
export const DISPUTE_MAX_FALLACIES = 10;

/**
 * Registra a contestação de uma falácia apontada pelo juiz (só para calibração:
 * não muda nota nem análise). As rules deixam o dono gravar SÓ `disputes`.
 */
export async function contestFallacy(debateId, turnId, fallacyIndex, text) {
  const value = text.trim();
  if (!value || value.length > DISPUTE_MAX_CHARS || fallacyIndex < 0 || fallacyIndex >= DISPUTE_MAX_FALLACIES) {
    throw new DebateAIError({ code: "invalid-argument", message: `Escreva a contestação em até ${DISPUTE_MAX_CHARS} caracteres.` });
  }
  try {
    await updateDoc(doc(db, "debates", debateId, "turns", turnId), { [`disputes.${fallacyIndex}`]: value });
  } catch {
    throw new DebateAIError({ code: "unavailable", message: "Não foi possível registrar a contestação agora. Seu texto continua aqui; tente de novo." });
  }
}
