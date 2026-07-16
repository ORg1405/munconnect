// Vercel serverless function — endpoint de check-in por QR + presença por sessão.
//
// Cada delegado tem um crachá com um QR que aponta para
//   https://{origin}/checkin?m={memberId}
// O QR é lido pelo totem (ESP32 + módulo GM65) ou pela câmera do próprio celular
// do delegado (que abre a página /checkin). A presença é gravada aqui com o
// Firebase Admin SDK (ignora as Security Rules) — nenhum dispositivo escreve
// direto no Firestore.
//
// ── Presença por SESSÃO (não mais "presente hoje") ───────────────────────────
// A conference tem sessões cadastradas (conferences/{cid}/sessions), cada uma com
// janela [startAt, endAt]. No momento do scan, o endpoint descobre qual sessão
// está ATIVA (now() entre startAt e endAt) e grava um doc de presença com ID
// composto `${sessionId}_${memberId}` — 1 registro por par sessão+delegado. Não
// há mais dedup por tempo: reescanear na mesma sessão só atualiza o mesmo doc
// (troca P↔PV é aceita de propósito; o diretor confere depois se preciso).
//
// Cada delegado escolhe P (Presente) ou PV (Presente e Votante) por sessão — a
// escolha NÃO se propaga para a próxima sessão (cada chamada exige nova escolha
// ativa, para não presumir voto acidental). O status "ausente" só existe quando o
// DIRETOR marca uma ausência explícita pela UI; delegado que não escaneou não tem
// doc nenhum.
//
// ── Contrato do endpoint ─────────────────────────────────────────────────────
// GET  /api/checkin   → PEEK (não grava). Resolve o delegado e a sessão ativa e
//                       devolve os dados para a página/totem mostrar os botões
//                       "P" e "PV". A página faz isto ao carregar.
//   params (query): { m, source?, secret? }
//
// POST /api/checkin   → COMMIT (grava). Dois formatos, por `source`:
//   • qr_web / qr_totem: { m, source, secret?, status: "P" | "PV" }
//       Grava/atualiza attendance/{sessionId_memberId} na sessão ATIVA.
//       `status` obrigatório (senão erro "Escolha P ou PV antes de finalizar").
//   • manual_director: { source, conferenceId, committeeId, sessionId,
//                        status: "P"|"PV"|"ausente", m OU memberIds: string[] }
//       O diretor corrige/preenche a matriz de presença. `sessionId` é EXPLÍCITO
//       (edita qualquer sessão, não só a ativa). `m` marca um delegado; `memberIds`
//       marca vários de uma vez ("marcar todos como PV"). Grava lastEditedAt e
//       lastEditedBy (uid do diretor). "ausente" grava um doc com status "ausente"
//       (ausência explícita, rastreável) — não apaga.
//
// Autenticação por origem:
//   • qr_totem       → exige `secret` === process.env.TOTEM_SECRET. Errado → 403.
//   • qr_web         → sem segredo. Rate limit de 20 req/min por memberId.
//   • manual_director→ Authorization: Bearer <ID token do Firebase> e o autor tem
//                      de ser diretor (members/{uid}.role == "director") do comitê.
//
// Resolução do membro: collectionGroup("members").where("memberId","==",m)
// (exige índice de collection group em members.memberId — ver firestore.indexes.json).
//
// Respostas JSON (o totem usa `status` p/ LED; a página renderiza):
//   PEEK  200 { status:"ready", memberName, memberCountry, committeeName,
//               session:{ id, name, day }, currentStatus:"P"|"PV"|null }
//   COMMIT(qr) 200 { status:"ok", memberName, memberCountry, committeeName,
//               session, chosenStatus, checkinAt }
//   COMMIT(manual) 200 { status:"ok", updated }
//   404 { status:"not_found", message }
//   409 { status:"no_sessions", message }        → nenhuma sessão cadastrada
//   409 { status:"no_active_session", message }   → fora do horário de qualquer sessão
//   4xx/5xx { status:"error", message }

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// ── Admin SDK (singleton — o ambiente serverless reaproveita instâncias) ──────
// A service account vai em process.env.FIREBASE_SERVICE_ACCOUNT como JSON da
// chave (Firebase Console → Contas de serviço) codificado em base64 — evita
// problemas com os \n do private_key em painéis/CI. NUNCA no bundle.
function ensureApp() {
  if (!getApps().length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
    }
    const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8");
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getApp();
}
const getDb = () => getFirestore(ensureApp());
const getAdminAuth = () => getAuth(ensureApp());

const VALID_SOURCES = new Set(["qr_totem", "qr_web", "manual_director"]);
const QR_SOURCES = new Set(["qr_totem", "qr_web"]);
const QR_STATUSES = new Set(["P", "PV"]);
const MANUAL_STATUSES = new Set(["P", "PV", "ausente"]);
const BATCH_LIMIT = 450; // limite do Firestore é 500 ops/batch

