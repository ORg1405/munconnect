// Persistência (Admin SDK — ignora as Security Rules).
//
//   debates/{debateId}
//     { uid, committeeId, locale, setup, status: "active"|"finished",
//       turnCount (reservados), completedTurns, pendingTurn: {index, startedAt}|null,
//       summary, summaryUpTo, usage: {inputTokens, outputTokens, thoughtsTokens,
//       cachedTokens, costUsd, calls}, reportStatus, report, createdAt, updatedAt,
//       lastTurnAt }
//   debates/{debateId}/turns/{000N}
//     { index, userText, opponentText, model, usedFallback, usage, costUsd,
//       latencyMs, createdAt, analysisStatus, analysis? }
//   usage/{uid}                { lastTurnAt }
//   usage/{uid}/days/{AAAA-MM-DD}
//     { date, debates, turns, reports, inputTokens, outputTokens, thoughtsTokens,
//       cachedTokens, costUsd, calls }

import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { QUOTA } from "./config.js";
import type { DebateSetup, TurnRecord } from "./context.js";
import { quotaError } from "./errors.js";
import type { LLMUsage } from "./llm/provider.js";
import { checkTurnQuota, type QuotaRemaining } from "./quota.js";
import { dayKey } from "./time.js";

export function db(): Firestore {
  // Checa o app [DEFAULT] especificamente: em triggers o firebase-functions cria
  // um app interno com outro nome, então getApps().length não basta.
  if (!getApps().some((a) => a.name === "[DEFAULT]")) initializeApp();
  return getFirestore();
}

export const paths = {
  debate: (id: string) => db().collection("debates").doc(id),
  turns: (id: string) => db().collection("debates").doc(id).collection("turns"),
  turn: (id: string, index: number) => paths.turns(id).doc(turnDocId(index)),
  usage: (uid: string) => db().collection("usage").doc(uid),
  day: (uid: string, key: string) => db().collection("usage").doc(uid).collection("days").doc(key),
};

// Zero à esquerda: a ordem alfabética dos IDs bate com a ordem dos turnos.
export function turnDocId(index: number): string {
  return String(index).padStart(4, "0");
}

export interface DebateDoc {
  uid: string;
  committeeId: string;
  locale: string;
  setup: DebateSetup;
  status: "active" | "finished";
  turnCount: number;
  completedTurns: number;
  pendingTurn: { index: number; startedAt: Timestamp } | null;
  summary: string;
  summaryUpTo: number;
  usage: LLMUsage & { costUsd: number; calls: number };
  reportStatus: null | "generating" | "done" | "error";
  reportStartedAt?: Timestamp | null;
  report?: unknown;
}

function usageIncrements(usage: LLMUsage, costUsd: number, prefix = ""): Record<string, FieldValue> {
  return {
    [`${prefix}inputTokens`]: FieldValue.increment(usage.inputTokens),
    [`${prefix}outputTokens`]: FieldValue.increment(usage.outputTokens),
    [`${prefix}thoughtsTokens`]: FieldValue.increment(usage.thoughtsTokens),
    [`${prefix}cachedTokens`]: FieldValue.increment(usage.cachedTokens),
    [`${prefix}costUsd`]: FieldValue.increment(costUsd),
    [`${prefix}calls`]: FieldValue.increment(1),
  };
}

// ── Turnos ───────────────────────────────────────────────────────────────────

export interface TurnReservation {
  debateId: string;
  isNew: boolean;
  turnIndex: number;
  dayKey: string;
  previousUserLastTurnAt: Timestamp | null;
  debate: Pick<DebateDoc, "committeeId" | "locale" | "setup" | "summary" | "summaryUpTo" | "usage">;
  remaining: QuotaRemaining;
}

/**
 * Reserva um turno em UMA transação: confere dono/status do debate, cota diária
 * de debates, limite de turnos, intervalo mínimo e trava de turno em andamento;
 * se tudo ok, já incrementa os contadores (a reserva é desfeita em releaseTurn
 * se a chamada ao modelo falhar).
 */
