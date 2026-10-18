// Primeira fala de ponta a ponta NO EMULADOR: cria um usuário no Auth emulado
// (e-mail/senha — conta anônima é recusada), chama o callable debateTurn com
// um setup do TPI e mostra a réplica, o modelo e a cota. Faz 1 chamada real
// ao Gemini (oponente) e dispara o juiz em segundo plano.
//
// Uso: emuladores rodando (auth, firestore, functions) e, em functions/:
//   npm run smoke:turn
// Projeto: FIREBASE_PROJECT ou "munconnectg" (.firebaserc).

const PROJECT = process.env.FIREBASE_PROJECT ?? "munconnectg";
const AUTH = "http://127.0.0.1:9099";
const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT}/southamerica-east1`;

// Emulador fora do ar → { status: 0, offline: mensagem }.
async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    return { status: res.status, json: (await res.json().catch(() => null)) as any, offline: null };
  } catch (e) {
    return { status: 0, json: null as any, offline: (e as Error).message };
  }
}

// process.exitCode em vez de process.exit(): no Node 24/Windows, sair com
// conexões do fetch abertas dispara "Assertion failed: UV_HANDLE_CLOSING".
async function main(): Promise<number> {
  const signUp = await postJson(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulador`, {
    email: `smoke+${Date.now()}@teste.dev`,
    password: "senha-de-teste-123",
    returnSecureToken: true,
  });
  if (signUp.offline) {
    console.error(`✗ Auth emulado fora do ar em ${AUTH}: ${signUp.offline}`);
    return 1;
  }
  if (!signUp.json?.idToken) {
    console.error("✗ Não consegui criar o usuário no Auth emulado:", JSON.stringify(signUp.json));
    return 1;
  }

  const t0 = Date.now();
  const turn = await postJson(
    `${FUNCTIONS}/debateTurn`,
    {
      data: {
        committeeId: "TPI",
        locale: "pt-BR",
        userText: "A Palestina aderiu ao Estatuto de Roma em 2015. Pelo art. 12, a Corte é competente sobre crimes no território de um Estado-Parte.",
        setup: {
          committeeName: "TPI: O Julgamento de Benjamin Netanyahu",
          topic: "Competência do TPI",
          userCountry: { code2: "ACUS", name: "Bloco da Acusação" },
          aiDelegation: { code2: "DEF", name: "Bloco da Defesa" },
          difficulty: "intermediate",
        },
      },
    },
    { Authorization: `Bearer ${signUp.json.idToken}` },
  );
  if (turn.offline) {
    console.error(`✗ Functions emulado fora do ar em ${FUNCTIONS}: ${turn.offline}`);
    return 1;
  }

  if (turn.json?.error) {
    console.error(`✗ debateTurn falhou (HTTP ${turn.status}):`, JSON.stringify(turn.json.error));
    console.error("  → Veja o log do emulador (llm_call_failed / debate_turn_config_error) e rode npm run check:gemini.");
    return 1;
  }
  const r = turn.json.result;
  console.log(`✓ Primeira fala ok em ${Date.now() - t0} ms · modelo ${r.model}${r.usedFallback ? " (reserva)" : ""} · debateId ${r.debateId}`);
  console.log(`  cota: ${JSON.stringify(r.quota)}`);
  console.log(`  réplica: ${r.text.slice(0, 300)}${r.text.length > 300 ? "…" : ""}`);
  return 0;
}

process.exitCode = await main();
