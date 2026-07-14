// src/components/admin/ImportMembers.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Tela de importação de delegados (rota /app/importar) — só admin GLOBAL. A
// planilha (.csv/.xlsx) é a fonte da verdade: o admin sobe o arquivo, revisa o
// preview (o que será criado, novos vs já existentes, linhas com problema) e só
// então confirma. Todos os importados entram com role FIXO "delegate" (diretores
// nunca vêm por import). Depois de importar, gera o PDF de crachás com QR e
// permite desfazer a importação (rollback do lote).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../AuthContext";
import {
  subscribeConferences,
  subscribeCommittees,
  fetchExistingMembers,
  importDelegates,
  rollbackImport,
} from "../../data/firestore";
import { parseMembersFile, normalizeKey } from "../../utils/spreadsheet";
import { generateBadgesPdf } from "../../utils/badges";

export default function ImportMembers() {
  const { isAdmin } = useAuth();

  const [conferences, setConferences] = useState(undefined);
  const [conferenceId, setConferenceId] = useState("");
  const [committees, setCommittees] = useState([]);
  const [existing, setExisting] = useState([]);
  // Bump para re-buscar os membros já existentes (dedup) depois de importar ou
  // desfazer — senão uma 2ª importação na mesma sessão dedupa contra dado velho.
  const [existingReloadKey, setExistingReloadKey] = useState(0);

  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null); // { rows, columns }
  const [parseError, setParseError] = useState("");

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { importBatchId, created }
  const [perPage, setPerPage] = useState(4);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [rollbackBusy, setRollbackBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => subscribeConferences(setConferences), []);

  // Seleciona a primeira conference automaticamente.
  useEffect(() => {
    if (conferences?.length && !conferenceId) setConferenceId(conferences[0].id);
  }, [conferences, conferenceId]);

  // Committees da conference selecionada.
  useEffect(() => {
    if (!conferenceId) {
      setCommittees([]);
      return;
    }
    return subscribeCommittees(conferenceId, setCommittees);
  }, [conferenceId]);

  // Membros já existentes (para deduplicar no preview). Recarrega quando muda a
  // conference ou o conjunto de comitês.
  const committeeIdsKey = committees.map((c) => c.id).join(",");
  useEffect(() => {
    if (!conferenceId || committees.length === 0) {
      setExisting([]);
      return;
    }
    let alive = true;
    fetchExistingMembers(
      conferenceId,
      committees.map((c) => c.id)
    ).then((list) => alive && setExisting(list));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferenceId, committeeIdsKey, existingReloadKey]);

  // Índice de comitê por nome normalizado (bate sigla OU nome completo).
  const committeeByName = useMemo(() => {
    const map = new Map();
    for (const c of committees) {
      if (c.sigla) map.set(normalizeKey(c.sigla), c);
      if (c.nomeCompleto) map.set(normalizeKey(c.nomeCompleto), c);
    }
    return map;
  }, [committees]);

  // Set de dedup: "nomeNormalizado|committeeId" dos membros já existentes.
  const existingKeys = useMemo(() => {
    const set = new Set();
    for (const m of existing) set.add(`${normalizeKey(m.nome)}|${m.committeeId}`);
    return set;
  }, [existing]);

  // Preview: classifica cada linha em new / duplicate / error.
  const preview = useMemo(() => {
    if (!parsed) return [];
    const seen = new Set();
    return parsed.rows.map((r) => {
      if (!r.nome) return { ...r, status: "error", reason: "Nome vazio" };
      const committee = committeeByName.get(normalizeKey(r.comite));
      if (!r.comite) return { ...r, status: "error", reason: "Comitê não informado" };
      if (!committee)
        return { ...r, status: "error", reason: `Comitê "${r.comite}" não existe` };
      const key = `${normalizeKey(r.nome)}|${committee.id}`;
      if (existingKeys.has(key) || seen.has(key))
        return { ...r, status: "duplicate", committee, reason: "Já existe" };
      seen.add(key);
      return { ...r, status: "new", committee };
    });
  }, [parsed, committeeByName, existingKeys]);

  const counts = useMemo(() => {
    const c = { new: 0, duplicate: 0, error: 0 };
    for (const r of preview) c[r.status]++;
    return c;
  }, [preview]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    setParseError("");
    setResult(null);
    setFileName(file.name);
    try {
      const out = await parseMembersFile(file);
      if (!out.rows.length) {
        setParsed(null);
        setParseError("A planilha está vazia ou não tem linhas de dados.");
        return;
      }
      if (!out.columns.nome) {
        setParsed(null);
        setParseError(
          'Não encontrei a coluna de nome. Use um cabeçalho como "Nome" ou "Delegado".'
        );
        return;
      }
      setParsed(out);
    } catch (err) {
      setParsed(null);
      setParseError(`Falha ao ler o arquivo: ${err?.message || err}`);
    }
  }

  async function handleImport() {
    const plan = preview
      .filter((r) => r.status === "new")
      .map((r) => ({
        nome: r.nome,
        pais: r.pais,
        committeeId: r.committee.id,
        committeeName: r.committee.sigla || r.committee.nomeCompleto || r.committee.id,
      }));
    if (!plan.length) return;
    setImporting(true);
    try {
      const res = await importDelegates(conferenceId, plan);
      setResult(res);
      setParsed(null);
      setFileName("");
      setExistingReloadKey((k) => k + 1); // dedup passa a considerar o que acabou de entrar
      showToast(`${res.created.length} delegados importados.`);
    } catch (err) {
      setParseError(`Falha ao importar: ${err?.message || err}`);
    } finally {
      setImporting(false);
    }
  }

  async function handlePdf() {
    if (!result) return;
    setPdfBusy(true);
    try {
      await generateBadgesPdf({
        members: result.created,
        origin: window.location.origin,
        perPage,
      });
    } catch (err) {
      showToast(`Falha ao gerar PDF: ${err?.message || err}`);
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleRollback() {
    if (!result) return;
    if (!window.confirm(`Desfazer esta importação e apagar ${result.created.length} delegados?`))
      return;
    setRollbackBusy(true);
    try {
      await rollbackImport(conferenceId, result.created);
      setResult(null);
      setExistingReloadKey((k) => k + 1); // dedup volta a refletir o banco após remover
      showToast("Importação desfeita.");
    } catch (err) {
      showToast(`Falha ao desfazer: ${err?.message || err}`);
    } finally {
      setRollbackBusy(false);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3600);
  }

  if (!isAdmin) {
    return (
      <div style={container}>
        <p style={{ color: "var(--text-secondary)" }}>
          Acesso restrito. Esta tela é só para administradores globais.
        </p>
      </div>
    );
  }

  return (
    <div style={container}>
      <header>
        <h1 style={h1}>Importar delegados</h1>
        <p style={{ color: "var(--text-muted)", margin: "8px 0 0", fontSize: "var(--fs-small)" }}>
          Suba a planilha (.csv/.xlsx) com <strong>nome</strong>, <strong>país</strong> e{" "}
          <strong>comitê</strong>. Revise o preview e confirme — cada delegado recebe um crachá com QR.
        </p>
      </header>

      {/* Conference */}
      <div className="mt-8">
        <Label>Conferência</Label>
        <select
          value={conferenceId}
          onChange={(e) => {
            setConferenceId(e.target.value);
            setParsed(null);
            setResult(null);
          }}
          style={selectStyle}
        >
          {(conferences ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome || c.id}
            </option>
          ))}
        </select>
        <p style={hint}>
          {committees.length} comitê(s) neste evento · {existing.length} membro(s) já cadastrado(s).
        </p>
      </div>

      {/* Resultado da importação (PDF + rollback) */}
      {result ? (
        <ResultPanel
          result={result}
          perPage={perPage}
          setPerPage={setPerPage}
          pdfBusy={pdfBusy}
          rollbackBusy={rollbackBusy}
          onPdf={handlePdf}
          onRollback={handleRollback}
          onNew={() => setResult(null)}
        />
      ) : (
        <>
          {/* Upload */}
          <div className="mt-8">
            <Label>Planilha</Label>
            <label style={uploadBtn}>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFile}
                style={{ display: "none" }}
              />
              {fileName ? `Trocar arquivo (${fileName})` : "Selecionar arquivo .csv/.xlsx"}
            </label>
            {parseError && (
              <p style={{ ...hint, color: "var(--warning)" }}>{parseError}</p>
            )}
          </div>

          {/* Preview */}
          {parsed && (
            <div className="mt-8">
              <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 12 }}>
                <SummaryChip color="var(--success)" label={`${counts.new} novos`} />
                <SummaryChip color="var(--text-muted)" label={`${counts.duplicate} já existem`} />
                <SummaryChip color="var(--warning)" label={`${counts.error} com problema`} />
                {parsed.separator && (
                  <span style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}>
                    Separador detectado: <strong style={{ color: "var(--text-secondary)" }}>{parsed.separator}</strong>
                  </span>
                )}
                {!parsed.columns.pais && (
                  <span style={{ fontSize: "var(--fs-tiny)", color: "var(--warning)" }}>
                    Coluna de país não reconhecida — país ficará vazio.
                  </span>
                )}
              </div>

              <PreviewTable rows={preview} />

              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || counts.new === 0}
                  style={{
                    ...primaryBtn,
                    opacity: importing || counts.new === 0 ? 0.5 : 1,
                    cursor: importing || counts.new === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {importing ? "Importando…" : `Importar ${counts.new} delegados`}
                </button>
                {counts.error > 0 && (
                  <span style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)" }}>
                    Linhas com problema são ignoradas.
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {toast && <div style={toastStyle}>{toast}</div>}
    </div>
  );
}

/* ── Painel de resultado (pós-importação) ─────────────────────────────────── */

function ResultPanel({ result, perPage, setPerPage, pdfBusy, rollbackBusy, onPdf, onRollback, onNew }) {
  return (
    <div
      className="mt-8"
      style={{
        background: "linear-gradient(180deg, hsl(158 70% 40% / 0.08), var(--bg-elevated))",
        border: "1px solid hsl(158 70% 40% / 0.4)",
        borderRadius: "var(--radius-lg)",
        padding: "22px 24px",
      }}
    >
      <p style={{ fontWeight: 700, color: "var(--success)", margin: 0 }}>
        ✓ {result.created.length} delegados importados
      </p>
      <p style={{ fontSize: "var(--fs-tiny)", color: "var(--text-muted)", margin: "4px 0 18px" }}>
        Lote {result.importBatchId}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span style={{ fontSize: "var(--fs-small)", color: "var(--text-secondary)" }}>
          Crachás por página:
        </span>
        <div role="group" style={segGroup}>
          {[4, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPerPage(n)}
              aria-pressed={perPage === n}
              style={{
                ...segBtn,
                background: perPage === n ? "hsl(255 72% 62% / 0.12)" : "transparent",
                color: perPage === n ? "var(--indigo-300)" : "var(--text-muted)",
                border: `1px solid ${perPage === n ? "var(--indigo-400)" : "transparent"}`,
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <button type="button" onClick={onPdf} disabled={pdfBusy} style={primaryBtn}>
          {pdfBusy ? "Gerando…" : "Baixar PDF com QR codes"}
        </button>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button type="button" onClick={onNew} style={ghostBtn}>
          Nova importação
        </button>
        <button
          type="button"
          onClick={onRollback}
          disabled={rollbackBusy}
          style={{ ...ghostBtn, color: "var(--danger)", borderColor: "hsl(0 75% 60% / 0.4)" }}
        >
          {rollbackBusy ? "Desfazendo…" : "Desfazer importação"}
        </button>
      </div>
    </div>
  );
}

/* ── Tabela de preview ────────────────────────────────────────────────────── */

function PreviewTable({ rows }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-card)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-small)" }}>
        <thead>
          <tr>
            {["Nome", "País", "Comitê", "Status"].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={td}>{r.nome || <em style={{ color: "var(--text-muted)" }}>vazio</em>}</td>
              <td style={td}>{r.pais || "—"}</td>
              <td style={td}>{r.committee?.sigla || r.comite || "—"}</td>
              <td style={td}>
                <RowStatus status={r.status} reason={r.reason} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowStatus({ status, reason }) {
  const map = {
    new: { color: "var(--success)", label: "Novo" },
    duplicate: { color: "var(--text-muted)", label: "Já existe" },
    error: { color: "var(--warning)", label: reason || "Problema" },
  };
  const s = map[status];
  return <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>;
}

/* ── Pequenos componentes / estilos ───────────────────────────────────────── */

function Label({ children }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-tiny)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        margin: "0 0 8px",
      }}
    >
      {children}
    </p>
  );
}

