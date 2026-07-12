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
//       members/{uid}                          { role: "director" | "delegate" }
//
// Os subitems são lidos por tópico (topics/{topicId}/subitems) — sem query
// collectionGroup, para não depender de índice de collection group. O campo
// committeeId nos subitems é legado (do listener antigo) e hoje é dispensável.
// ─────────────────────────────────────────────────────────────────────────────

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

// Simulação padrão usada pelos atalhos de navegação (dashboard, "Ver comitês").
// Ajuste conforme a conference criada no Firestore.
export const DEFAULT_CONFERENCE_ID = "diplomun-2026";

const byOrdem = (a, b) =>
  (a.ordem ?? Infinity) - (b.ordem ?? Infinity) ||
  String(a.id).localeCompare(String(b.id));

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
