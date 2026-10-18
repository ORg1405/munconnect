// Callable `debateTurn`: uma fala do aluno → réplica do oponente (com streaming).
//
// Entrada: { debateId?, committeeId, userText, locale, setup? }
//   setup só no primeiro turno (sem debateId): { committeeName?, topic,
//   userCountry{code2,name}, aiDelegation{code2,name}, difficulty,
//   nivelDelegado?, simsAnteriores? } — fica guardado no servidor.
// Stream: pedaços de texto da réplica (string).
// Saída: { debateId, turnIndex, text, model, usedFallback, usage{turn, session}, quota }

import { HttpsError, type CallableRequest, type CallableResponse } from "firebase-functions/v2/https";
import { CONTEXT, ROLES } from "../config.js";
import { logPrefixTokensOnce } from "../prefixStats.js";
import { buildOpponentPrompt, loadDossier, selectWindow } from "../context.js";
import { toHttpsError } from "../errors.js";
import { getProvider } from "../llm/index.js";
import { LLMError, type LLMUsage } from "../llm/provider.js";
import { callModel } from "../llm/router.js";
import type { QuotaRemaining } from "../quota.js";
import { completeTurn, db, loadRecentTurns, releaseTurn, reserveTurn, type TurnReservation } from "../store.js";
import { round6 } from "../telemetry.js";
import { parseDebateTurnInput, requireUser } from "../validation.js";

export interface DebateTurnOutput {
  debateId: string;
  turnIndex: number;
  text: string;
  model: string;
  usedFallback: boolean;
  truncated: boolean; // réplica cortada pelo teto de tokens (raro; ver log llm_truncated)
  usage: {
    turn: LLMUsage & { costUsd: number; latencyMs: number };
    session: { costUsd: number; inputTokens: number; outputTokens: number; cachedTokens: number };
  };
  quota: QuotaRemaining;
}

export async function handleDebateTurn(
  request: CallableRequest<unknown>,
  response?: CallableResponse<string>,
): Promise<DebateTurnOutput> {
  const uid = requireUser(request);
  const input = parseDebateTurnInput(request.data);
  const isNew = input.debateId === null;
  const debateId = input.debateId ?? db().collection("debates").doc().id;

  const reservation: TurnReservation = await reserveTurn({
    uid,
    debateId,
    isNew,
    committeeId: input.committeeId,
    locale: input.locale,
    setup: input.setup,
    now: new Date(),
  });

  try {
    const { debate } = reservation;
    const recent = isNew ? [] : await loadRecentTurns(debateId, CONTEXT.maxWindowTurns);
    const prompt = buildOpponentPrompt({
      committeeId: debate.committeeId,
      dossier: loadDossier(debate.committeeId),
      setup: debate.setup,
      summary: debate.summary,
      window: selectWindow(recent, debate.summaryUpTo),
      userText: input.userText,
      locale: input.locale,
    });

    // Diagnóstico de cache: 1x por instância/comitê, em paralelo com a chamada.
    void logPrefixTokensOnce(getProvider(), {
      role: "opponent",
      committeeId: debate.committeeId,
      model: ROLES.opponent.model,
      systemInstruction: prompt.systemInstruction,
    });

    const streaming = Boolean(request.acceptsStreaming && response);
    const result = await callModel(getProvider(), {
      role: "opponent",
      ...prompt,
      debateId,
      onChunk: streaming ? async (piece) => void (await response!.sendChunk(piece)) : undefined,
    });
    const text = result.text.trim();
    // Resposta vazia já é re-tentada no provider; isto é só uma rede de segurança.
    if (!text) throw new LLMError("Resposta vazia do modelo", { kind: "malformed", retryable: true });

    await completeTurn({
      uid,
      reservation,
      userText: input.userText,
      opponentText: text,
      model: result.model,
      usedFallback: result.usedFallback,
      truncated: result.truncated,
      usage: result.usage,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
    });

    const prev = debate.usage;
    return {
      debateId,
      turnIndex: reservation.turnIndex,
      text,
      model: result.model,
      usedFallback: result.usedFallback,
      truncated: result.truncated,
      usage: {
        turn: { ...result.usage, costUsd: result.costUsd, latencyMs: result.latencyMs },
        session: {
          costUsd: round6(prev.costUsd + result.costUsd),
          inputTokens: prev.inputTokens + result.usage.inputTokens,
          outputTokens: prev.outputTokens + result.usage.outputTokens + result.usage.thoughtsTokens,
          cachedTokens: prev.cachedTokens + result.usage.cachedTokens,
        },
      },
      quota: reservation.remaining,
    };
  } catch (err) {
    await releaseTurn(uid, reservation).catch(() => undefined);
    if (err instanceof HttpsError) throw err;
    throw toHttpsError(err, "debate_turn");
  }
}