function SummaryChip({ color, label }) {
  return (
    <span
      style={{
        fontSize: "var(--fs-tiny)",
        fontWeight: 600,
        color,
        background: "var(--bg-overlay)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-badge)",
        padding: "3px 12px",
      }}
    >
      {label}
    </span>
  );
}

const container = {
  maxWidth: 1000,
  margin: "0 auto",
  padding: "40px clamp(16px, 5vw, 64px)",
  fontFamily: "var(--font-ui)",
  color: "var(--text-secondary)",
};

const h1 = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h1)",
  fontWeight: 400,
  color: "var(--text-primary)",
  margin: 0,
};

const hint = { fontSize: "var(--fs-tiny)", color: "var(--text-muted)", margin: "8px 0 0" };

const selectStyle = {
  fontSize: "var(--fs-small)",
  color: "var(--text-primary)",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-btn)",
  padding: "8px 12px",
  minWidth: 260,
};

const uploadBtn = {
  display: "inline-block",
  fontSize: "var(--fs-small)",
  fontWeight: 600,
  color: "var(--indigo-300)",
  background: "var(--bg-overlay)",
  border: "1px dashed var(--indigo-400)",
  borderRadius: "var(--radius-btn)",
  padding: "12px 18px",
  cursor: "pointer",
};

