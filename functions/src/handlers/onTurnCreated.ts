// Trigger assíncrono em debates/{debateId}/turns/{turnId}: roda a análise por
// turno (juiz, saída estruturada) e, a cada CONTEXT.summaryEveryTurns turnos,
// atualiza o resumo do debate. Não bloqueia o aluno: a réplica já foi entregue;
// o feedback aparece quando este trigger gravar `analysis` no doc do turno.

import { logger } from "firebase-functions";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { ROLES } from "../config.js";
import { logPrefixTokensOnce } from "../prefixStats.js";
import { buildJudgePrompt, buildSummaryPrompt, loadDossier, shouldUpdateSummary, type TurnRecord } from "../context.js";
import { getProvider } from "../llm/index.js";
import { LLMError } from "../llm/provider.js";
import { callModel } from "../llm/router.js";
import { TURN_ANALYSIS_SCHEMA } from "../schemas/turnAnalysis.js";
import { addAsyncUsage, claimTurnAnalysis, loadTurnRange, paths, saveSummary, type DebateDoc } from "../store.js";

export async function handleTurnCreated(debateId: string, turnRef: DocumentReference, turnData: FirebaseFirestore.DocumentData) {
  const debateSnap = await paths.debate(debateId).get();
  if (!debateSnap.exists) return;
  const debate = debateSnap.data() as DebateDoc;
  const turn: TurnRecord = { index: turnData.index, userText: turnData.userText, opponentText: turnData.opponentText };

  await Promise.allSettled([
    analyzeTurn(debateId, debate, turn, turnRef),
    shouldUpdateSummary(turn.index) ? updateSummary(debateId, debate, turn.index) : Promise.resolve(),
  ]);
}

async function analyzeTurn(debateId: string, debate: DebateDoc, turn: TurnRecord, turnRef: DocumentReference) {
  if (!(await claimTurnAnalysis(turnRef))) return;
  try {
    const prompt = buildJudgePrompt({
      dossier: loadDossier(debate.committeeId),
      setup: debate.setup,
      summary: debate.summary,
      turn,
      locale: debate.locale,
    });
    void logPrefixTokensOnce(getProvider(), {
      role: "turnAnalysis",
      committeeId: debate.committeeId,
      model: ROLES.turnAnalysis.model,
      systemInstruction: prompt.systemInstruction,
    });
    const result = await callModel(getProvider(), {
      role: "turnAnalysis",
      ...prompt,
      responseJsonSchema: TURN_ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
      debateId,
    });
    const analysis = JSON.parse(result.text);
    await turnRef.update({
      analysis,
      analysisStatus: "done",
      analysisModel: result.model,
      analysisUsage: { ...result.usage, costUsd: result.costUsd },
      analyzedAt: FieldValue.serverTimestamp(),
    });
    await addAsyncUsage({ uid: debate.uid, debateId, at: new Date(), usage: result.usage, costUsd: result.costUsd });
  } catch (err) {
    const blocked = err instanceof LLMError && err.kind === "blocked";
    logger.warn("turn_analysis_failed", { debateId, turnIndex: turn.index, kind: err instanceof LLMError ? err.kind : "other" });
    await turnRef.update({ analysisStatus: blocked ? "blocked" : "error" }).catch(() => undefined);
  }
}

async function updateSummary(debateId: string, debate: DebateDoc, upTo: number) {
  try {
    const newTurns = await loadTurnRange(debateId, (debate.summaryUpTo ?? 0) + 1, upTo);
    if (newTurns.length === 0) return;
    const prompt = buildSummaryPrompt({ setup: debate.setup, previousSummary: debate.summary, newTurns });
    const result = await callModel(getProvider(), { role: "summary", ...prompt, debateId });
    const summary = result.text.trim();
    if (summary) await saveSummary(debateId, summary, upTo);
    await addAsyncUsage({ uid: debate.uid, debateId, at: new Date(), usage: result.usage, costUsd: result.costUsd });
  } catch (err) {
    logger.warn("summary_update_failed", { debateId, upTo, kind: err instanceof LLMError ? err.kind : "other" });
  }
}
