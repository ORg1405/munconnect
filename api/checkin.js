// Vercel serverless function — endpoint de check-in do totem RFID/NFC (ESP32).
//
// O totem físico NÃO é um usuário autenticado do app. Ele fala só com este
// endpoint, que usa o Firebase Admin SDK (ignora as Security Rules) para gravar
// no Firestore com identidade de servidor. Assim o ESP32 nunca escreve direto no
// Firestore nem carrega credenciais de banco.
//
// Os 3 totens são FIXOS e GENÉRICOS: um delegado de qualquer comitê pode se
// credenciar em qualquer totem. O totem não sabe a que comitê a tag pertence —
// só envia o UID lido. O roteamento é feito pela coleção global rfidTags.
//
// POST /api/checkin
//   body: { deviceId, apiSecret, rfidUid }
//
// Autenticação do dispositivo: apiSecret é comparado a process.env.CHECKIN_SECRET
// (nunca vai ao client nem ao repo). Segredo errado → 401.
//
// Dois modos, decididos pela existência de rfidTags/{rfidUid} (get O(1), sem query):
//   • PAREAMENTO (a tag não está em rfidTags): grava a pendência em
//       devices/{deviceId} = { pendingPairing: { rfidUid, timestamp } }
//     A tela de pareamento do diretor escuta esse doc e conclui o vínculo.
//   • CHECK-IN (a tag existe em rfidTags): lê { conferenceId, committeeId,
//     memberId } de lá e grava a presença em
//       conferences/{conferenceId}/committees/{committeeId}/attendance/{autoId}
//       = { memberId, nome, pais, rfidUid, timestamp, status: "present" }
//     Idempotente por dia: se o membro já tem presença hoje, não duplica.
//
// Resposta JSON (o ESP32 usa `status` para LED verde/vermelho e `message` no OLED):
//   200 { ok: true, mode: "checkin", status: "present" | "already_present",
//         member: { nome, pais }, message }
//   200 { ok: true, mode: "pairing", status: "unknown_tag", message }
//   4xx/5xx { ok: false, status: "error", message }
//
// Ação auxiliar — limpeza de pendência (chamada pela TELA do diretor, não pelo
// totem), autenticada pelo ID token do Firebase (não pelo segredo do totem):
//   POST /api/checkin  { action: "clearPending", deviceId, conferenceId, committeeId }
//     header: Authorization: Bearer <idToken do diretor>
//   Zera devices/{deviceId}.pendingPairing com Admin SDK depois que a tela
//   concluiu um pareamento, para um pendingPairing residual não confundir o
//   próximo pareamento em sequência rápida. O client nunca escreve devices
//   direto — pede à function.

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