export async function reserveTurn(args: {
  uid: string;
  debateId: string;
  isNew: boolean;
  committeeId: string;
  locale: string;
  setup: DebateSetup | null;
  now: Date;
}): Promise<TurnReservation> {
  const { uid, debateId, isNew, now } = args;
  const key = dayKey(now, QUOTA.timeZone);
  const debateRef = paths.debate(debateId);
  const usageRef = paths.usage(uid);
  const dayRef = paths.day(uid, key);

  return db().runTransaction(async (tx) => {
    const [debateSnap, usageSnap, daySnap] = await tx.getAll(debateRef, usageRef, dayRef);
    let debate: DebateDoc | null = null;
    if (isNew) {
      if (debateSnap.exists) throw new HttpsError("already-exists", "Debate já existe.");
    } else {
      if (!debateSnap.exists) throw new HttpsError("not-found", "Debate não encontrado.");
      debate = debateSnap.data() as DebateDoc;
      if (debate.uid !== uid) throw new HttpsError("permission-denied", "Este debate pertence a outra pessoa.");
      if (debate.committeeId !== args.committeeId) throw new HttpsError("invalid-argument", "committeeId não confere com o debate.");
      if (debate.status !== "active" || debate.reportStatus === "generating" || debate.reportStatus === "done") {
        throw new HttpsError("failed-precondition", "Este debate já foi encerrado. Comece um novo debate.");
      }
    }

    const previousUserLastTurnAt = (usageSnap.get("lastTurnAt") as Timestamp | undefined) ?? null;
    const decision = checkTurnQuota({
      now,
      isNewDebate: isNew,
      debatesToday: (daySnap.get("debates") as number | undefined) ?? 0,
      userLastTurnAt: previousUserLastTurnAt?.toDate() ?? null,
      debateTurnCount: debate?.turnCount ?? 0,
      debatePendingTurnAt: debate?.pendingTurn?.startedAt?.toDate() ?? null,
    });
    if (!decision.ok) throw quotaError(decision.violation);

    const nowTs = Timestamp.fromDate(now);
    const pendingTurn = { index: decision.turnIndex, startedAt: nowTs };
    if (isNew) {
      const fresh: DebateDoc & Record<string, unknown> = {
        uid,
        committeeId: args.committeeId,
        locale: args.locale,
        setup: args.setup as DebateSetup,
        status: "active",
        turnCount: 1,
        completedTurns: 0,
        pendingTurn,
        summary: "",
        summaryUpTo: 0,
        usage: { inputTokens: 0, outputTokens: 0, thoughtsTokens: 0, cachedTokens: 0, costUsd: 0, calls: 0 },
        reportStatus: null,
        createdAt: nowTs,
        updatedAt: nowTs,
        lastTurnAt: nowTs,
      };
      tx.create(debateRef, fresh);
      debate = fresh;
    } else {
      tx.update(debateRef, { turnCount: decision.turnIndex, pendingTurn, lastTurnAt: nowTs, updatedAt: nowTs });
    }
    tx.set(usageRef, { lastTurnAt: nowTs }, { merge: true });
    tx.set(
      dayRef,
      { date: key, turns: FieldValue.increment(1), debates: FieldValue.increment(isNew ? 1 : 0), updatedAt: nowTs },
      { merge: true },
    );

    const d = debate as DebateDoc;
    return {
      debateId,
      isNew,
      turnIndex: decision.turnIndex,
      dayKey: key,
      previousUserLastTurnAt,
      debate: { committeeId: d.committeeId, locale: d.locale, setup: d.setup, summary: d.summary, summaryUpTo: d.summaryUpTo, usage: d.usage },
      remaining: decision.remaining,
    };
  });
}

// Desfaz a reserva quando o modelo falhou: o turno não conta na cota e o aluno
// pode tentar de novo na hora (intervalo mínimo restaurado).
export async function releaseTurn(uid: string, r: TurnReservation): Promise<void> {
  const debateRef = paths.debate(r.debateId);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(debateRef);
    if (!snap.exists) return;
    const d = snap.data() as DebateDoc;
    if (d.pendingTurn?.index !== r.turnIndex) return; // já liberado/concluído
    if (r.isNew) {
      tx.delete(debateRef);
    } else {
      tx.update(debateRef, { turnCount: r.turnIndex - 1, pendingTurn: null, updatedAt: FieldValue.serverTimestamp() });
    }
    tx.set(paths.usage(uid), { lastTurnAt: r.previousUserLastTurnAt }, { merge: true });
    tx.set(
      paths.day(uid, r.dayKey),
      { turns: FieldValue.increment(-1), debates: FieldValue.increment(r.isNew ? -1 : 0) },
      { merge: true },
    );
  });
}

// Grava o turno concluído (dispara o trigger de análise) e acumula uso/custo.
export async function completeTurn(args: {
  uid: string;
  reservation: TurnReservation;
  userText: string;
  opponentText: string;
  model: string;
  usedFallback: boolean;
  usage: LLMUsage;
  costUsd: number;
  latencyMs: number;
}): Promise<void> {
  const r = args.reservation;
  const batch = db().batch();
  batch.create(paths.turn(r.debateId, r.turnIndex), {
    index: r.turnIndex,
    userText: args.userText,
    opponentText: args.opponentText,
    model: args.model,
    usedFallback: args.usedFallback,
    usage: args.usage,
    costUsd: args.costUsd,
    latencyMs: args.latencyMs,
    createdAt: FieldValue.serverTimestamp(),
    analysisStatus: "pending",
  });
  batch.update(paths.debate(r.debateId), {
    pendingTurn: null,
    completedTurns: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
    ...usageIncrements(args.usage, args.costUsd, "usage."),
  });
  batch.set(paths.day(args.uid, r.dayKey), usageIncrementsFlat(args.usage, args.costUsd), { merge: true });
  await batch.commit();
}

