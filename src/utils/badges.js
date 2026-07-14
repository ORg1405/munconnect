// src/utils/badges.js
// ─────────────────────────────────────────────────────────────────────────────
// Gera um PDF de crachás com QR codes para impressão, client-side. Cada crachá
// traz nome + país + comitê + um QR que aponta para
//   {origin}/checkin?m={memberId}
// escaneado pelo totem (ESP32 + GM65) ou pela câmera do celular do delegado.
//
// QR via "qrcode" (data URL) e layout via "jspdf". 4 ou 6 crachás por página A4.
// ─────────────────────────────────────────────────────────────────────────────

import { jsPDF } from "jspdf";
import QRCode from "qrcode";

// URL que vai dentro do QR de um membro.
export function checkinUrl(origin, memberId) {
  return `${origin}/checkin?m=${encodeURIComponent(memberId)}`;
}

// Gera o PDF e dispara o download. `members` = [{ memberId, nome, pais,
// committeeName }]; `perPage` = 4 (2×2) ou 6 (2×3). `origin` = window.location.origin.
export async function generateBadgesPdf({ members, origin, perPage = 4, filename = "crachas.pdf" }) {
  const cols = 2;
  const rows = perPage === 6 ? 3 : 2;
  const perSheet = cols * rows;

  // Gera todos os QR (data URL) antes de montar o PDF.
  const qr = await Promise.all(
    members.map((m) =>
      QRCode.toDataURL(checkinUrl(origin, m.memberId), {
        margin: 1,
        width: 512,
        errorCorrectionLevel: "M",
      })
    )
  );

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 12;
  const gap = 8;
  const cellW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = (pageH - margin * 2 - gap * (rows - 1)) / rows;

  members.forEach((m, i) => {
    const slot = i % perSheet;
    if (i > 0 && slot === 0) doc.addPage();

    const c = slot % cols;
    const r = Math.floor(slot / cols);
    const x = margin + c * (cellW + gap);
    const y = margin + r * (cellH + gap);

    // Moldura do crachá.
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cellW, cellH, 3, 3);

    const cx = x + cellW / 2;

    // QR centralizado na parte superior.
    const qrSize = Math.min(cellW - 24, cellH - 34);
    const qrX = cx - qrSize / 2;
    const qrY = y + 8;
    doc.addImage(qr[i], "PNG", qrX, qrY, qrSize, qrSize);

    let ty = qrY + qrSize + 8;

    // Nome (destaque).
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text(truncate(m.nome || "—", 26), cx, ty, { align: "center" });
    ty += 6;

    // País.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(70);
    doc.text(truncate(m.pais || "", 30), cx, ty, { align: "center" });
    ty += 5;

    // Comitê (menor, cinza).
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(truncate(m.committeeName || "", 34), cx, ty, { align: "center" });
  });

  doc.save(filename);
}

function truncate(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