// ── Rate limit em memória (só para qr_web) ────────────────────────────────────
// Janela deslizante por memberId (NÃO por IP): num evento os delegados escaneiam
// pelo WiFi do local, saindo todos por um único IP NAT. Best-effort: cada
// instância serverless tem seu próprio Map.
const RATE = new Map(); // memberId -> number[] (timestamps ms)
function rateLimited(key, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const arr = (RATE.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    RATE.set(key, arr);
    return true;
  }
  arr.push(now);
  RATE.set(key, arr);
  if (RATE.size > 5000) RATE.clear();
  return false;
}

function fail(res, code, message) {
  return res.status(code).json({ status: "error", message });
}

// Junta parâmetros de query string (GET) e body JSON (POST). Body tem prioridade.
function readParams(req) {
  const q = req.query || {};
  let b = {};
  if (req.body) {
    try {
      b = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      b = {};
    }
  }
  return { ...q, ...b };
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

// Resolve a sessão ATIVA da conference no instante `nowMs`. Busca TODAS as sessões
// (poucas por evento) e filtra em memória — evita índice composto (o Firestore não
// permite range em dois campos, startAt e endAt, na mesma query). Se houver
// sobreposição, escolhe a de maior `order` (e depois startAt mais recente).
//   → { session } | { error: "no_sessions" | "no_active_session" }
async function resolveActiveSession(db, conferenceId, nowMs) {
  const snap = await db
    .collection("conferences").doc(conferenceId)
    .collection("sessions")
    .get();
  if (snap.empty) return { error: "no_sessions" };

  const active = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => {
      const start = toMillis(s.startAt);
      const end = toMillis(s.endAt);
      return start && end && nowMs >= start && nowMs <= end;
    })
    .sort(
      (a, b) => (b.order ?? 0) - (a.order ?? 0) || toMillis(b.startAt) - toMillis(a.startAt)
    );

  if (!active.length) return { error: "no_active_session" };
  return { session: active[0] };
}

function noSession(res, error) {
  if (error === "no_sessions") {
    return res.status(409).json({
      status: "no_sessions",
      message: "Sessões ainda não configuradas — procure a organização.",
    });
  }
  return res.status(409).json({
    status: "no_active_session",
    message: "Fora do horário de sessão — nenhuma chamada aberta.",
  });
}

// Resolve o membro por collectionGroup (memberId é gravado como campo no import).
//   → { conferenceId, committeeId, memberName, memberCountry, committeeName }
//     | null (não encontrado)
async function resolveMember(db, m) {
  const memberSnap = await db
    .collectionGroup("members")
    .where("memberId", "==", m)
    .limit(1)
    .get();
  if (memberSnap.empty) return null;

  const memberDoc = memberSnap.docs[0];
  const member = memberDoc.data();
  // Caminho: conferences/{cid}/committees/{comid}/members/{mid}
  const parts = memberDoc.ref.path.split("/");
  return {
    conferenceId: parts[1],
    committeeId: parts[3],
    memberName: member.nome ?? null,
    memberCountry: member.pais ?? null,
    committeeName: member.committeeName ?? parts[3],
  };
}

function attendanceCol(db, conferenceId, committeeId) {
  return db
    .collection("conferences").doc(conferenceId)
    .collection("committees").doc(committeeId)
    .collection("attendance");
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return fail(res, 405, "Method not allowed");
  }

  const params = readParams(req);
  const source = typeof params.source === "string" ? params.source : "qr_web";
  if (!VALID_SOURCES.has(source)) return fail(res, 400, "Invalid source");

  try {
    if (req.method === "GET") return await handlePeek(req, res, params, source);
    return await handleCommit(req, res, params, source);
  } catch (err) {
    console.error("[/api/checkin] error:", err);
    return fail(res, 500, err.message || "Internal error");
  }
}

// ── PEEK (GET) ────────────────────────────────────────────────────────────────
// Só para os fluxos de QR (o delegado/totem). Não grava nada.
async function handlePeek(req, res, params, source) {
  if (!QR_SOURCES.has(source)) return fail(res, 400, "Peek only supports QR sources");

  const m = typeof params.m === "string" ? params.m.trim() : "";
  if (!m) return fail(res, 400, "Missing member id (m)");

  if (source === "qr_totem") {
    const expected = process.env.TOTEM_SECRET;
    if (!expected) return fail(res, 500, "TOTEM_SECRET not configured");
    if (typeof params.secret !== "string" || params.secret !== expected) {
      return fail(res, 403, "Unauthorized totem");
    }
  } else if (rateLimited(m)) {
    return fail(res, 429, "Muitas tentativas. Aguarde um instante.");
  }

  const db = getDb();
  const member = await resolveMember(db, m);
  if (!member) {
    return res.status(404).json({ status: "not_found", message: "Delegado não encontrado." });
  }

  const { session, error } = await resolveActiveSession(db, member.conferenceId, Date.now());
  if (error) return noSession(res, error);

  // Já existe registro deste delegado nesta sessão? Devolve o status atual para a
  // página destacar o botão (P/PV) já escolhido — reescanear é permitido.
  const existing = await attendanceCol(db, member.conferenceId, member.committeeId)
    .doc(`${session.id}_${m}`)
    .get();
  const currentStatus = existing.exists ? existing.get("status") ?? null : null;

  return res.status(200).json({
    status: "ready",
    memberName: member.memberName,
    memberCountry: member.memberCountry,
    committeeName: member.committeeName,
    session: { id: session.id, name: session.name ?? null, day: session.day ?? null },
    currentStatus,
  });
}

