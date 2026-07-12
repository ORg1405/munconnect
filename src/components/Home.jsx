import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { MUN_COMMITTEES } from "../data/munCommittees";
import { DEFAULT_CONFERENCE_ID } from "../data/firestore";
import UpcomingSimulations from "./UpcomingSimulations";
import Calendar from "./Calendar";
import EventModal from "./EventModal";
import AddEventModal from "./AddEventModal";

// ── PT-BR date helpers (espelham os de Calendar.jsx) ──────────────────────────
const MONTHS_SHORT_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function evSpan(ev) {
  return {
    start: ev.dateStart || ev.date || "",
    end: ev.dateEnd || ev.dateStart || ev.date || "",
  };
}

function fmtLong(ev) {
  const { start, end } = evSpan(ev);
  if (!start) return "";
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sm = MONTHS_SHORT_PT[s.getMonth()];
  const em = MONTHS_SHORT_PT[e.getMonth()];
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth())
    return s.getDate() === e.getDate()
      ? `${s.getDate()} de ${sm} de ${s.getFullYear()}`
      : `${s.getDate()} a ${e.getDate()} de ${sm} de ${s.getFullYear()}`;
  return `${s.getDate()} de ${sm} – ${e.getDate()} de ${em} de ${e.getFullYear()}`;
}

// Dot color matching Calendar's EVENT_PILL keys
const DOT = {
  green: "hsl(160 65% 46%)",
  blue: "hsl(205 68% 56%)",
  red: "hsl(0 68% 58%)",
  purple: "hsl(252 62% 66%)",
  amber: "hsl(38 88% 62%)",
  pink: "hsl(330 62% 64%)",
  teal: "hsl(175 66% 44%)",
  gray: "hsl(220 8% 58%)",
};
const dotColor = (ev) => DOT[ev?.color] ?? DOT.blue;

// ── Activity feed (dados de exemplo) ──────────────────────────────────────────
// TODO: substituir por uma coleção real do Firestore (ex.: "activity") quando
// existir. Hoje não há coleção de atividades — abaixo são dados ilustrativos.
const SAMPLE_ACTIVITY = [
  { id: 1, kind: "motion", text: ["Moção gerada para o comitê ", "DISEC"], time: "há 2 horas" },
  { id: 2, kind: "conference", text: ["Nova conferência adicionada: ", "SiSAN"], time: "ontem" },
  { id: 3, kind: "delegate", text: ["Delegado adicionado ao comitê ", "ECOSOC"], time: "há 3 dias" },
  { id: 4, kind: "deadline", text: ["Prazo de inscrição atualizado: ", "SiB"], time: "há 4 dias" },
];

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = {
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  conf: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 21V4l9-1v18M4 9h9M13 7l7 2v12H4" /></svg>,
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  doc: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M21 20c0-2.6-1.6-4.6-4-5.2" /></svg>,
  cal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  motion: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  debate: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
};

const FEED_ICON = {
  motion: { icon: Icon.doc, color: "var(--brand-400)" },
  conference: { icon: Icon.plus, color: DOT.green },
  delegate: { icon: Icon.users, color: DOT.purple },
  deadline: { icon: Icon.clock, color: DOT.amber },
};

