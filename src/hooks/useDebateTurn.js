// Hook mínimo sobre services/debateAI.js — guarda o debateId entre turnos,
// expõe o texto em streaming e o erro (incluindo cota) para a UI renderizar.
// Usado por components/debate/BlocChatScreen.jsx.

import { useCallback, useEffect, useRef, useState } from "react";
import { sendDebateTurn } from "../services/debateAI";

export function useDebateTurn({ committeeId, setup, locale = "pt-BR" }) {
  const [debateId, setDebateId] = useState(null);
  const [streamingText, setStreamingText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null); // DebateAIError | null
  const [quota, setQuota] = useState(null); // { debatesLeftToday, turnsLeftInDebate, nextTurnAvailableAt, dailyResetAt }
  const [lastUsage, setLastUsage] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (userText) => {
      if (pending) return null;
      setPending(true);
      setError(null);
      setStreamingText("");
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await sendDebateTurn(
          { debateId, committeeId, userText, locale, setup },
          { onChunk: (piece) => setStreamingText((t) => t + piece), signal: controller.signal },
        );
        setDebateId(result.debateId);
        setQuota(result.quota);
        setLastUsage(result.usage);
        setStreamingText(result.text);
        return result;
      } catch (err) {
        // Falha no meio do stream: descarta o texto parcial (o turno não contou).
        setStreamingText("");
        setError(err);
        return null;
      } finally {
        setPending(false);
      }
    },
    [pending, debateId, committeeId, locale, setup],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setDebateId(null);
    setStreamingText("");
    setError(null);
    setQuota(null);
    setLastUsage(null);
  }, []);

  return { debateId, send, reset, pending, streamingText, error, quota, lastUsage };
}
