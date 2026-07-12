import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import EventModal from "./EventModal";
import AddEventModal from "./AddEventModal";

// ── PT-BR strings ────────────────────────────────────────────────────────────
const MONTHS_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const MONTHS_SHORT_PT = [
  "jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez",
];
const DAYS_PT = ["D","S","T","Q","Q","S","S"]; // domingo → sábado

// ── Event pill colors — dark-mode variants ────────────────────────────────────
const EVENT_PILL = {
  green:  { pill: "hsl(160 55% 24%)", dot: "hsl(160 65% 46%)", text: "#d4fced" },
  blue:   { pill: "hsl(207 65% 26%)", dot: "hsl(205 68% 56%)", text: "#d6edfb" },
  red:    { pill: "hsl(0 58% 28%)",   dot: "hsl(0 68% 58%)",   text: "#fbd6d6" },
  purple: { pill: "hsl(250 48% 30%)", dot: "hsl(252 62% 66%)", text: "#e8e6fc" },
  amber:  { pill: "hsl(35 72% 28%)",  dot: "hsl(38 88% 62%)",  text: "#faecd4" },
  pink:   { pill: "hsl(330 50% 28%)", dot: "hsl(330 62% 64%)", text: "#fad4e3" },
  teal:   { pill: "hsl(175 52% 23%)", dot: "hsl(175 66% 44%)", text: "#ccf5eb" },
  gray:   { pill: "hsl(220 12% 24%)", dot: "hsl(220 8%  58%)", text: "#e8e7e6" },
};

function evColors(ev) { return EVENT_PILL[ev?.color] ?? EVENT_PILL.blue; }

const REGIONS = ["LATAM", "EUA", "Europa"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function evSpan(ev) {
  return {
    start: ev.dateStart || ev.date || "",
    end:   ev.dateEnd   || ev.dateStart || ev.date || "",
  };
}

function fmtLong(ev) {
  const { start, end } = evSpan(ev);
  if (!start) return "";
  const s = new Date(start + "T00:00:00");
  const e = new Date(end   + "T00:00:00");
  const sm = MONTHS_SHORT_PT[s.getMonth()];
  const em = MONTHS_SHORT_PT[e.getMonth()];
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth())
    return s.getDate() === e.getDate()
      ? `${s.getDate()} de ${sm}`
      : `${s.getDate()} a ${e.getDate()} de ${sm}`;
  return `${s.getDate()} de ${sm} – ${e.getDate()} de ${em}`;
}

const BellIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

