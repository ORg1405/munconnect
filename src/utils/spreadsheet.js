// src/utils/spreadsheet.js
// ─────────────────────────────────────────────────────────────────────────────
// Parse (import) e geração (export) de planilhas de delegados, client-side, com
// SheetJS (xlsx). A planilha é a fonte da verdade dos delegados; aqui só lemos
// nome/país/comitê e devolvemos linhas normalizadas para a tela de importação
// validar e gravar.
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";

// Normaliza um texto de cabeçalho/valor para comparação: sem acento, minúsculo,
// sem espaços nas pontas. "País" e "pais" viram a mesma chave.
export function normalizeKey(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Sinônimos aceitos por coluna (já normalizados). O parser reconhece qualquer um.
const COLUMN_SYNONYMS = {
  nome: ["nome", "delegado", "delegada", "participante", "aluno", "aluna", "name", "delegate"],
  pais: ["pais", "delegacao", "representacao", "country", "delegation", "estado", "bloco"],
  comite: ["comite", "committee", "orgao", "comissao", "conselho", "camara"],
};

// Descobre, entre as chaves de cabeçalho reais da planilha, qual corresponde a
// cada coluna lógica (nome/pais/comite). Retorna { nome, pais, comite } com a
// chave ORIGINAL da planilha (ou null se a coluna não foi encontrada).
function resolveColumns(headerKeys) {
  const byNorm = new Map();
  for (const k of headerKeys) byNorm.set(normalizeKey(k), k);
  const pick = (logical) => {
    for (const syn of COLUMN_SYNONYMS[logical]) {
      if (byNorm.has(syn)) return byNorm.get(syn);
    }
    return null;
  };
  return { nome: pick("nome"), pais: pick("pais"), comite: pick("comite") };
}

// Detecta o separador de um CSV pela 1ª linha não vazia, contando ',', ';' e
// tab e escolhendo o mais frequente. Necessário porque o Excel pt-BR/EU exporta
// CSV com ';' — sem isso, tudo colapsaria numa coluna só e nenhuma coluna seria
// reconhecida. Devolve o char do separador (default ',').
function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  const counts = {
    ",": (line.match(/,/g) || []).length,
    ";": (line.match(/;/g) || []).length,
    "\t": (line.match(/\t/g) || []).length,
  };
  let best = ",";
  for (const sep of [";", "\t"]) if (counts[sep] > counts[best]) best = sep;
  return best;
}

// Rótulo amigável do separador, para o preview ("Separador detectado: ;").
function separatorLabel(sep) {
  if (sep === "\t") return "tabulação";
  return sep; // "," ou ";"
}

const EMPTY = { rows: [], columns: { nome: null, pais: null, comite: null }, separator: null };

// Lê um arquivo .csv/.xlsx/.xls e devolve as linhas de delegados.
//   → { rows: [{ nome, pais, comite }], columns: { nome, pais, comite }, separator }
// `columns` diz quais colunas foram reconhecidas (para a UI avisar se faltou
// alguma). `separator` é o separador detectado em CSV (";", "," ou "tabulação")
// ou null para planilhas .xlsx/.xls. Linhas totalmente vazias são descartadas.
export async function parseMembersFile(file) {
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";

  let wb;
  let separator = null;
  if (isCsv) {
    // Lê como texto para detectar o separador e passá-lo explicitamente ao parser.
    const text = await file.text();
    const sep = detectDelimiter(text);
    separator = separatorLabel(sep);
    wb = XLSX.read(text, { type: "string", FS: sep });
  } else {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: "array" });
  }

  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { ...EMPTY, separator };

  const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!json.length) return { ...EMPTY, separator };

  const columns = resolveColumns(Object.keys(json[0]));

  const rows = json
    .map((r) => ({
      nome: String(columns.nome ? r[columns.nome] : "").trim(),
      pais: String(columns.pais ? r[columns.pais] : "").trim(),
      comite: String(columns.comite ? r[columns.comite] : "").trim(),
    }))
    .filter((r) => r.nome || r.pais || r.comite); // ignora linhas em branco

  return { rows, columns, separator };
}

// Gera e baixa uma planilha .xlsx de presença. `rows` já vem montado pelo
// chamador: [{ nome, pais, comite, status, horario }]. Mesmo formato de colunas
// da planilha de importação (Nome/País/Comitê) + Status/Horário, para fechar o
// loop com o fluxo do diretor.
export function exportAttendanceXlsx(rows, filename = "presenca.xlsx") {
  const aoa = [
    ["Nome", "País", "Comitê", "Status", "Horário do check-in"],
    ...rows.map((r) => [r.nome || "", r.pais || "", r.comite || "", r.status || "", r.horario || ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presença");
  XLSX.writeFile(wb, filename);
}
