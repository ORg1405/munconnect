// Vercel serverless function — endpoint de check-in por QR (modelo pré-impresso).
//
// Cada delegado tem um crachá com um QR que aponta para
//   https://{origin}/checkin?m={memberId}
// O QR é lido pelo totem (ESP32 + módulo GM65), que faz uma requisição HTTP
// direta a este endpoint, OU pela câmera do próprio celular do delegado, que
// abre a página /checkin — e essa página chama este endpoint. Em ambos os casos
// a presença é gravada aqui com o Firebase Admin SDK (ignora as Security Rules),
// então nenhum dispositivo escreve direto no Firestore.
//
// GET ou POST /api/checkin
//   params (query string ou body JSON): { m, source?, secret? }
//     m       = memberId (ID do documento do membro; o que vai no QR)
//     source  = "qr_totem" | "qr_web" | "manual_director"   (default: "qr_web")
//     secret  = obrigatório só quando source === "qr_totem"
//
// Autenticação por origem:
//   • qr_totem       → exige `secret` === process.env.TOTEM_SECRET (hardcoded no
//                      firmware do ESP32). Segredo errado → 403.
//   • qr_web         → sem segredo (o delegado não tem credencial). Rate limit de
//                      20 req/min por memberId (não por IP: no evento os celulares
//                      compartilham o IP do WiFi, então limitar por IP travaria o
//                      fluxo; por memberId ainda barra repetição do mesmo QR).
//   • manual_director→ o diretor marca presença pela UI quando o QR falhou. Exige
//                      Authorization: Bearer <ID token do Firebase> e que o autor
//                      seja diretor (members/{uid}.role == "director") do comitê
//                      do membro. O client nunca escreve attendance direto.
//
// Fluxo: resolve o membro por collectionGroup("members").where("memberId","==",m)
// (get O(1) — exige índice de collection group em members.memberId, ver
// firestore.indexes.json). Não achou → 404. Achou → grava um doc em
//   conferences/{conferenceId}/committees/{committeeId}/attendance/{autoId}
//     = { memberId, checkinAt: serverTimestamp(), source, sessionSlot: null }
// Dedup: se já houve check-in do mesmo membro nos últimos 30 min, não duplica.
//
// Resposta JSON (o totem usa `status` p/ LED verde/vermelho; a página renderiza):
//   200 { status: "ok" | "already_present", memberName, committeeName, checkinAt }
//   404 { status: "not_found", message }
//   4xx/5xx { status: "error", message }
//
// sessionSlot fica reservado (sempre null por enquanto) — ver o schema abaixo.
// FASE 2: vai permitir múltiplos check-ins por dia em horários distintos
// (manha_1, tarde_1, tarde_2, noite_1), configurados por conferência. Nada disso
// é implementado agora — o campo só existe para não migrar o schema depois.

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// ── Admin SDK (singleton — o ambiente serverless reaproveita instâncias) ──────
// A service account vai em process.env.FIREBASE_SERVICE_ACCOUNT como JSON da
// chave (Firebase Console → Contas de serviço) codificado em base64 — evita
// problemas com os \n do private_key em painéis/CI. NUNCA no bundle.
//   Gerar o valor: base64 -w0 serviceAccountKey.json   (macOS: base64 -i ...)
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

const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 min
const VALID_SOURCES = new Set(["qr_totem", "qr_web", "manual_director"]);