// ── Component ────────────────────────────────────────────────────────────────
export default function Calendar({ isAdmin = false, embedded = false }) {
  const today    = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [year,          setYear]          = useState(today.getFullYear());
  const [month,         setMonth]         = useState(today.getMonth());
  const [events,        setEvents]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAdd,       setShowAdd]       = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [activeRegions, setActiveRegions] = useState(new Set(REGIONS));
  const [isDesktop,     setIsDesktop]     = useState(() => window.innerWidth >= 900);
  const listRefs = useRef({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "conferences"), (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function changeMonth(dir) {
    let m = month + dir, y = year;
    if (m > 11) { m = 0; y++; } else if (m < 0) { m = 11; y--; }
    setMonth(m); setYear(y);
  }

  async function handleAddEvent(data) {
    await addDoc(collection(db, "conferences"), { ...data, createdAt: Timestamp.now() });
    setShowAdd(false);
  }

  function toggleRegion(r) {
    setActiveRegions(prev => {
      const next = new Set(prev);
      if (next.has(r)) { if (next.size > 1) next.delete(r); }
      else next.add(r);
      return next;
    });
  }

  function passesFilter(ev) {
    if (!ev.region) return true;
    return activeRegions.has(ev.region);
  }

  const filteredEvents = events.filter(passesFilter);

  // Sunday-first grid
  function buildCells() {
    const offset = new Date(year, month, 1).getDay(); // 0=Sun
    const dim    = new Date(year, month + 1, 0).getDate();
    const prev   = new Date(year, month, 0).getDate();
    const cells  = [];
    for (let i = 0;    i < offset;     i++) cells.push({ day: prev - offset + 1 + i, cur: false });
    for (let d = 1;    d <= dim;       d++) cells.push({ day: d, cur: true });
    for (let d = 1; cells.length < 42; d++) cells.push({ day: d, cur: false });
    return cells;
  }

  function dStr(day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function firstEventForCell(cell) {
    if (!cell.cur) return null;
    const d = dStr(cell.day);
    return filteredEvents.find((ev) => {
      const { start, end } = evSpan(ev);
      return d >= start && d <= end;
    }) ?? null;
  }

  const cells = buildCells();

  const upcoming = filteredEvents
    .filter((ev) => evSpan(ev).end >= todayStr)
    .sort((a, b) => evSpan(a).start.localeCompare(evSpan(b).start));

  const legendEvents = filteredEvents.filter((ev) => {
    const { start, end } = evSpan(ev);
    const mStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const mEnd   = `${year}-${String(month + 1).padStart(2, "0")}-31`;
    return start <= mEnd && end >= mStart;
  });

  function handleDayClick(ev) {
    setHighlightedId(ev.id);
    setSelectedEvent(ev);
    setTimeout(() => {
      listRefs.current[ev.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  function handleListClick(ev) {
    setHighlightedId(ev.id);
    const { start } = evSpan(ev);
    if (start) {
      const d = new Date(start + "T00:00:00");
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: embedded ? "auto" : "100%",
      background: embedded
        ? "transparent"
        : "linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
      padding: embedded ? 0 : "clamp(16px, 3vw, 36px)",
      fontFamily: "var(--font-ui)",
    }}>
      <div style={{
        maxWidth: embedded ? "none" : 1080,
        margin: embedded ? 0 : "0 auto",
        display: "grid",
        gridTemplateColumns: isDesktop ? "minmax(420px, 620px) 1fr" : "1fr",
        gap: isDesktop ? 20 : 16,
        alignItems: "start",
      }}>

        {/* ═══════════════ CALENDÁRIO ═══════════════ */}
        <div className="card-glow" style={{
          background: "var(--bg-overlay)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}>

          {/* Cabeçalho */}
          <div style={{
            padding: "18px 20px 0",
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            gap: 10, flexWrap: "wrap",
            marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => changeMonth(-1)} aria-label="Mês anterior" className="nav-btn" style={navBtnS}>‹</button>
              <button onClick={() => changeMonth(1)}  aria-label="Próximo mês"  className="nav-btn" style={navBtnS}>›</button>
              <h2 style={{
                margin: "0 0 0 6px", fontSize: 18, fontWeight: 600,
                color: "var(--text-secondary)", letterSpacing: "-0.01em",
              }}>
                {MONTHS_PT[month]} de {year}
              </h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: "var(--brand-400)", letterSpacing: "0.02em",
              }}>
                {upcoming.length} {upcoming.length === 1 ? "próxima" : "próximas"}
              </span>
              {isAdmin && (
                <>
                  <button onClick={() => setShowAdd(true)} style={addBtnS}>+ Adicionar</button>
                  <button
                    onClick={() => console.log("TODO: deadline modal")}
                    aria-label="Prazo de inscrições"
                    style={deadlineBtnS}
                  >
                    <BellIcon /> Prazo
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Rótulos dos dias (D S T Q Q S S) */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
            padding: "0 12px", marginBottom: 2,
          }}>
            {DAYS_PT.map((d, i) => (
              <div key={i} style={{
                textAlign: "center", fontSize: 11, fontWeight: 700,
                color: "var(--text-muted)", letterSpacing: "0.1em",
                textTransform: "uppercase", padding: "5px 0",
              }}>{d}</div>
            ))}
          </div>

          {/* Grade */}
          <div style={{ padding: "0 8px" }}>
            {loading ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Carregando…
              </div>
            ) : (
              <div
                key={`${year}-${month}`}
                role="grid"
                aria-label="Calendário de conferências"
                className="cal-grid"
                style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 4 }}
              >
                {cells.map((cell, i) => {
                  const col = i % 7;
                  const isToday = cell.cur &&
                    year === today.getFullYear() &&
                    month === today.getMonth() &&
                    cell.day === today.getDate();
                  const ev  = firstEventForCell(cell);
                  const d   = cell.cur ? dStr(cell.day) : null;
                  const { start, end } = ev ? evSpan(ev) : {};

                  // Check adjacent cells to detect transitions between different events
                  const prevEv = i > 0 ? firstEventForCell(cells[i - 1]) : null;
                  const nextEv = i < cells.length - 1 ? firstEventForCell(cells[i + 1]) : null;

                  // Round left when: start of THIS event, first column, or previous cell had a DIFFERENT event
                  const roundL = !!ev && (d === start || col === 0 || (prevEv && prevEv.id !== ev.id));
                  // Round right when: end of THIS event, last column, or next cell has a DIFFERENT event
                  const roundR = !!ev && (d === end   || col === 6 || (nextEv && nextEv.id !== ev.id));

                  const cols   = ev ? evColors(ev) : null;
                  const isHi   = ev?.id === highlightedId;
                  // Past event: end date is before today
                  const isPast = ev && evSpan(ev).end < todayStr;

                  return (
                    <div
                      key={i}
                      role="gridcell"
                      aria-label={d ?? undefined}
                      tabIndex={ev && cell.cur ? 0 : -1}
                      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && ev && cell.cur) handleDayClick(ev); }}
                      onClick={() => ev && cell.cur && handleDayClick(ev)}
                      className={ev && cell.cur ? "ev-cell" : ""}
                      style={{
                        height: 52, position: "relative",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: ev && cell.cur ? "pointer" : "default",
                        opacity: cell.cur ? 1 : 0.12,
                      }}
                    >
                      {/* Range pill background */}
                      {ev && (
                        <div
                          className="ev-pill-bg"
                          style={{
                            position: "absolute",
                            top: 5, bottom: 5,
                            left:  roundL ? 7 : 0,
                            right: roundR ? 7 : 0,
                            background: cols.pill,
                            opacity: isPast ? 0.38 : 1,
                            outline: isHi ? `1.5px solid ${cols.dot}` : "none",
                            outlineOffset: "-1px",
                            borderTopLeftRadius:     roundL ? 8 : 0,
                            borderBottomLeftRadius:  roundL ? 8 : 0,
                            borderTopRightRadius:    roundR ? 8 : 0,
                            borderBottomRightRadius: roundR ? 8 : 0,
                          }}
                        />
                      )}
                      {/* Today pulsing ring */}
                      {isToday && !ev && (
                        <div
                          className="today-pulse"
                          style={{
                            position: "absolute",
                            width: 30, height: 30,
                            border: "1.5px solid var(--brand-400)",
                            pointerEvents: "none",
                          }}
                        />
                      )}
                      <span style={{
                        position: "relative", zIndex: 1, fontSize: 14,
                        fontWeight: ev ? 700 : isToday ? 600 : 400,
                        opacity: isPast ? 0.5 : 1,
                        color: ev
                          ? cols.text
                          : isToday
                            ? "var(--brand-400)"
                            : "var(--text-secondary)",
                        transition: "opacity 0.2s",
                      }}>
                        {cell.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legenda */}
          {legendEvents.length > 0 && (
            <div style={{
              borderTop: "1px solid var(--border)",
              margin: "14px 20px 0",
              paddingTop: 12, paddingBottom: 0,
              display: "flex", flexDirection: "column", gap: 7,
            }}>
              {legendEvents.map((ev) => {
                const cols = evColors(ev);
                return (
                  <div key={ev.id} style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: cols.dot, flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        color: "var(--text-primary)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{ev.name}</span>
                    </div>
                    <span style={{
                      fontSize: 11, color: "var(--text-muted)",
                      whiteSpace: "nowrap", flexShrink: 0,
                    }}>{fmtLong(ev)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rodapé */}
          <div style={{
            borderTop: "1px solid var(--border)",
            margin: "14px 20px 0",
            paddingTop: 10, paddingBottom: 16,
          }}>
            <p style={{
              margin: 0, fontSize: 10, color: "var(--text-muted)",
              lineHeight: 1.5, letterSpacing: "0.01em",
            }}>
              — Cobertura LATAM, EUA e Europa. Prazos sincronizados ao seu calendário.
            </p>
          </div>
        </div>

        {/* ═══════════════ PAINÉIS LATERAIS ═══════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Filtros por região */}
          <div className="card-glow panel-slide" style={{
            background: "var(--bg-overlay)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            padding: "14px 18px",
          }}>
            <p style={{
              margin: "0 0 10px", fontSize: 10, fontWeight: 700,
              color: "var(--text-muted)", letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}>Filtrar por região</p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {REGIONS.map((r) => {
                const active = activeRegions.has(r);
                return (
                  <button
                    key={r}
                    onClick={() => toggleRegion(r)}
                    aria-pressed={active}
                    className="region-chip"
                    style={{
                      padding: "4px 13px",
                      fontSize: 12, fontWeight: 500,
                      borderRadius: "var(--radius-badge)",
                      border: active
                        ? "1px solid var(--brand-400)"
                        : "1px solid var(--border-strong)",
                      background: active
                        ? "hsl(205 68% 58% / 0.13)"
                        : "transparent",
                      color: active ? "var(--brand-400)" : "var(--text-muted)",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Próximas conferências */}
          <div className="card-glow panel-slide" style={{
            background: "var(--bg-overlay)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            overflow: "hidden",
            flex: 1,
          }}>
            <div style={{ padding: "14px 18px 10px" }}>
              <p style={{
                margin: 0, fontSize: 10, fontWeight: 700,
                color: "var(--text-muted)", letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}>Próximas conferências</p>
            </div>

            {loading ? (
              <div style={{ padding: "12px 18px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[1,2,3].map(n => (
                  <div key={n} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div className="skeleton" style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0 }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                      <div className="skeleton" style={{ height: 12, width: `${60 + n * 15}%` }} />
                      <div className="skeleton" style={{ height: 9,  width: "40%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <div style={{ padding: "20px 18px", color: "var(--text-muted)", fontSize: 13 }}>
                Nenhuma conferência próxima.
              </div>
            ) : (
              <div style={{ paddingBottom: 8 }}>
                {upcoming.map((ev) => {
                  const cols = evColors(ev);
                  const isHi = ev.id === highlightedId;
                  return (
                    <div
                      key={ev.id}
                      ref={(el) => { listRefs.current[ev.id] = el; }}
                      onClick={() => handleListClick(ev)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleListClick(ev); }}
                      className="upcoming-row"
                      style={{
                        display: "flex", alignItems: "flex-start",
                        gap: 11, padding: "9px 18px",
                        cursor: "pointer",
                        background: isHi ? "hsl(205 68% 58% / 0.07)" : "transparent",
                        borderLeft: isHi ? `3px solid ${cols.dot}` : "3px solid transparent",
                        outline: "none",
                      }}
                    >
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: cols.dot, flexShrink: 0, marginTop: 5,
                      }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          marginBottom: 3,
                        }}>{ev.name}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtLong(ev)}</span>
                          {ev.local && (
                            <span style={{
                              fontSize: 10, color: "var(--text-muted)",
                              padding: "1px 5px",
                              border: "1px solid var(--border)",
                              borderRadius: 4,
                            }}>{ev.local}</span>
                          )}
                          {ev.region && (
                            <span style={{
                              fontSize: 10, color: cols.dot,
                              padding: "1px 5px",
                              border: `1px solid ${cols.dot}44`,
                              borderRadius: 4,
                              background: `${cols.dot}14`,
                            }}>{ev.region}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => { setSelectedEvent(null); setHighlightedId(null); }}
        />
      )}
      {showAdd && <AddEventModal onSave={handleAddEvent} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// ── Inline style constants ───────────────────────────────────────────────────
const navBtnS = {
  width: 26, height: 26,
  background: "transparent", border: "none",
  cursor: "pointer", fontSize: 16,
  color: "var(--text-muted)",
  display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: 6,
};

const addBtnS = {
  fontSize: 11, padding: "4px 10px",
  background: "var(--brand-500)", color: "var(--text-primary)",
  border: "none", borderRadius: "var(--radius-btn)",
  cursor: "pointer", fontWeight: 600,
};

const deadlineBtnS = {
  fontSize: 11, padding: "4px 9px",
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)", borderRadius: 7,
  cursor: "pointer",
  display: "flex", alignItems: "center", gap: 5,
};
