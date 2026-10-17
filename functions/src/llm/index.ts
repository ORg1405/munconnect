// Provedor ativo. Hoje: só Gemini. Para plugar outro provedor depois, crie uma
// classe que implemente LLMProvider e troque aqui.

import { GEMINI_API_KEY } from "../params.js";
import { GeminiProvider } from "./gemini.js";
import type { LLMProvider } from "./provider.js";

let provider: LLMProvider | null = null;

export function getProvider(): LLMProvider {
  if (!provider) provider = new GeminiProvider(GEMINI_API_KEY.value());
  return provider;
}

// Só para testes.
export function setProviderForTests(p: LLMProvider | null): void {
  provider = p;
}