// ── Rate limit em memória (só para qr_web) ────────────────────────────────────
// Janela deslizante por memberId (NÃO por IP): num evento os delegados escaneiam
// pelo WiFi do local, saindo todos por um único IP NAT — limitar por IP travaria
// o fluxo principal. Limitar por memberId dá folga para retries legítimos de um
// mesmo delegado e ainda barra o abuso de repetir o mesmo QR. Best-effort: cada
// instância serverless tem seu próprio Map (limite por instância, não global).
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
  if (RATE.size > 5000) RATE.clear(); // guarda contra crescimento ilimitado
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

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return fail(res, 405, "Method not allowed");
  }

  const params = readParams(req);
  const m = typeof params.m === "string" ? params.m.trim() : "";
  const source = typeof params.source === "string" ? params.source : "qr_web";

  if (!m) return fail(res, 400, "Missing member id (m)");
  if (!VALID_SOURCES.has(source)) return fail(res, 400, "Invalid source");

  // ── Autenticação por origem (antes de tocar no banco) ───────────────────────
  if (source === "qr_totem") {
    const expected = process.env.TOTEM_SECRET;
    if (!expected) return fail(res, 500, "TOTEM_SECRET not configured");
    if (typeof params.secret !== "string" || params.secret !== expected) {
      return fail(res, 403, "Unauthorized totem");
    }
  } else if (source === "qr_web") {
    if (rateLimited(m)) {
      return fail(res, 429, "Muitas tentativas. Aguarde um instante.");
    }
  }

  // manual_director precisa do ID token. Extraímos aqui; a VERIFICAÇÃO acontece
  // dentro do try, ANTES de qualquer leitura do banco, para um token inválido não
  // disparar a query de collectionGroup (evita leitura/DoS com token falso).
  let directorToken = null;
  if (source === "manual_director") {
    const authz = req.headers.authorization || "";
    directorToken = authz.startsWith("Bearer ") ? authz.slice(7) : null;
    if (!directorToken) return fail(res, 401, "Missing bearer token");
  }

  try {
    const db = getDb();

    // manual_director: valida o token ANTES de tocar no banco. Só conhecemos o
    // comitê depois de resolver o membro, então a checagem de isDirector fica
    // logo após a query; mas um token inválido já é barrado aqui.
    let directorUid = null;
    if (source === "manual_director") {
      try {
        ({ uid: directorUid } = await getAdminAuth().verifyIdToken(directorToken));
      } catch {
        return fail(res, 401, "Invalid token");
      }
    }

    // Resolve o membro por collectionGroup (memberId é gravado como campo no
    // import). O ID do documento não pode ser filtrado direto num collectionGroup.
    const memberSnap = await db
      .collectionGroup("members")
      .where("memberId", "==", m)
      .limit(1)
      .get();

    if (memberSnap.empty) {
      return res.status(404).json({
        status: "not_found",
        message: "Delegado não encontrado.",
      });
    }

    const memberDoc = memberSnap.docs[0];
    const member = memberDoc.data();
    // Caminho: conferences/{cid}/committees/{comid}/members/{mid}
    const parts = memberDoc.ref.path.split("/");
    const conferenceId = parts[1];
    const committeeId = parts[3];
    const memberName = member.nome ?? null;
    const memberCountry = member.pais ?? null;
    const committeeName = member.committeeName ?? committeeId;

    // manual_director: confere que o autor (já autenticado) é diretor DESTE comitê.
    if (source === "manual_director") {
      const dirSnap = await db
        .collection("conferences").doc(conferenceId)
        .collection("committees").doc(committeeId)
        .collection("members").doc(directorUid)
        .get();
      if (!dirSnap.exists || dirSnap.get("role") !== "director") {
        return fail(res, 403, "Not a director of this committee");
      }
    }

    const attendanceCol = db
      .collection("conferences").doc(conferenceId)
      .collection("committees").doc(committeeId)
      .collection("attendance");

    // Dedup: check-in mais recente do membro dentro da janela de 30 min?
    const prior = await attendanceCol.where("memberId", "==", m).get();
    let lastMs = 0;
    for (const d of prior.docs) {
      const ts = d.get("checkinAt");
      const ms = ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
      if (ms > lastMs) lastMs = ms;
    }

    if (lastMs && Date.now() - lastMs < DEDUP_WINDOW_MS) {
      return res.status(200).json({
        status: "already_present",
        memberName,
        memberCountry,
        committeeName,
        checkinAt: new Date(lastMs).toISOString(),
      });
    }

    await attendanceCol.add({
      memberId: m,
      checkinAt: FieldValue.serverTimestamp(),
      source,
      sessionSlot: null, // reservado — ver cabeçalho (fase 2)
    });

    return res.status(200).json({
      status: "ok",
      memberName,
      memberCountry,
      committeeName,
      checkinAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/checkin] error:", err);
    return fail(res, 500, err.message || "Internal error");
  }
}
