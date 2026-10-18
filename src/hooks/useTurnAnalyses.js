// Análises do juiz por turno, em tempo real (debates/{debateId}/turns).
// Devolve um mapa índice do turno → { id, analysisStatus, analysis, ... }.

import { useEffect, useState } from "react";
import { subscribeTurns } from "../services/debateAI";

export function useTurnAnalyses(debateId) {
  const [byIndex, setByIndex] = useState({});

  useEffect(() => {
    if (!debateId) return undefined;
    return subscribeTurns(
      debateId,
      (turns) => setByIndex(Object.fromEntries(turns.map((t) => [t.index, t]))),
      // Sem leitura (ex.: regras), o chat continua; só o feedback não aparece.
      () => setByIndex({}),
    );
  }, [debateId]);

  return byIndex;
}
