import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import EventModal from "./EventModal";
import AddEventModal, { COLORS } from "./AddEventModal";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

// ─── Mude para false para desativar o modo admin ───────────────────────────
const IS_ADMIN = true;

export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  // ── Escuta o Firestore em tempo real ──────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "conferences"), (snap) => {
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEvents(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function changeMonth(dir) {
    let m = month + dir;
    let y = year;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setMonth(m);
    setYear(y);
  }

  async function handleAddEvent(formData) {
    await addDoc(collection(db, "conferences"), {
      ...formData,
      createdAt: Timestamp.now(),
    });
    setShowAdd(false);
  }

  // ── Gera as células do calendário ─────────────────────────────────────────
  function buildCells() {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: prevDays - firstDay + 1 + i, current: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, current: true });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, current: false });
    }
    return cells;
  }

  function dateStr(day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function eventsForDay(day) {
    const d = dateStr(day);
    return events.filter((e) => {
      const start = e.dateStart || e.date;
      const end = e.dateEnd || e.dateStart || e.date;
      return d >= start && d <= end;
    });
  }

  function isFirstDay(ev, day) {
    return dateStr(day) === (ev.dateStart || ev.date);
  }

  const cells = buildCells();

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>
            {MONTHS[month]} {year}
          </h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Conferências em BH</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {IS_ADMIN && (
            <span style={{ fontSize: 11, background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 8, marginRight: 4 }}>
              admin
            </span>
          )}
          <button onClick={() => changeMonth(-1)} style={navBtnStyle}>‹</button>
          <button onClick={() => changeMonth(1)} style={navBtnStyle}>›</button>
          {IS_ADMIN && (
            <button onClick={() => setShowAdd(true)} style={addBtnStyle}>
              + Adicionar
            </button>
          )}
        </div>
      </div>

      {/* Dias da semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#aaa", padding: "4px 0", fontWeight: 500 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#aaa", fontSize: 14 }}>
          Carregando conferências...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((cell, i) => {
            const isToday =
              cell.current &&
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === cell.day;
            const dayEvents = cell.current ? eventsForDay(cell.day) : [];

            return (
              <div
                key={i}
                style={{
                  minHeight: 72,
                  border: isToday ? "1px solid #1D9E75" : "0.5px solid #e0ddd6",
                  borderRadius: 6,
                  padding: 6,
                  opacity: cell.current ? 1 : 0.35,
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: 12, color: isToday ? "#1D9E75" : "#888", fontWeight: 500 }}>
                  {cell.day}
                </div>
                {dayEvents.map((ev) => {
                  const c = COLORS.find((x) => x.id === ev.color) || COLORS[0];
                  const first = isFirstDay(ev, cell.day);
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      style={{
                        fontSize: 10,
                        marginTop: 3,
                        padding: "2px 5px",
                        borderRadius: first ? "4px 4px 4px 4px" : "0px",
                        background: c.bg,
                        color: c.text,
                        borderTop: `1px solid ${c.border}`,
                        borderBottom: `1px solid ${c.border}`,
                        borderLeft: first ? `1px solid ${c.border}` : "none",
                        borderRight: `1px solid ${c.border}`,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {first ? ev.name : " "}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
      {showAdd && (
        <AddEventModal onSave={handleAddEvent} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}

const navBtnStyle = {
  width: 28, height: 28,
  border: "0.5px solid #ddd",
  background: "#fff",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 16,
  color: "#555",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const addBtnStyle = {
  fontSize: 12,
  padding: "6px 12px",
  background: "#1D9E75",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 500,
};