// ── COMMIT (POST) ─────────────────────────────────────────────────────────────
async function handleCommit(req, res, params, source) {
  if (source === "manual_director") return handleManualCommit(req, res, params);
  return handleQrCommit(req, res, params, source);
}

// qr_web / qr_totem: grava a presença do próprio delegado na sessão ativa.
async function handleQrCommit(req, res, params, source) {
  const m = typeof params.m === "string" ? params.m.trim() : "";
  if (!m) return fail(res, 400, "Missing member id (m)");

  const status = typeof params.status === "string" ? params.status : "";
  if (!QR_STATUSES.has(status)) {
    return fail(res, 400, "Escolha P ou PV antes de finalizar");
  }

  if (source === "qr_totem") {
    const expected = process.env.TOTEM_SECRET;
    if (!expected) return fail(res, 500, "TOTEM_SECRET not configured");
    if (typeof params.secret !== "string" || params.secret !== expected) {
      return fail(res, 403, "Unauthorized totem");
    }
  } else if (rateLimited(m)) {
    return fail(res, 429, "Muitas tentativas. Aguarde um instante.");
  }

  const db = getDb();
  const member = await resolveMember(db, m);
  if (!member) {
    return res.status(404).json({ status: "not_found", message: "Delegado não encontrado." });
  }

  const { session, error } = await resolveActiveSession(db, member.conferenceId, Date.now());
  if (error) return noSession(res, error);

  const ref = attendanceCol(db, member.conferenceId, member.committeeId).doc(
    `${session.id}_${m}`
  );
  // Set completo: reescanear na mesma sessão sobrescreve (inclusive troca P↔PV).
  await ref.set({
    memberId: m,
    sessionId: session.id,
    status,
    source,
    checkinAt: FieldValue.serverTimestamp(),
  });

  return res.status(200).json({
    status: "ok",
    memberName: member.memberName,
    memberCountry: member.memberCountry,
    committeeName: member.committeeName,
    session: { id: session.id, name: session.name ?? null, day: session.day ?? null },
    chosenStatus: status,
    checkinAt: new Date().toISOString(),
  });
}

// manual_director: o diretor corrige/preenche a matriz. sessionId explícito.
async function handleManualCommit(req, res, params) {
  const conferenceId = typeof params.conferenceId === "string" ? params.conferenceId : "";
  const committeeId = typeof params.committeeId === "string" ? params.committeeId : "";
  const sessionId = typeof params.sessionId === "string" ? params.sessionId : "";
  const status = typeof params.status === "string" ? params.status : "";

  if (!conferenceId || !committeeId) return fail(res, 400, "Missing conference/committee");
  if (!sessionId) return fail(res, 400, "Missing sessionId");
  if (!MANUAL_STATUSES.has(status)) return fail(res, 400, "Invalid status");

  // Lista de alvos: `memberIds` (bulk) ou `m` (um só).
  let memberIds = [];
  if (Array.isArray(params.memberIds)) {
    memberIds = params.memberIds
      .filter((x) => typeof x === "string" && x.trim())
      .map((x) => x.trim());
  } else if (typeof params.m === "string" && params.m.trim()) {
    memberIds = [params.m.trim()];
  }
  if (!memberIds.length) return fail(res, 400, "No members to mark");

  // Token do diretor (verificação ANTES de tocar no banco).
  const authz = req.headers.authorization || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return fail(res, 401, "Missing bearer token");

  const db = getDb();
  let directorUid = null;
  try {
    ({ uid: directorUid } = await getAdminAuth().verifyIdToken(token));
  } catch {
    return fail(res, 401, "Invalid token");
  }

  // O autor é diretor DESTE comitê?
  const dirSnap = await db
    .collection("conferences").doc(conferenceId)
    .collection("committees").doc(committeeId)
    .collection("members").doc(directorUid)
    .get();
  if (!dirSnap.exists || dirSnap.get("role") !== "director") {
    return fail(res, 403, "Not a director of this committee");
  }

  const col = attendanceCol(db, conferenceId, committeeId);
  // Merge (não completo): preserva o checkinAt de um scan anterior quando o diretor
  // só corrige o status — por isso NÃO reescrevemos checkinAt aqui (incluí-lo no
  // merge o sobrescreveria). Docs puramente manuais (sem scan prévio) ficam sem
  // checkinAt; a matriz não o exibe, e lastEditedAt registra quando foi marcado.
  // lastEditedAt/lastEditedBy sempre registram a edição do diretor.
  for (let i = 0; i < memberIds.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const memberId of memberIds.slice(i, i + BATCH_LIMIT)) {
      const ref = col.doc(`${sessionId}_${memberId}`);
      batch.set(
        ref,
        {
          memberId,
          sessionId,
          status,
          source: "manual_director",
          lastEditedAt: FieldValue.serverTimestamp(),
          lastEditedBy: directorUid,
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  return res.status(200).json({ status: "ok", updated: memberIds.length });
}
