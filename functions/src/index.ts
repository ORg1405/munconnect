// Cloud Functions (2ª geração) do treino de debate com IA.

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import { FUNCTIONS, REGION } from "./config.js";
import { handleDebateReport } from "./handlers/debateReport.js";
import { handleDebateTurn } from "./handlers/debateTurn.js";
import { handleTurnCreated } from "./handlers/onTurnCreated.js";
import { ENFORCE_APP_CHECK, GEMINI_API_KEY } from "./params.js";

export const debateTurn = onCall<unknown, ReturnType<typeof handleDebateTurn>, string>(
  {
    region: REGION,
    secrets: [GEMINI_API_KEY],
    enforceAppCheck: ENFORCE_APP_CHECK,
    ...FUNCTIONS.debateTurn,
  },
  (request, response) => handleDebateTurn(request, response),
);

export const debateReport = onCall(
  {
    region: REGION,
    secrets: [GEMINI_API_KEY],
    enforceAppCheck: ENFORCE_APP_CHECK,
    ...FUNCTIONS.debateReport,
  },
  (request) => handleDebateReport(request),
);

export const onTurnCreated = onDocumentCreated(
  {
    document: "debates/{debateId}/turns/{turnId}",
    region: REGION,
    secrets: [GEMINI_API_KEY],
    retry: false,
    ...FUNCTIONS.onTurnCreated,
  },
  async (event) => {
    if (!event.data) return;
    await handleTurnCreated(event.params.debateId, event.data.ref, event.data.data());
  },
);
