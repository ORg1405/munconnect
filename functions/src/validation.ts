// Validação da entrada dos callables + checagem de Auth. Tudo que vem do
// cliente é tratado como não confiável.

import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { LIMITS } from "./config.js";
import { COMMITTEE_ID_RE, type DebateSetup, type Delegation } from "./context.js";

export interface DebateTurnInput {
  debateId: string | null;
  committeeId: string;
  userText: string;
  locale: string;
  setup: DebateSetup | null; // obrigatório só no primeiro turno (sem debateId)
}

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
const LOCALE_RE = /^[a-z]{2}(-[A-Z]{2})?$/;
const DOC_ID_RE = /^[A-Za-z0-9]{10,40}$/;

function bad(message: string): never {
  throw new HttpsError("invalid-argument", message);
}

function str(v: unknown, field: string, max: number = LIMITS.maxSetupFieldChars): string {
  if (typeof v !== "string" || !v.trim()) bad(`Campo obrigatório: ${field}.`);
  const s = v.trim();
  if (s.length > max) bad(`Campo muito longo: ${field} (máx. ${max} caracteres).`);
  return s;
}

function delegation(v: unknown, field: string): Delegation {
  const o = (v ?? {}) as Record<string, unknown>;
  return { code2: str(o.code2, `${field}.code2`, 8), name: str(o.name, `${field}.name`) };
}

export function requireUser(request: CallableRequest<unknown>): string {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Faça login para usar o treino de debate.");
  const provider = (auth.token.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider;
  if (provider === "anonymous") throw new HttpsError("unauthenticated", "Crie uma conta para usar o treino de debate.");
  return auth.uid;
}

export function parseDebateId(v: unknown): string {
  if (typeof v !== "string" || !DOC_ID_RE.test(v)) bad("debateId inválido.");
  return v;
}

export function parseSetup(v: unknown, committeeId: string): DebateSetup {
  const o = (v ?? {}) as Record<string, unknown>;
  const difficulty = o.difficulty ?? "intermediate";
  if (!DIFFICULTIES.includes(difficulty as never)) bad("Dificuldade inválida.");
  let sims: number | null = null;
  if (o.simsAnteriores !== undefined && o.simsAnteriores !== null) {
    if (!Number.isInteger(o.simsAnteriores) || (o.simsAnteriores as number) < 0 || (o.simsAnteriores as number) > 99) {
      bad("simsAnteriores inválido.");
    }
    sims = o.simsAnteriores as number;
  }
  return {
    committeeName: typeof o.committeeName === "string" && o.committeeName.trim() ? str(o.committeeName, "committeeName") : committeeId,
    topic: str(o.topic, "setup.topic"),
    userCountry: delegation(o.userCountry, "setup.userCountry"),
    aiDelegation: delegation(o.aiDelegation, "setup.aiDelegation"),
    difficulty: difficulty as DebateSetup["difficulty"],
    nivelDelegado: typeof o.nivelDelegado === "string" && o.nivelDelegado.trim() ? str(o.nivelDelegado, "nivelDelegado") : "Não informado",
    simsAnteriores: sims,
  };
}

export function parseDebateTurnInput(data: unknown): DebateTurnInput {
  const o = (data ?? {}) as Record<string, unknown>;
  const committeeId = str(o.committeeId, "committeeId", 64);
  if (!COMMITTEE_ID_RE.test(committeeId)) bad("committeeId inválido.");
  const userText = str(o.userText, "userText", LIMITS.maxUserTextChars);
  const locale = typeof o.locale === "string" && LOCALE_RE.test(o.locale) ? o.locale : "pt-BR";
  const debateId = o.debateId === undefined || o.debateId === null ? null : parseDebateId(o.debateId);
  const setup = debateId ? null : parseSetup(o.setup, committeeId);
  return { debateId, committeeId, userText, locale, setup };
}
