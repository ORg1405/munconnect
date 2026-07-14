// src/data/firestore.js
// ─────────────────────────────────────────────────────────────────────────────
// Camada de acesso ao Firestore (real-time via onSnapshot). Cada subscribe*
// retorna a função de unsubscribe do Firebase — chame-a no cleanup do useEffect.
//
// Hierarquia:
//   conferences/{conferenceId}                 { nome }
//     committees/{committeeId}                 { sigla, nomeCompleto, descricao, ordem }
//       topics/{topicId}                       { titulo, ordem }
//         subitems/{subitemId}                 { label, status, committeeId, ordem? }
//       documents/{docId}                      { titulo, autor, autorUid, url (link colado),
//                                                 topicId?, tipo: "working" | "final", createdAt }
//       members/{memberId}                     { role: "director" | "delegate",
//                                                 nome, pais, uid?, memberId, conferenceId,
//                                                 committeeId, committeeName, importBatchId?,
//                                                 createdAt }
//       attendance/{autoId}                    { memberId, checkinAt,
//                                                 source: "qr_totem" | "qr_web" | "manual_director",
//                                                 sessionSlot: null }
//
// Os subitems são lidos por tópico (topics/{topicId}/subitems) — sem query
// collectionGroup, para não depender de índice de collection group. O campo
// committeeId nos subitems é legado (do listener antigo) e hoje é dispensável.
//
// Credenciamento por QR pré-impresso (planilha → import → crachá com QR):
//   • members são criados pela IMPORTAÇÃO de planilha (ver importDelegates), que
//     roda com um usuário admin global. O ID do documento (memberId, também
//     gravado como campo) é o identificador que vai no QR do crachá:
//         https://{origin}/checkin?m={memberId}
//     Delegados não têm conta no site (uid = null). Diretores continuam sendo
//     docs members/{uid} criados à mão no console (nunca vêm da importação) —
//     é por eles que subscribeMemberRole e a rule isDirector reconhecem o papel.
//   • O QR é lido pelo totem (ESP32 + GM65) ou pela câmera do próprio celular do
//     delegado, que abre /checkin. A página/totem chama /api/checkin, que grava
//     attendance com o Admin SDK. O client NUNCA escreve attendance direto — nem
//     o diretor (o botão "marcar presença" também passa pelo endpoint).
//   • attendance é escrito SOMENTE pelo endpoint (Admin SDK); o client só lê
//     (diretor, painel de presença).
//
// Coleções órfãs do modelo RFID antigo (rfidTags/, devices/): não são mais
// lidas nem escritas por nenhum código. Podem ser apagadas manualmente no
// console do Firestore — não há remoção programática.
// ─────────────────────────────────────────────────────────────────────────────

import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase";

// Remove chaves com valor undefined (addDoc/updateDoc rejeitam undefined; "" e
// null são aceitos e usados para campos opcionais em branco).
function pruneUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

// Simulação padrão usada pelos atalhos de navegação (dashboard, "Ver comitês").
// Ajuste conforme a conference criada no Firestore.
export const DEFAULT_CONFERENCE_ID = "diplomun-2026";

const byOrdem = (a, b) =>
  (a.ordem ?? Infinity) - (b.ordem ?? Infinity) ||
  String(a.id).localeCompare(String(b.id));

// Milissegundos de um Firestore Timestamp (aceita a forma serializada { seconds }
// que aparece antes do serverTimestamp resolver). Usado para ordenar por data.
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

// ── Conference ────────────────────────────────────────────────────────────────

export function subscribeConference(conferenceId, cb) {
  return onSnapshot(doc(db, "conferences", conferenceId), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// Todas as conferences (a guia "Comitês" lista os comitês de todas elas).
// Conference só tem { nome }, sem ordem → ordena por nome para estabilidade.
export function subscribeConferences(cb) {
  return onSnapshot(collection(db, "conferences"), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.nome ?? a.id).localeCompare(String(b.nome ?? b.id)))
    );
  });
}

