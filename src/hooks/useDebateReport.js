// Hook do relatório final: dispara debateReport e acompanha o status pelo
// Firestore, para a UI mostrar "gerando relatório…" mesmo que a chamada passe
// do timeout do cliente ou a página seja recarregada no meio. Usado por
// components/debate/BlocChatScreen.jsx (ReportPanel).
//
// status: "idle" | "generating" | "done" | "error"

import { useCallback, useEffect, useState } from "react";
import { isReportStillRunning, requestDebateReport, subscribeReportStatus } from "../services/debateAI";

export function useDebateReport(debateId) {
  const [status, setStatus] = useState("idle");
  const [report, setReport] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [error, setError] = useState(null); // DebateAIError | { reason, detalhe } | null

  // Fonte da verdade: o doc do debate (o servidor grava generating/done/error).
  useEffect(() => {
    if (!debateId) return undefined;
    return subscribeReportStatus(debateId, (s) => {
      setStartedAt(s.startedAt);
      if (s.status === "done") {
        setStatus("done");
        setReport(s.report);
        setError(null);
      } else if (s.status === "generating") {
        setStatus(s.stale ? "error" : "generating");
        if (s.stale) setError({ reason: "stale" });
      } else if (s.status === "error") {
        setStatus("error");
        setError((prev) => prev ?? s.error);
      }
    });
  }, [debateId]);

  const generate = useCallback(async () => {
    if (!debateId || status === "generating") return;
    setStatus("generating");
    setError(null);
    try {
      const res = await requestDebateReport(debateId);
      setReport(res.report);
      setStatus("done");
    } catch (err) {
      if (isReportStillRunning(err)) return; // segue "generating"; o onSnapshot conclui
      setError(err);
      setStatus("error");
    }
  }, [debateId, status]);

  return { status, report, startedAt, error, generate };
}
