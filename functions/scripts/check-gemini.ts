// Confere a chave da Gemini API FORA do emulador: formato do valor e uma
// chamada real de countTokens (sem custo de geração). Separa problema de chave
// de problema de rede. Nunca imprime a chave.
//
// Uso (dentro de functions/): npm run check:gemini

import { MODEL_IDS } from "../src/config.js";
import { GeminiProvider, apiKeyProblem } from "../src/llm/gemini.js";
import { LLMError } from "../src/llm/provider.js";
import { readGeminiKey } from "./secret.js";

// process.exitCode em vez de process.exit(): no Node 24/Windows, sair com
// conexões do fetch abertas dispara "Assertion failed: UV_HANDLE_CLOSING".
async function main(): Promise<number> {
  const { key, source } = readGeminiKey();
  console.log(`Origem da chave: ${source}`);
  const problem = apiKeyProblem(key);
  if (problem) {
    console.error(`✗ GEMINI_API_KEY ${problem}`);
    return 1;
  }
  console.log(`Formato ok (${key!.length} caracteres, começa com "${key!.slice(0, 4)}").`);

  try {
    const tokens = await new GeminiProvider(key).countTokens(MODEL_IDS.flashLite35, "teste de conexão");
    console.log(`✓ Gemini respondeu: countTokens = ${tokens} (${MODEL_IDS.flashLite35}). Chave e rede ok.`);
    return 0;
  } catch (err) {
    const e = err instanceof LLMError ? err : null;
    console.error(`✗ Falhou: kind=${e?.kind ?? "?"} status=${e?.status ?? "—"} mensagem=${(err as Error).message}`);
    if (e?.detail) console.error("  detalhe:", JSON.stringify(e.detail));
    if (e?.status === 400 || e?.status === 403) console.error("  → A rede chegou ao Google, mas a API recusou a chave: confira-a no AI Studio.");
    if (e?.kind === "network") console.error("  → Sem conexão com generativelanguage.googleapis.com (proxy, firewall, DNS?).");
    return 1;
  }
}

process.exitCode = await main();