export function subscribeCommittees(conferenceId, cb) {
  const col = collection(db, "conferences", conferenceId, "committees");
  return onSnapshot(col, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrdem));
  });
}

// ── Committee CRUD (admin) ─────────────────────────────────────────────────────
// As regras do Firestore restringem create/update de committees e topics a
// admins (ver firestore.rules). O guard de UI (isAdmin) evita mostrar os botões;
// as regras são a barreira de verdade.

// Cria um comitê e, opcionalmente, seus tópicos iniciais. `data` já vem montado
// pelo chamador (campos do formulário). Retorna o id do comitê criado.
export async function createCommittee(conferenceId, data, topics = [], uid) {
  const col = collection(db, "conferences", conferenceId, "committees");
  const ref = await addDoc(
    col,
    pruneUndefined({
      ...data,
      ordem: data.ordem ?? Date.now(),
      createdBy: uid ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  if (topics.length) await addCommitteeTopics(conferenceId, ref.id, topics, uid);
  return ref.id;
}

// Atualiza os campos do documento do comitê (não mexe em subcoleções).
export function updateCommittee(conferenceId, committeeId, data, uid) {
  const ref = doc(db, "conferences", conferenceId, "committees", committeeId);
  return updateDoc(
    ref,
    pruneUndefined({ ...data, updatedByUid: uid ?? null, updatedAt: serverTimestamp() })
  );
}

// Arquivar / desarquivar (ou qualquer troca de status) — só o campo status muda.
export function setCommitteeStatus(conferenceId, committeeId, status, uid) {
  const ref = doc(db, "conferences", conferenceId, "committees", committeeId);
  return updateDoc(ref, { status, updatedByUid: uid ?? null, updatedAt: serverTimestamp() });
}

function topicsCol(conferenceId, committeeId) {
  return collection(db, "conferences", conferenceId, "committees", committeeId, "topics");
}

// Acrescenta tópicos (e seus subtópicos) a um comitê — append-only, não remove
// nem altera os existentes. Cada tópico:
//   { titulo, subtopics?: [{ titulo }] }
//
// Numeração automática dos subtópicos = `${n}.${m}` onde n é a posição do tópico
// pai (contínua a partir dos tópicos já existentes, para não colidir na edição)
// e m a posição do subtópico. Subitens gravam o schema do INTERPOL:
// { label, titulo, status, ordem } + createdAt/createdBy.
export async function addCommitteeTopics(conferenceId, committeeId, topics = [], uid) {
  if (!topics.length) return;
  const col = topicsCol(conferenceId, committeeId);
  // Offset da numeração: quantos tópicos já existem (0 num comitê recém-criado).
  const existing = await getDocs(col);
  const base = existing.size;

  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    const n = base + i + 1; // número do tópico pai (1-based, contínuo)
    const topicRef = await addDoc(
      col,
      pruneUndefined({
        titulo: t.titulo,
        status: "incomplete", // default para o chip inline do tópico
        ordem: n,
        createdBy: uid ?? null,
        createdAt: serverTimestamp(),
      })
    );

    const subs = (t.subtopics ?? [])
      .map((s) => ({ titulo: (s.titulo ?? "").trim() }))
      .filter((s) => s.titulo);
    if (!subs.length) continue;

    const subCol = collection(col, topicRef.id, "subitems");
    await Promise.all(
      subs.map((s, m) =>
        addDoc(
          subCol,
          pruneUndefined({
            label: `${n}.${m + 1}`, // 1.1, 1.2, 2.1… gerado automaticamente
            titulo: s.titulo,
            status: "incomplete",
            ordem: m + 1,
            createdBy: uid ?? null,
            createdAt: serverTimestamp(),
          })
        )
      )
    );
  }
}

// Exclui um comitê em cascata. O client SDK não cascateia deletes, então
// listamos e apagamos manualmente, em profundidade:
//   topics/{t}/subitems/{s}  (netos, primeiro)
//   topics/{t}               (depois o tópico)
//   documents/{d}, members/{u}
//   committee                (por último — se algo falhar no meio, o comitê
//                             continua listável e o delete pode ser reexecutado)
// Deletes vão em writeBatch de até 450 ops (limite do Firestore é 500).
export async function deleteCommittee(conferenceId, committeeId) {
  const comRef = doc(db, "conferences", conferenceId, "committees", committeeId);
  const refs = [];

  // Tópicos + subitens (netos).
  const tCol = topicsCol(conferenceId, committeeId);
  const topicsSnap = await getDocs(tCol);
  for (const topicDoc of topicsSnap.docs) {
    const subSnap = await getDocs(collection(tCol, topicDoc.id, "subitems"));
    for (const s of subSnap.docs) refs.push(s.ref);
    refs.push(topicDoc.ref);
  }

  // Documentos e membros (subcoleções diretas do comitê).
  for (const name of ["documents", "members"]) {
    const snap = await getDocs(collection(comRef, name));
    for (const d of snap.docs) refs.push(d.ref);
  }

  // Doc do comitê por último.
  refs.push(comRef);

  await deleteRefsInChunks(refs);
}

// Apaga uma lista de refs em batches (respeitando o limite de 500 ops/batch).
async function deleteRefsInChunks(refs, chunkSize = 450) {
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(i, i + chunkSize)) batch.delete(ref);
    await batch.commit();
  }
}

