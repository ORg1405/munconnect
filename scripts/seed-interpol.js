// scripts/seed-interpol.js
// ─────────────────────────────────────────────────────────────────────────────
// Adiciona o comitê INTERPOL à simulação SISA, espelhando o shape de dados do
// scripts/seed.js (mesmo SDK cliente do firebase, sem service account).
//
// COMO RODAR:
//   node scripts/seed-interpol.js
//
// Pré-requisitos (idênticos ao seed.js):
//   • .env.local preenchido com VITE_FIREBASE_*
//   • Firestore acessível para escrita. Se as regras exigirem login:
//       SEED_EMAIL=voce@ex.com SEED_PASSWORD=suasenha node scripts/seed-interpol.js
//
// NÃO SOBRESCREVE nada:
//   • Se já existir uma conference "SISA" (id "sisa" OU campo nome === "SISA"),
//     reaproveita o id existente sem reescrever o doc.
//   • Se não existir, cria conferences/sisa com { nome: "SISA" } (mesmo shape
//     mínimo dos outros docs de conference — ver scripts/seed.js linha 77).
//   • Se o comitê "interpol" já existir na conference, ABORTA sem escrever, pra
//     não sobrescrever dados. Delete manualmente antes de recriar, se preciso.
//
// DECISÕES DE SCHEMA (confirmadas com o solicitante):
//   1. "Tema" do comitê → gravado no campo `descricao` já existente (o schema de
//      committee não tem campo `tema` próprio). Ver seed.js: committee =
//      { sigla, nomeCompleto, descricao, ordem }.
//   2. Texto de cada item da agenda → novo campo `titulo` no subitem. Os subitems
//      do seed atual só têm { label, status, committeeId, ordem }; adicionamos
//      `titulo` pra preservar o texto (a UI atual mostra só o label, mas o dado
//      fica salvo e pronto pra exibir).
//   3. TERCEIRO NÍVEL (ex.: 2.2.1) → não há precedente no seed atual (a hierarquia
//      é topics → subitems, plana). Introduzimos o campo `parentSubitemId` no
//      subitem filho, apontando para o id do subitem pai (mesma subcollection,
//      mesmo topicId). Os subitems de 1º nível não recebem o campo. O collectionGroup
//      listener (subscribeCommitteeSubitems) continua trazendo todos via committeeId,
//      e a ordem de leitura é preservada pelo campo `ordem`.
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
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Carrega .env.local sem depender de dotenv (igual ao seed.js) ──────────────
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