const primaryBtn = {
  fontSize: "var(--fs-small)",
  fontWeight: 700,
  color: "var(--bg-base)",
  background: "linear-gradient(90deg, var(--indigo-500), var(--accent-400))",
  border: "none",
  borderRadius: "var(--radius-btn)",
  padding: "9px 18px",
  cursor: "pointer",
};

const ghostBtn = {
  fontSize: "var(--fs-small)",
  fontWeight: 600,
  color: "var(--text-secondary)",
  background: "transparent",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-btn)",
  padding: "8px 16px",
  cursor: "pointer",
};

const segGroup = {
  display: "inline-flex",
  gap: 4,
  background: "var(--bg-overlay)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-badge)",
  padding: 3,
};

const segBtn = {
  borderRadius: "var(--radius-badge)",
  padding: "4px 14px",
  fontSize: "var(--fs-tiny)",
  fontWeight: 700,
  cursor: "pointer",
};

const th = {
  textAlign: "left",
  padding: "10px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-tiny)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  background: "var(--bg-overlay)",
};

const td = { padding: "9px 14px", color: "var(--text-primary)" };

const toastStyle = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  background: "var(--bg-overlay)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-btn)",
  padding: "10px 18px",
  fontSize: "var(--fs-small)",
  color: "var(--text-primary)",
  boxShadow: "var(--ring-soft)",
  zIndex: 50,
};