// ── Committee detail ──────────────────────────────────────────────────────────

export function subscribeCommittee(conferenceId, committeeId, cb) {
  const ref = doc(db, "conferences", conferenceId, "committees", committeeId);
  return onSnapshot(ref, (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export function subscribeTopics(conferenceId, committeeId, cb) {
  const col = collection(
    db,
    "conferences",
    conferenceId,
    "committees",
    committeeId,
    "topics"
  );
  return onSnapshot(col, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrdem));
  });
}

// Todos os subitems do comitê, agregados por UMA subscription por tópico
// (topics/{topicId}/subitems). Evita a query collectionGroup, que exigiria um
// índice de collection group não criado automaticamente — mesmo padrão usado na
// CommitteePage. Usado pelos cards da aba "Comitês" para calcular o progresso.
// Re-subscreve automaticamente quando tópicos entram/saem.
export function subscribeCommitteeSubitems(conferenceId, committeeId, cb) {
  const topicUnsubs = new Map(); // topicId -> unsub do listener de subitems
  const subitemsByTopic = new Map(); // topicId -> subitem[]

  const emit = () => cb([...subitemsByTopic.values()].flat().sort(byOrdem));

  const topicsCol = collection(
    db,
    "conferences",
    conferenceId,
    "committees",
    committeeId,
    "topics"
  );

  const unsubTopics = onSnapshot(
    topicsCol,
    (snap) => {
      const present = new Set(snap.docs.map((d) => d.id));
      // Descarta listeners de tópicos que sumiram.
      for (const [tid, unsub] of topicUnsubs) {
        if (!present.has(tid)) {
          unsub();
          topicUnsubs.delete(tid);
          subitemsByTopic.delete(tid);
        }
      }
      // Cria listener para cada tópico novo.
      for (const d of snap.docs) {
        const tid = d.id;
        if (topicUnsubs.has(tid)) continue;
        const subCol = collection(
          db,
          "conferences",
          conferenceId,
          "committees",
          committeeId,
          "topics",
          tid,
          "subitems"
        );
        const u = onSnapshot(
          subCol,
          (s) => {
            subitemsByTopic.set(
              tid,
              s.docs.map((x) => ({ id: x.id, topicId: tid, ...x.data() }))
            );
            emit();
          },
          (err) => {
            console.error(`[subscribeCommitteeSubitems] ${tid}:`, err.code || err);
            subitemsByTopic.set(tid, []);
            emit();
          }
        );
        topicUnsubs.set(tid, u);
      }
      emit();
    },
    (err) => {
      console.error("[subscribeCommitteeSubitems] topics:", err.code || err);
      cb([]);
    }
  );

  return () => {
    unsubTopics();
    for (const u of topicUnsubs.values()) u();
    topicUnsubs.clear();
    subitemsByTopic.clear();
  };
}