// Dia local (fuso do evento, America/Sao_Paulo ≈ UTC-3) de um instante, no
// formato "YYYY-MM-DD". Usado para deduplicar presença "do dia" comparando
// strings — sem lib de timezone e sem índice composto no Firestore.
const TZ_OFFSET_MS = -3 * 60 * 60 * 1000;
function localDayKey(ms) {
  return new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function bad(res, code, message) {
  res.status(code).json({ ok: false, status: "error", message });
}

// Limpa devices/{deviceId}.pendingPairing após a tela concluir um pareamento.
// Autoriza pelo ID token do Firebase: o chamador tem de ser diretor do comitê que
// está pareando. Os totens são genéricos (não têm dono), então qualquer diretor
// pode limpar qualquer totem — não há mais checagem de vínculo device→comitê.
async function handleClearPending(req, res, body) {
  const { deviceId, conferenceId, committeeId } = body;
  if (!deviceId || !conferenceId || !committeeId) {
    return bad(res, 400, "Missing deviceId, conferenceId or committeeId");
  }

  const authz = req.headers.authorization || "";
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!idToken) return bad(res, 401, "Missing bearer token");

  try {
    let uid;
    try {
      ({ uid } = await getAdminAuth().verifyIdToken(idToken));
    } catch {
      return bad(res, 401, "Invalid token");
    }

    const db = getDb();
    const memberSnap = await db
      .collection("conferences").doc(conferenceId)
      .collection("committees").doc(committeeId)
      .collection("members").doc(uid)
      .get();
    if (!memberSnap.exists || memberSnap.get("role") !== "director") {
      return bad(res, 403, "Not a director of this committee");
    }

    const devRef = db.collection("devices").doc(deviceId);
    const devSnap = await devRef.get();
    if (!devSnap.exists) {
      // Nada a limpar — trata como sucesso (idempotente).
      return res.status(200).json({ ok: true, action: "clearPending", status: "cleared" });
    }

    await devRef.set(
      { pendingPairing: null, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return res.status(200).json({ ok: true, action: "clearPending", status: "cleared" });
  } catch (err) {
    console.error("[/api/checkin clearPending] error:", err);
    return bad(res, 500, err.message || "Internal error");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return bad(res, 405, "Method not allowed");
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return bad(res, 400, "Invalid JSON body");
  }

  // Ação da tela do diretor (autenticada por ID token, não pelo segredo do totem).
  if (body.action === "clearPending") {
    return handleClearPending(req, res, body);
  }

  const { deviceId, apiSecret, rfidUid } = body;

  // Segredo do dispositivo primeiro (não revela nada sobre o resto em caso de erro).
  const expected = process.env.CHECKIN_SECRET;
  if (!expected) return bad(res, 500, "CHECKIN_SECRET not configured");
  if (typeof apiSecret !== "string" || apiSecret !== expected) {
    return bad(res, 401, "Unauthorized device");
  }

  if (!deviceId || !rfidUid) {
    return bad(res, 400, "Missing deviceId or rfidUid");
  }

  try {
    const db = getDb();

    // Fonte da verdade: rfidTags/{rfidUid} (get O(1), sem query nem índice).
    const tagSnap = await db.collection("rfidTags").doc(rfidUid).get();

    // ── Modo PAREAMENTO (tag ainda não vinculada a ninguém) ───────────────────
    if (!tagSnap.exists) {
      await db.collection("devices").doc(deviceId).set(
        {
          pendingPairing: { rfidUid, timestamp: FieldValue.serverTimestamp() },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return res.status(200).json({
        ok: true,
        mode: "pairing",
        status: "unknown_tag",
        message: "Crachá não pareado — aguardando o diretor no painel.",
      });
    }

    // ── Modo CHECK-IN ─────────────────────────────────────────────────────────
    const tag = tagSnap.data();
    const { conferenceId, committeeId, memberId } = tag;
    if (!conferenceId || !committeeId || !memberId) {
      return bad(res, 500, "rfidTags entry incomplete");
    }

    // Nome/país para denormalizar na presença + resposta (o member pode ter sido
    // removido: nesse caso registra a presença mesmo assim, só sem nome/país).
    const memberSnap = await db
      .collection("conferences").doc(conferenceId)
      .collection("committees").doc(committeeId)
      .collection("members").doc(memberId)
      .get();
    const nome = memberSnap.exists ? memberSnap.get("nome") ?? null : null;
    const pais = memberSnap.exists ? memberSnap.get("pais") ?? null : null;

    const attendanceCol = db
      .collection("conferences").doc(conferenceId)
      .collection("committees").doc(committeeId)
      .collection("attendance");

    // Já registrou hoje? Não duplica (scan repetido acende verde mesmo assim).
    // Filtra por memberId (equality, sem índice composto) e compara o dia local
    // em JS — cada membro tem no máximo um registro por dia, então é barato.
    const today = localDayKey(Date.now());
    const prior = await attendanceCol.where("memberId", "==", memberId).get();
    const already = prior.docs.some((d) => {
      const ts = d.get("timestamp");
      return ts && localDayKey(ts.toMillis()) === today;
    });

    if (already) {
      return res.status(200).json({
        ok: true,
        mode: "checkin",
        status: "already_present",
        member: { nome, pais },
        message: `${nome ?? "Membro"} já registrado hoje.`,
      });
    }

    await attendanceCol.add({
      memberId,
      nome,
      pais,
      rfidUid,
      timestamp: FieldValue.serverTimestamp(),
      status: "present",
    });

    return res.status(200).json({
      ok: true,
      mode: "checkin",
      status: "present",
      member: { nome, pais },
      message: `Presença registrada: ${nome ?? "membro"}.`,
    });
  } catch (err) {
    console.error("[/api/checkin] error:", err);
    return bad(res, 500, err.message || "Internal error");
  }
}
