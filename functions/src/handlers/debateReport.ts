// Callable `debateReport`: relatório final do debate (substitui o api/evaluate.js).
// Usa a transcrição salva no servidor — o cliente só manda { debateId }.
// Saída: { debateId, report, cached, model?, usage? }
// O prompt é o do avaliador original (prompts/report.ts) + responseJsonSchema.

import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { buildReportPrompt, loadDossier } from "../context.js";
import { toHttpsError } from "../errors.js";
import { getProvider } from "../llm/index.js";
import { LLMError } from "../llm/provider.js";
import { callModel } from "../llm/router.js";
import { REPORT_SCHEMA, type ReportEvaluation, type ReportInvalid } from "../schemas/report.js";
import { failReport, loadAllTurns, reserveReport, saveReport } from "../store.js";
import { parseDebateId, requireUser } from "../validation.js";

export async function handleDebateReport(request: CallableRequest<unknown>) {
  const uid = requireUser(request);
  const debateId = parseDebateId((request.data as { debateId?: unknown } | null)?.debateId);

  const reservation = await reserveReport(uid, debateId, new Date());
  if (reservation.kind === "cached") return { debateId, report: reservation.report, cached: true };

  try {
    const { debate } = reservation;
    const turns = await loadAllTurns(debateId);
    const prompt = buildReportPrompt({ dossier: loadDossier(debate.committeeId), setup: debate.setup, turns });
    const result = await callModel(getProvider(), {
      role: "report",
      ...prompt,
      responseJsonSchema: REPORT_SCHEMA,
      debateId,
    });

    const parsed = parseReport(result.text);
    if ("erro" in parsed) {
      await failReport(debateId);
      throw new HttpsError("failed-precondition", "Não foi possível avaliar esta sessão: a transcrição foi considerada insuficiente.", {
        reason: "TRANSCRIPT_INVALIDA",
        detalhe: parsed.detalhe,
      });
    }

    await saveReport({
      uid,
      debateId,
      dayKey: reservation.dayKey,
      report: parsed,
      model: result.model,
      usage: result.usage,
      costUsd: result.costUsd,
    });
    return {
      debateId,
      report: parsed,
      cached: false,
      model: result.model,
      usage: { ...result.usage, costUsd: result.costUsd, latencyMs: result.latencyMs },
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    await failReport(debateId).catch(() => undefined);
    throw toHttpsError(err, "debate_report");
  }
}

// Mesmo strip defensivo de fences do api/evaluate.js.
export function parseReport(raw: string): ReportEvaluation | ReportInvalid {
  try {
    return JSON.parse(raw.replace(/```json\s*|```/g, "").trim());
  } catch {
    throw new LLMError("Relatório não veio em JSON válido", { kind: "other" });
  }
}