// Subitems de UM tópico (subcollection direta topics/{topicId}/subitems). Não
// precisa de índice de collection group — é uma leitura de subcollection comum.
// topicId é injetado (o caminho é conhecido) para os writes de status.
export function subscribeTopicSubitems(conferenceId, committeeId, topicId, cb) {
  const col = collection(
    db,
    "conferences",
    conferenceId,
    "committees",
    committeeId,
    "topics",
    topicId,
    "subitems"
  );
  return onSnapshot(
    col,
    (snap) => {
      cb(
        snap.docs
          .map((d) => ({ id: d.id, topicId, ...d.data() }))
          .sort(byOrdem)
      );
    },
    (err) => {
      // Sem handler, a falha some e a agenda fica só com os títulos de tópico.
      console.error(`[subscribeTopicSubitems] ${topicId}:`, err.code || err);
      cb([]);
    }
  );
}

export function subscribeDocuments(conferenceId, committeeId, cb) {
  const col = collection(
    db,
    "conferences",
    conferenceId,
    "committees",
    committeeId,
    "documents"
  );
  return onSnapshot(col, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Papel (role) do usuário logado NESTE comitê. null = não credenciado.
export function subscribeMemberRole(conferenceId, committeeId, uid, cb) {
  if (!uid) {
    cb(null);
    return () => {};
  }
  const ref = doc(
    db,
    "conferences",
    conferenceId,
    "committees",
    committeeId,
    "members",
    uid
  );
  return onSnapshot(ref, (snap) => {
    cb(snap.exists() ? snap.data().role ?? null : null);
  });
}

// ── Credenciamento por QR (import de planilha + presença) ─────────────────────

// Todos os membros do comitê (para o painel de presença do diretor). Cada membro:
// { id: memberId, role, nome, pais, uid?, committeeName, ... }. Ordena por nome
// para uma lista estável. As rules liberam leitura a qualquer autenticado.
export function subscribeMembers(conferenceId, committeeId, cb) {
  const col = collection(
    db,
    "conferences",
    conferenceId,
    "committees",
    committeeId,
    "members"
  );
  return onSnapshot(
    col,
    (snap) => {
      cb(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) =>
            String(a.nome ?? a.id).localeCompare(String(b.nome ?? b.id), "pt-BR")
          )
      );
    },
    (err) => {
      console.error("[subscribeMembers]:", err.code || err);
      cb([]);
    }
  );
}

// Registros de presença do comitê (check-ins), mais recentes primeiro. Escritos
// só pelo endpoint /api/checkin (Admin SDK); aqui é leitura em tempo real para o
// painel de presença do diretor. Ordena client-side por checkinAt para não
// exigir índice. Cada registro: { id, memberId, checkinAt, source, sessionSlot }.
export function subscribeAttendance(conferenceId, committeeId, cb) {
  const col = collection(
    db,
    "conferences",
    conferenceId,
    "committees",
    committeeId,
    "attendance"
  );
  return onSnapshot(
    col,
    (snap) => {
      cb(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => toMillis(b.checkinAt) - toMillis(a.checkinAt))
      );
    },
    (err) => {
      console.error("[subscribeAttendance]:", err.code || err);
      cb([]);
    }
  );
}

// ── Importação de delegados (admin global) ────────────────────────────────────
// A planilha é a fonte da verdade dos delegados. A tela de import (admin) monta
// um `plan` já validado e chama importDelegates para criar os membros em batch.

// Lê (uma vez) todos os membros de vários comitês de uma conference — usado pela
// tela de import para deduplicar por nome+comitê antes de gravar. Retorna
// [{ id, nome, pais, role, committeeId }].
export async function fetchExistingMembers(conferenceId, committeeIds) {
  const out = [];
  await Promise.all(
    committeeIds.map(async (committeeId) => {
      const snap = await getDocs(
        collection(db, "conferences", conferenceId, "committees", committeeId, "members")
      );
      for (const d of snap.docs) {
        out.push({ id: d.id, committeeId, ...d.data() });
      }
    })
  );
  return out;
}