// ── Comitê INTERPOL ───────────────────────────────────────────────────────────
// topics[].subitems[] com titulo (texto da agenda) + status inicial "incomplete".
// O item de 3º nível (2.2.1) carrega parentSubitemId (ver comentário no topo).
const COMMITTEE = {
  id: "interpol",
  sigla: "INTERPOL",
  nomeCompleto: "Organização Internacional de Polícia Criminal",
  descricao: "As redes de tráfico do século XXI", // decisão #1: tema → descricao
  topics: [
    {
      id: "interpol-t1",
      titulo: "Tópico 1 — O crescimento do tráfico no mundo virtual",
      subitems: [
        {
          id: "interpol-1-1",
          label: "1.1",
          titulo:
            "Potencialização do recrutamento para organizações por meio das redes sociais",
        },
        {
          id: "interpol-1-2",
          label: "1.2",
          titulo: "Manifestações do narcotráfico no meio digital",
        },
        {
          id: "interpol-1-3",
          label: "1.3",
          titulo: "A responsabilidade das big techs na fiscalização da internet",
        },
      ],
    },
    {
      id: "interpol-t2",
      titulo: "Tópico 2 — A sofisticação dos cartéis na contemporaneidade",
      subitems: [
        {
          id: "interpol-2-1",
          label: "2.1",
          titulo:
            "Novas formas de lavagem de dinheiro, por meio de criptomoedas e outros mecanismos em blockchain",
        },
        {
          id: "interpol-2-2",
          label: "2.2",
          titulo: "A ascensão dos novos narcoestados",
        },
        {
          id: "interpol-2-2-1",
          label: "2.2.1",
          titulo:
            "Interferência de grandes facções na política e no sistema judiciário de países pelo mundo",
          parentSubitemId: "interpol-2-2", // 3º nível → aninhado sob 2.2
        },
        {
          id: "interpol-2-3",
          label: "2.3",
          titulo: "Novas rotas de contrabando",
        },
      ],
    },
    {
      id: "interpol-t3",
      titulo: "Tópico 3 — A epidemia de opioides sintéticos pelo globo",
      subitems: [
        {
          id: "interpol-3-1",
          label: "3.1",
          titulo: "Contrabando de substâncias controladas",
        },
        {
          id: "interpol-3-2",
          label: "3.2",
          titulo:
            "Surgimento de novos compostos não contemplados pelas antigas convenções",
        },
        {
          id: "interpol-3-3",
          label: "3.3",
          titulo:
            'A banalização do consumo de entorpecentes lícitos, como as "smart drugs", e seus impactos',
        },
      ],
    },
  ],
};

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

  // 1) Localiza (ou cria) a conference SISA sem sobrescrever.
  const confsSnap = await getDocs(collection(db, "conferences"));
  let confId = null;
  for (const d of confsSnap.docs) {
    const nome = String(d.data().nome ?? "").trim().toLowerCase();
    if (d.id === "sisa" || nome === "sisa") {
      confId = d.id;
      break;
    }
  }

  if (confId) {
    console.log(`✓ Conference SISA já existe → reaproveitando conferences/${confId} (sem sobrescrever)`);
  } else {
    confId = "sisa";
    await setDoc(doc(db, "conferences", confId), { nome: "SISA" });
    console.log(`✓ Conference criada → conferences/${confId} { nome: "SISA" }`);
  }

  const confRef = doc(db, "conferences", confId);

  // 2) Aborta se o comitê já existir (não sobrescreve).
  const comRef = doc(confRef, "committees", COMMITTEE.id);
  const comSnap = await getDoc(comRef);
  if (comSnap.exists()) {
    console.error(
      `\n✗ conferences/${confId}/committees/${COMMITTEE.id} já existe — abortando pra não sobrescrever.\n` +
        "  Delete o comitê manualmente no console se quiser recriá-lo."
    );
    process.exit(1);
  }

  // 3) ordem do comitê = maior ordem existente + 1 (não colide com os já criados).
  const existingComs = await getDocs(collection(confRef, "committees"));
  const maxOrdem = existingComs.docs.reduce(
    (m, d) => Math.max(m, Number(d.data().ordem ?? 0)),
    0
  );

  const created = { conference: confId, committee: null, topics: [], subitems: [] };

  // 4) Escreve o comitê.
  const { id: comId, topics, ...comData } = COMMITTEE;
  await setDoc(comRef, { ...comData, ordem: maxOrdem + 1 });
  created.committee = `${comId} (ordem ${maxOrdem + 1})`;
  console.log(`\n✓ committees/${comId}`);

  // 5) Escreve topics + subitems.
  for (let ti = 0; ti < topics.length; ti++) {
    const { id: topicId, subitems, ...topicData } = topics[ti];
    const topicRef = doc(comRef, "topics", topicId);
    await setDoc(topicRef, { ...topicData, ordem: ti + 1 });
    created.topics.push(topicId);

    for (let si = 0; si < subitems.length; si++) {
      const { id: subId, parentSubitemId, ...subData } = subitems[si];
      const payload = {
        ...subData, // label, titulo
        status: "incomplete", // decisão: todos começam incompletos
        committeeId: comId, // usado pelo collectionGroup listener
        ordem: si + 1,
      };
      // parentSubitemId só existe no item de 3º nível (ver comentário no topo).
      if (parentSubitemId) payload.parentSubitemId = parentSubitemId;

      await setDoc(doc(topicRef, "subitems", subId), payload);
      created.subitems.push(subId);
    }
    console.log(`  ✓ topics/${topicId} (+${subitems.length} subitems)`);
  }

  // 6) Relatório final com os IDs gerados.
  console.log("\n─────────────────────────────────────────────");
  console.log("✓ Seed do INTERPOL concluído. IDs criados:");
  console.log(`  conference : conferences/${created.conference}`);
  console.log(`  committee  : ${created.committee}`);
  console.log(`  topics     : ${created.topics.join(", ")}`);
  console.log(`  subitems   : ${created.subitems.join(", ")}`);
  console.log("─────────────────────────────────────────────");
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
