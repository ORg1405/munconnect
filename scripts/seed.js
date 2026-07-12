// scripts/seed.js
// ─────────────────────────────────────────────────────────────────────────────
// Popula o Firestore com a simulação de exemplo (DiploMUN 2026), espelhando o
// antigo mock. Usa o SDK cliente do firebase (já instalado) — não precisa de
// service account nem de dependência nova.
//
// COMO RODAR:
//   node scripts/seed.js
//
// Pré-requisitos:
//   • .env.local preenchido com VITE_FIREBASE_*  (já está)
//   • Firestore acessível para escrita. Duas opções:
//       a) Banco em "modo de teste" (regras abertas) → roda direto.
//       b) Regras exigem login → exporte credenciais de uma conta já criada:
//            SEED_EMAIL e SEED_PASSWORD
//          ex (Git Bash):
//            SEED_EMAIL=voce@ex.com SEED_PASSWORD=suasenha node scripts/seed.js
//
// É idempotente: usa setDoc com ids fixos, então rodar de novo só sobrescreve.
// NÃO cria/edita o doc members/{uid} (o seu papel de diretor) — isso você faz no
// console depois de criar sua conta, como combinado.
// ─────────────────────────────────────────────────────────────────────────────

import { setDefaultResultOrder } from "node:dns";
// Força IPv4 na resolução DNS antes de qualquer import/chamada do Firebase. No
// Windows a preferência por IPv6 pode causar auth/network-request-failed.
setDefaultResultOrder("ipv4first");

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Carrega .env.local sem depender de dotenv ─────────────────────────────────
function loadEnv() {
  const path = resolve(__dirname, "..", ".env.local");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Não encontrei ${path}. Crie a partir de .env.local.example.`);
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error("✗ VITE_FIREBASE_* ausentes no .env.local.");
  process.exit(1);
}

const CONFERENCE_ID = "diplomun-2026";

// ── Dados (espelham o mock; subitems carregam committeeId) ────────────────────
const conference = { nome: "DiploMUN 2026" };

const committees = [
  {
    id: "disec",
    sigla: "DISEC",
    nomeCompleto: "Comitê de Desarmamento e Segurança Internacional",
    descricao:
      "Primeira comissão da Assembleia Geral. Debate ameaças à paz, regimes de desarmamento e o controle de tecnologias militares emergentes.",
    ordem: 1,
    topics: [
      {
        id: "disec-t1",
        titulo: "Tópico 1 — Regulação de sistemas de armas autônomas letais",
        ordem: 1,
        subitems: [
          { id: "disec-1-1", label: "1.1", status: "complete" },
          { id: "disec-1-2", label: "1.2", status: "complete" },
          { id: "disec-1-3", label: "1.3", status: "needs_revision" },
        ],
      },
      {
        id: "disec-t2",
        titulo: "Tópico 2 — Desmilitarização do espaço sideral",
        ordem: 2,
        subitems: [
          { id: "disec-2-1", label: "2.1", status: "needs_revision" },
          { id: "disec-2-2", label: "2.2", status: "incomplete" },
          { id: "disec-2-3", label: "2.3", status: "incomplete" },
        ],
      },
    ],
    documents: [
      {
        id: "disec-d1",
        titulo: "WP — Definições operativas e escopo de autonomia",
        topicId: "disec-t1",
        tipo: "working",
        autor: "Delegação da Suíça",
      },
      {
        id: "disec-d2",
        titulo: "WP — Mecanismo de verificação sob a CCW",
        topicId: "disec-t1",
        tipo: "working",
        autor: "Delegação do Brasil",
      },
      {
        id: "disec-d3",
        titulo: "WP — Moratória de testes ASAT destrutivos",
        topicId: "disec-t2",
        tipo: "working",
        autor: "Delegação do Japão",
      },
    ],
  },
  {
    id: "cdh",
    sigla: "CDH",
    nomeCompleto: "Conselho de Direitos Humanos",
    descricao:
      "Fórum responsável pela promoção e proteção dos direitos humanos. Examina violações e recomenda respostas à comunidade internacional.",
    ordem: 2,
    topics: [
      {
        id: "cdh-t1",
        titulo: "Tópico 1 — Direitos digitais e vigilância estatal",
        ordem: 1,
        subitems: [
          { id: "cdh-1-1", label: "1.1", status: "complete" },
          { id: "cdh-1-2", label: "1.2", status: "complete" },
          { id: "cdh-1-3", label: "1.3", status: "complete" },
          { id: "cdh-1-4", label: "1.4", status: "needs_revision" },
        ],
      },
    ],
    documents: [
      {
        id: "cdh-d1",
        titulo: "WP — Salvaguardas judiciais para interceptação de dados",
        topicId: "cdh-t1",
        tipo: "working",
        autor: "Delegação da Estônia",
      },
    ],
  },
  {
    id: "csnu",
    sigla: "CSNU",
    nomeCompleto: "Conselho de Segurança das Nações Unidas",
    descricao:
      "Órgão com mandato de manter a paz e a segurança internacionais. Crises em tempo real, vetos e resoluções vinculantes.",
    ordem: 3,
    topics: [
      {
        id: "csnu-t1",
        titulo: "Tópico 1 — A situação no Sahel e missões de paz híbridas",
        ordem: 1,
        subitems: [
          { id: "csnu-1-1", label: "1.1", status: "needs_revision" },
          { id: "csnu-1-2", label: "1.2", status: "incomplete" },
          { id: "csnu-1-3", label: "1.3", status: "incomplete" },
          { id: "csnu-1-4", label: "1.4", status: "incomplete" },
        ],
      },
    ],
    documents: [
      {
        id: "csnu-d1",
        titulo: "WP — Mandato de transição para a força regional",
        topicId: "csnu-t1",
        tipo: "working",
        autor: "Delegação da França",
      },
    ],
  },
];

// ── Execução ──────────────────────────────────────────────────────────────────
async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  if (process.env.SEED_EMAIL && process.env.SEED_PASSWORD) {
    const auth = getAuth(app);
    await signInWithEmailAndPassword(
      auth,
      process.env.SEED_EMAIL,
      process.env.SEED_PASSWORD
    );
    console.log(`✓ Autenticado como ${process.env.SEED_EMAIL}`);
  }

  const confRef = doc(db, "conferences", CONFERENCE_ID);
  await setDoc(confRef, conference);
  console.log(`✓ conferences/${CONFERENCE_ID}`);

  let n = 1;
  for (const com of committees) {
    const { id, topics, documents, ...comData } = com;
    const comRef = doc(confRef, "committees", id);
    await setDoc(comRef, comData);
    console.log(`  ✓ committees/${id}`);

    for (const topic of topics) {
      const { id: topicId, subitems, ...topicData } = topic;
      const topicRef = doc(comRef, "topics", topicId);
      await setDoc(topicRef, topicData);

      for (const sub of subitems) {
        const { id: subId, ...subData } = sub;
        // committeeId é o campo usado pelo collectionGroup listener.
        await setDoc(doc(topicRef, "subitems", subId), {
          ...subData,
          committeeId: id,
          ordem: subitems.indexOf(sub) + 1,
        });
      }
      console.log(`    ✓ topics/${topicId} (+${subitems.length} subitems)`);
    }

    for (const docData of documents) {
      const { id: docId, ...rest } = docData;
      await setDoc(doc(comRef, "documents", docId), {
        ...rest,
        createdAt: serverTimestamp(),
      });
    }
    console.log(`    ✓ ${documents.length} documents`);
    n++;
  }

  console.log(`\n✓ Seed concluído: 1 conference, ${committees.length} comitês.`);
  console.log(
    "Próximo passo: crie sua conta no app e, no console, adicione\n" +
      `  conferences/${CONFERENCE_ID}/committees/disec/members/<seu-uid> → { role: "director" }`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Falha no seed:", err.message || err);
  if (err.code === "permission-denied") {
    console.error(
      "  Regras do Firestore bloquearam a escrita. Use o modo de teste OU\n" +
        "  rode com SEED_EMAIL e SEED_PASSWORD de uma conta autorizada."
    );
  }
  process.exit(1);
});