// Cria os delegados de uma importação em batch. `plan` = [{ nome, pais,
// committeeId, committeeName }] — já validado pela tela (comitê existe, nome não
// vazio, sem duplicatas). Todos entram com role FIXO "delegate" (diretores nunca
// vêm por importação) e o mesmo importBatchId, para rollback fácil.
//
// O ref de cada membro é pré-gerado (doc(collection(...))) para conhecer o
// memberId ANTES do commit — assim ele já é gravado como campo (usado no
// collectionGroup do endpoint) e a tela pode gerar os QR codes na hora.
// Retorna { importBatchId, created: [{ memberId, nome, pais, committeeId,
// committeeName }] }, onde `created` alimenta a geração do PDF e o rollback.
export async function importDelegates(conferenceId, plan) {
  const importBatchId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const created = [];
  const CHUNK = 450; // limite do Firestore é 500 ops/batch

  for (let i = 0; i < plan.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const row of plan.slice(i, i + CHUNK)) {
      const ref = doc(
        collection(db, "conferences", conferenceId, "committees", row.committeeId, "members")
      );
      const data = pruneUndefined({
        memberId: ref.id,
        nome: row.nome,
        pais: row.pais,
        role: "delegate",
        uid: null,
        conferenceId,
        committeeId: row.committeeId,
        committeeName: row.committeeName,
        importBatchId,
        createdAt: serverTimestamp(),
      });
      batch.set(ref, data);
      created.push({
        memberId: ref.id,
        nome: row.nome,
        pais: row.pais,
        committeeId: row.committeeId,
        committeeName: row.committeeName,
      });
    }
    await batch.commit();
  }

  return { importBatchId, created };
}

// Desfaz uma importação apagando os membros criados. Recebe a lista `created`
// devolvida por importDelegates (não faz query por importBatchId — evita
// depender de índice de collection group só para o rollback).
export async function rollbackImport(conferenceId, created) {
  const refs = created.map((m) =>
    doc(db, "conferences", conferenceId, "committees", m.committeeId, "members", m.memberId)
  );
  await deleteRefsInChunks(refs);
}

// Marca presença manualmente (diretor) — o client nunca escreve attendance
// direto, então isto passa pelo endpoint com source "manual_director",
// autenticado pelo ID token do diretor logado (o endpoint confere isDirector).
export async function markPresenceManually({ conferenceId, committeeId, memberId }) {
  const user = auth.currentUser;
  if (!user) throw new Error("not authenticated");
  const idToken = await user.getIdToken();
  const res = await fetch("/api/checkin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      m: memberId,
      source: "manual_director",
      conferenceId,
      committeeId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `checkin ${res.status}`);
  return data;
}

// ── Writes (diretor) ──────────────────────────────────────────────────────────

export function setSubitemStatus(
  conferenceId,
  committeeId,
  topicId,
  subitemId,
  status
) {
  const ref = doc(
    db,
    "conferences",
    conferenceId,
    "committees",
    committeeId,
    "topics",
    topicId,
    "subitems",
    subitemId
  );
  return updateDoc(ref, { status });
}

// Registra um documento na subcollection documents do comitê. `data` já vem
// montado pelo chamador (não passe chaves undefined — o addDoc rejeita):
//   • working paper por tópico → { titulo, topicId, tipo: "working", url, autor, autorUid }
//   • documento final do comitê → { titulo, tipo: "final", url, autor, autorUid }
// `url` é o link público colado pelo usuário (Drive/Docs/qualquer URL); autor/
// autorUid identificam quem enviou.
export function addCommitteeDocument(conferenceId, committeeId, data) {
  const col = collection(
    db,
    "conferences",
    conferenceId,
    "committees",
    committeeId,
    "documents"
  );
  return addDoc(col, { ...data, createdAt: serverTimestamp() });
}