function usageIncrementsFlat(usage: LLMUsage, costUsd: number): Record<string, FieldValue> {
  return usageIncrements(usage, costUsd);
}

// Uso de chamadas assíncronas (análise, resumo) — soma no debate e no dia.
export async function addAsyncUsage(args: { uid: string; debateId: string; at: Date; usage: LLMUsage; costUsd: number }): Promise<void> {
  const batch = db().batch();
  batch.update(paths.debate(args.debateId), usageIncrements(args.usage, args.costUsd, "usage."));
  batch.set(paths.day(args.uid, dayKey(args.at, QUOTA.timeZone)), usageIncrementsFlat(args.usage, args.costUsd), { merge: true });
  await batch.commit();
}

export async function loadRecentTurns(debateId: string, limit: number): Promise<TurnRecord[]> {
  const snap = await paths.turns(debateId).orderBy("index", "desc").limit(limit).get();
  return snap.docs.map((d) => toTurnRecord(d.data())).reverse();
}

export async function loadTurnRange(debateId: string, fromIndex: number, toIndex: number): Promise<TurnRecord[]> {
  const snap = await paths.turns(debateId).where("index", ">=", fromIndex).where("index", "<=", toIndex).orderBy("index").get();
  return snap.docs.map((d) => toTurnRecord(d.data()));
}

export async function loadAllTurns(debateId: string): Promise<TurnRecord[]> {
  const snap = await paths.turns(debateId).orderBy("index").get();
  return snap.docs.map((d) => toTurnRecord(d.data()));
}

function toTurnRecord(data: FirebaseFirestore.DocumentData): TurnRecord {
  return { index: data.index, userText: data.userText, opponentText: data.opponentText };
}

// Grava o resumo só se ele avançar (triggers podem chegar fora de ordem).
export async function saveSummary(debateId: string, summary: string, upTo: number): Promise<boolean> {
  const ref = paths.debate(debateId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || ((snap.get("summaryUpTo") as number) ?? 0) >= upTo) return false;
    tx.update(ref, { summary, summaryUpTo: upTo, updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

// Marca o turno como "running" uma única vez (o trigger pode ser entregue 2x).
export async function claimTurnAnalysis(ref: DocumentReference): Promise<boolean> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("analysisStatus") !== "pending") return false;
    tx.update(ref, { analysisStatus: "running" });
    return true;
  });
}

// ── Relatório ────────────────────────────────────────────────────────────────

export type ReportReservation =
  | { kind: "cached"; report: unknown }
  | { kind: "reserved"; debate: DebateDoc; dayKey: string };

export async function reserveReport(uid: string, debateId: string, now: Date): Promise<ReportReservation> {
  const ref = paths.debate(debateId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Debate não encontrado.");
    const d = snap.data() as DebateDoc;
    if (d.uid !== uid) throw new HttpsError("permission-denied", "Este debate pertence a outra pessoa.");
    if (d.reportStatus === "done" && d.report) return { kind: "cached", report: d.report } as const;
    const startedAt = d.reportStartedAt?.toDate();
    if (d.reportStatus === "generating" && startedAt && now.getTime() - startedAt.getTime() < QUOTA.reportLockSeconds * 1000) {
      throw new HttpsError("failed-precondition", "Seu relatório já está sendo gerado. Aguarde alguns instantes.", { reason: "report-in-progress" });
    }
    if (d.pendingTurn) {
      throw new HttpsError("failed-precondition", "Aguarde a resposta da última fala antes de encerrar.", { reason: "turn-in-progress" });
    }
    if ((d.completedTurns ?? 0) < QUOTA.minUserTurnsForReport) {
      throw new HttpsError(
        "failed-precondition",
        `São necessárias pelo menos ${QUOTA.minUserTurnsForReport} falas suas para gerar o relatório.`,
        { reason: "too-few-turns" },
      );
    }
    tx.update(ref, { reportStatus: "generating", reportStartedAt: Timestamp.fromDate(now), updatedAt: Timestamp.fromDate(now) });
    return { kind: "reserved", debate: d, dayKey: dayKey(now, QUOTA.timeZone) } as const;
  });
}

export async function saveReport(args: {
  uid: string;
  debateId: string;
  dayKey: string;
  report: unknown;
  model: string;
  usage: LLMUsage;
  costUsd: number;
}): Promise<void> {
  const batch = db().batch();
  batch.update(paths.debate(args.debateId), {
    report: args.report,
    reportModel: args.model,
    reportStatus: "done",
    status: "finished",
    finishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    ...usageIncrements(args.usage, args.costUsd, "usage."),
  });
  batch.set(
    paths.day(args.uid, args.dayKey),
    { ...usageIncrementsFlat(args.usage, args.costUsd), reports: FieldValue.increment(1) },
    { merge: true },
  );
  await batch.commit();
}

export async function failReport(debateId: string): Promise<void> {
  await paths.debate(debateId).update({ reportStatus: "error", updatedAt: FieldValue.serverTimestamp() });
}
