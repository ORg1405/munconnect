// Segredos e parâmetros de deploy.

import { defineBoolean, defineSecret } from "firebase-functions/params";

// Chave da Gemini API — SÓ no Secret Manager:
//   firebase functions:secrets:set GEMINI_API_KEY
// No emulador, vem de functions/.secret.local (gitignored).
export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// App Check nos callables. true em produção; false no emulador/desenvolvimento
// via functions/.env.local (ENFORCE_APP_CHECK=false).
export const ENFORCE_APP_CHECK = defineBoolean("ENFORCE_APP_CHECK", {
  default: true,
  description: "Rejeitar chamadas sem token válido do App Check.",
});
