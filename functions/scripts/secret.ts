// Lê GEMINI_API_KEY para os scripts locais: variável de ambiente ou, se
// ausente, functions/.secret.local (mesmo arquivo que o emulador usa). Nunca
// imprima o valor — só a origem e o diagnóstico de formato.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SECRET_FILE = join(import.meta.dirname, "..", ".secret.local");

export function readGeminiKey(): { key: string | undefined; source: string } {
  if (process.env.GEMINI_API_KEY !== undefined) return { key: process.env.GEMINI_API_KEY, source: "variável GEMINI_API_KEY" };
  if (!existsSync(SECRET_FILE)) return { key: undefined, source: `${SECRET_FILE} (não existe)` };
  const line = readFileSync(SECRET_FILE, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .find((l) => l.startsWith("GEMINI_API_KEY="));
  if (line === undefined) return { key: undefined, source: `${SECRET_FILE} (sem a linha GEMINI_API_KEY=)` };
  return { key: line.slice("GEMINI_API_KEY=".length).trim().replace(/^"|"$/g, ""), source: SECRET_FILE };
}
