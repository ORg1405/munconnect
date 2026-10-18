// Regras de debates/{debateId}/turns: o dono do debate só pode gravar o campo
// `disputes` (contestação de falácias). Rode com `npm run test:rules` (sobe o
// emulador do Firestore com firestore.rules).

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let env;
const TURN = "debates/d1/turns/0001";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-munconnect-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});

afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "debates/d1"), { uid: "alice", committeeId: "TPI" });
    await setDoc(doc(db, TURN), {
      index: 1,
      userText: "fala",
      opponentText: "réplica",
      analysisStatus: "done",
      analysis: { rubrica: { estrutura: 2 }, falacias: [{ tipo: "outra" }] },
    });
  });
});

const as = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const turnAs = (uid) => doc(as(uid), TURN);
const many = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), `contestação ${i}`]));

describe("disputes em debates/{id}/turns", () => {
  it("dono grava, edita e acrescenta contestações", async () => {
    await assertSucceeds(updateDoc(turnAs("alice"), { "disputes.0": "O trecho não é falácia, é um dado do dossiê." }));
    await assertSucceeds(updateDoc(turnAs("alice"), { "disputes.3": "Outra contestação." }));
    await assertSucceeds(updateDoc(turnAs("alice"), { disputes: many(10) }));
    await assertSucceeds(getDoc(turnAs("alice")));
  });

  it("outro usuário autenticado não pode gravar", async () => {
    await assertFails(updateDoc(turnAs("bob"), { "disputes.0": "x" }));
  });

  it("usuário não autenticado não pode gravar", async () => {
    await assertFails(updateDoc(turnAs(null), { "disputes.0": "x" }));
  });

  it("o dono não pode mudar nenhum outro campo, nem junto com disputes", async () => {
    await assertFails(updateDoc(turnAs("alice"), { "analysis.rubrica.estrutura": 5 }));
    await assertFails(updateDoc(turnAs("alice"), { analysisStatus: "pending" }));
    await assertFails(updateDoc(turnAs("alice"), { "disputes.0": "x", opponentText: "editado" }));
    await assertFails(updateDoc(turnAs("alice"), { uid: "alice" }));
  });

  it("texto acima de 500 caracteres é recusado (500 passa)", async () => {
    await assertSucceeds(updateDoc(turnAs("alice"), { "disputes.0": "a".repeat(500) }));
    await assertFails(updateDoc(turnAs("alice"), { "disputes.1": "a".repeat(501) }));
  });

  it("mais de 10 entradas ou chave fora de \"0\"..\"9\" são recusadas", async () => {
    await assertFails(updateDoc(turnAs("alice"), { disputes: many(11) }));
    await assertFails(updateDoc(turnAs("alice"), { "disputes.10": "x" }));
    await assertFails(updateDoc(turnAs("alice"), { "disputes.a": "x" }));
  });

  it("tipos inválidos são recusados", async () => {
    await assertFails(updateDoc(turnAs("alice"), { "disputes.0": 42 }));
    await assertFails(updateDoc(turnAs("alice"), { "disputes.0": "" }));
    await assertFails(updateDoc(turnAs("alice"), { "disputes.0": { texto: "x" } }));
    await assertFails(updateDoc(turnAs("alice"), { disputes: "texto solto" }));
    await assertFails(updateDoc(turnAs("alice"), { disputes: ["x"] }));
    await assertFails(updateDoc(turnAs("alice"), { disputes: deleteField() }));
  });

  it("create e delete continuam proibidos, inclusive para o dono", async () => {
    await assertFails(setDoc(doc(as("alice"), "debates/d1/turns/0002"), { disputes: { 0: "x" } }));
    await assertFails(deleteDoc(turnAs("alice")));
  });

  it("o doc do debate continua só leitura", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "debates/d1")));
    await assertFails(updateDoc(doc(as("alice"), "debates/d1"), { disputes: { 0: "x" } }));
  });
});