function displayName(user) {
  if (!user) return "delegado(a)";
  if (user.displayName) return user.displayName.split(" ")[0];
  if (user.email) {
    const handle = user.email.split("@")[0];
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }
  return "delegado(a)";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Home({ isAdmin = false, setActiveTab }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "conferences"), (snap) => {
      setConferences(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Próximas conferências: data de fim >= hoje, ordenadas pela mais próxima.
  const upcoming = conferences
    .filter((ev) => evSpan(ev).end >= todayStr)
    .sort((a, b) => evSpan(a).start.localeCompare(evSpan(b).start));

  const spotlight = upcoming[0] ?? null;        // próxima conferência (limit 1)
  const upcomingPanel = upcoming.slice(0, 5);    // próximas conferências (limit 5)

  // ── Stats ──
  const stats = [
    { icon: Icon.conf, num: upcoming.length, label: "Conferências ativas" },
    { icon: Icon.grid, num: MUN_COMMITTEES.length, label: "Comitês disponíveis" },
    // TODO: ligar a uma coleção real de moções (ex.: "motions") quando existir.
    { icon: Icon.doc, num: null, label: "Moções geradas", soon: true },
    // TODO: ligar a uma coleção real de delegados (ex.: "delegates") quando existir.
    { icon: Icon.users, num: null, label: "Delegados", soon: true },
  ];

  async function handleAddEvent(data) {
    await addDoc(collection(db, "conferences"), { ...data, createdAt: Timestamp.now() });
    setShowAdd(false);
  }

  // Itens da seção "Próximas simulações": futuras, da mais próxima à mais distante.
  const upcomingSims = upcoming.map((ev) => ({
    id: ev.id,
    name: ev.name,
    dateLabel: fmtLong(ev),
  }));

  return (
    <div style={{
      minHeight: "100%",
      background: "linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
      padding: "clamp(16px, 3vw, 36px)",
      fontFamily: "var(--font-ui)",
    }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: 30 }}>

        {/* ═══════════ FAIXA DE BOAS-VINDAS ═══════════ */}
        <section style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 28, flexWrap: "wrap",
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 27, fontWeight: 600, color: "var(--text-primary)", letterSpacing: ".2px" }}>
              Bem-vindo de volta, <span style={{ color: "var(--brand-400)" }}>{displayName(user)}</span>.
            </h1>
            <p style={{ margin: "7px 0 0", fontSize: 14.5, color: "var(--text-muted)", maxWidth: 520 }}>
              Cada moção começa com uma boa preparação. Veja o que está acontecendo nos seus comitês hoje.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <label className="card-glow" style={{
              display: "flex", alignItems: "center", gap: 9,
              background: "var(--bg-overlay)", border: "1px solid var(--border)",
              borderRadius: 11, padding: "0 13px", height: 42, width: 230,
            }}>
              <span style={{ width: 16, height: 16, color: "var(--text-muted)", display: "flex", flexShrink: 0 }}>{Icon.search}</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar conferências…"
                style={{
                  background: "none", border: "none", outline: "none",
                  color: "var(--text-primary)", fontFamily: "inherit", fontSize: 13.5, width: "100%",
                }}
              />
            </label>
            {isAdmin && (
              <button onClick={() => setShowAdd(true)} style={primaryBtn}>
                <span style={{ width: 16, height: 16, display: "flex" }}>{Icon.plus}</span>
                Nova Conferência
              </button>
            )}
          </div>
        </section>

        {/* ═══════════ CARDS DE ESTATÍSTICA ═══════════ */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
          {stats.map((s) => (
            <div key={s.label} className="card-glow" style={cardBase}>
              <div style={statIcon}><span style={{ width: 19, height: 19, display: "flex" }}>{s.icon}</span></div>
              <div>
                <div style={{
                  fontSize: 32, fontWeight: 700, color: "var(--text-primary)",
                  lineHeight: 1, letterSpacing: "-.5px",
                }}>
                  {loading ? "—" : s.num ?? "—"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>{s.label}</div>
                {s.soon && (
                  <div style={{ fontSize: 11, color: "var(--accent-400)", fontWeight: 600, marginTop: 6 }}>
                    em breve
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* ═══════════ SPOTLIGHT ═══════════ */}
        <section className="card-spotlight" style={{
          position: "relative", overflow: "hidden",
          border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)",
          background: `radial-gradient(90% 130% at 88% 8%, hsl(199 92% 58% / 0.16) 0%, transparent 55%), linear-gradient(118deg, var(--bg-overlay) 0%, var(--bg-elevated) 60%, var(--bg-base) 100%)`,
          padding: "28px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 32, flexWrap: "wrap",
        }}>
          <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              color: "var(--brand-400)", fontSize: 12, fontWeight: 600,
              letterSpacing: "1px", textTransform: "uppercase",
            }}>
              <span className="today-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brand-glow)" }} />
              Próxima conferência em destaque
            </div>

            {spotlight ? (
              <>
                <h2 style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)", margin: "12px 0 0", letterSpacing: ".2px" }}>
                  {spotlight.name}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 13, color: "var(--text-secondary)", fontSize: 13.5, flexWrap: "wrap" }}>
                  <span style={spotMeta}><span style={spotMetaIcon}>{Icon.cal}</span>{fmtLong(spotlight)}</span>
                  {spotlight.local && (
                    <span style={spotMeta}><span style={spotMetaIcon}>{Icon.pin}</span>{spotlight.local}</span>
                  )}
                </div>
                {spotlight.region && (
                  <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 11.5, fontWeight: 600, color: "var(--brand-400)",
                      border: "1px solid hsl(205 68% 58% / 0.35)", background: "hsl(205 68% 58% / 0.1)",
                      padding: "4px 11px", borderRadius: "var(--radius-badge)", letterSpacing: ".3px",
                    }}>{spotlight.region}</span>
                  </div>
                )}
              </>
            ) : (
              <h2 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-secondary)", margin: "12px 0 0" }}>
                {loading ? "Carregando…" : "Nenhuma conferência próxima no momento."}
              </h2>
            )}
          </div>

          {spotlight && (
            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
              <button onClick={() => setDetail(spotlight)} style={primaryBtn}>
                Ver detalhes
                <span style={{ width: 16, height: 16, display: "flex" }}>{Icon.arrow}</span>
              </button>
            </div>
          )}
        </section>

        {/* ═══════════ CALENDÁRIO (reusa o componente existente) ═══════════ */}
        {/* O Calendar já traz: chips de região + grade mensal + painel
            "Próximas Conferências", tudo ligado ao Firestore. */}
        <section>
          <Calendar isAdmin={isAdmin} embedded />
        </section>

        {/* ═══════════ PRÓXIMAS SIMULAÇÕES ═══════════ */}
        {/* Lista cronológica das simulações futuras (mais próxima → mais distante),
            ligada ao Firestore. Cada item navega para a página da simulação. */}
        <UpcomingSimulations simulations={upcomingSims} loading={loading} />

        {/* ═══════════ ATIVIDADE RECENTE ═══════════ */}
        <section className="card-glow" style={{ ...cardBase, flexDirection: "column", gap: 0, padding: "20px 22px" }}>
          <p style={panelTitle}>Atividade recente</p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {SAMPLE_ACTIVITY.map((a, i) => {
              const fi = FEED_ICON[a.kind] ?? FEED_ICON.conference;
              return (
                <div key={a.id} style={{
                  display: "flex", gap: 13, padding: "13px 0",
                  borderBottom: i < SAMPLE_ACTIVITY.length - 1 ? "1px solid var(--border)" : "none",
                  paddingTop: i === 0 ? 0 : 13,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                    display: "grid", placeItems: "center",
                    background: "var(--bg-base)", border: "1px solid var(--border)", color: fi.color,
                  }}>
                    <span style={{ width: 15, height: 15, display: "flex" }}>{fi.icon}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                      {a.text[0]}<b style={{ color: "var(--text-primary)", fontWeight: 600 }}>{a.text[1]}</b>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{a.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════════ ACESSO RÁPIDO ═══════════ */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
          <QuickCard
            icon={Icon.motion}
            title="Gerador de Moção"
            desc="Crie moções formais em segundos a partir de modelos prontos por comitê."
            onClick={() => setActiveTab?.("motion")}
          />
          <QuickCard
            icon={Icon.debate}
            title="IA de Debate"
            desc="Pratique discursos e réplicas com um oponente de IA antes da sessão."
            soon
            onClick={() => setActiveTab?.("debate")}
          />
          <QuickCard
            icon={Icon.grid}
            title="Comitês"
            desc="Explore comitês, tópicos em pauta e as listas de delegados de cada um."
            onClick={() => navigate(`/conference/${DEFAULT_CONFERENCE_ID}`)}
          />
        </section>
      </div>

      {detail && <EventModal event={detail} onClose={() => setDetail(null)} />}
      {showAdd && <AddEventModal onSave={handleAddEvent} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// ── Quick access card ─────────────────────────────────────────────────────────
function QuickCard({ icon, title, desc, soon, onClick }) {
  return (
    <div className="card-glow qcard" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
      style={{ ...cardBase, flexDirection: "column", gap: 14, padding: 24, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center",
          background: "hsl(205 68% 58% / 0.13)", color: "var(--brand-400)",
        }}>
          <span style={{ width: 22, height: 22, display: "flex" }}>{icon}</span>
        </div>
        {soon ? (
          <span style={{
            fontSize: 10.5, fontWeight: 600, color: "var(--text-muted)",
            background: "var(--bg-base)", padding: "2px 8px", borderRadius: "var(--radius-badge)",
          }}>em breve</span>
        ) : (
          <span className="qcard-arrow" style={{ color: "var(--text-muted)", width: 18, height: 18, display: "flex" }}>{Icon.arrow}</span>
        )}
      </div>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}

// ── Estilos inline reutilizados ───────────────────────────────────────────────
const cardBase = {
  background: "var(--bg-overlay)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "20px 20px 18px",
  display: "flex",
  gap: 14,
};

const statIcon = {
  width: 38, height: 38, borderRadius: 11, flexShrink: 0,
  display: "grid", placeItems: "center",
  background: "hsl(205 68% 58% / 0.13)", color: "var(--brand-400)",
};

const primaryBtn = {
  display: "inline-flex", alignItems: "center", gap: 8,
  fontFamily: "inherit", fontSize: 14, fontWeight: 600,
  borderRadius: "var(--radius-btn)", padding: "0 18px", height: 42,
  cursor: "pointer", border: "none", whiteSpace: "nowrap",
  background: "var(--brand-500)", color: "var(--text-primary)",
  boxShadow: "0 6px 20px -8px hsl(205 72% 42% / 0.7)",
};

const spotMeta = { display: "flex", alignItems: "center", gap: 7 };
const spotMetaIcon = { width: 15, height: 15, color: "var(--brand-400)", display: "flex", flexShrink: 0 };

const panelTitle = {
  margin: "0 0 16px", fontSize: 11.5, fontWeight: 700,
  letterSpacing: "1.3px", color: "var(--text-muted)", textTransform: "uppercase",
};
