import { useEffect, useState } from "react";
import { subscribeConferences, subscribeCommittees } from "../data/firestore";
import ConferenceCommittees from "./conference/ConferenceCommittees";

// ── Guia "Comitês" do dashboard ───────────────────────────────────────────────
// Lista os comitês de TODAS as conferences cadastradas (ex.: DiploMUN 2026 e
// SISA/INTERPOL), cada uma em sua própria seção. Assim, um comitê novo aparece
// aqui assim que a conference dele existir no Firestore — sem hardcode de id.
export default function Committees() {
  const [conferences, setConferences] = useState(undefined);

  useEffect(() => subscribeConferences(setConferences), []);

  return (
    <div
      style={{
        minHeight: "100%",
        background:
          "linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
        padding: "clamp(16px, 3vw, 36px)",
        color: "var(--text-primary)",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {conferences === undefined && (
          <p style={{ color: "var(--text-muted)" }}>Carregando…</p>
        )}
        {conferences && conferences.length === 0 && (
          <p style={{ color: "var(--text-secondary)" }}>
            Nenhuma simulação cadastrada no Firestore.
          </p>
        )}
        {conferences &&
          conferences.map((conference, i) => (
            <div
              key={conference.id}
              style={{ marginTop: i === 0 ? 0 : "clamp(48px, 7vw, 88px)" }}
            >
              <ConferenceBlock conference={conference} />
            </div>
          ))}
      </div>
    </div>
  );
}

// Assina os comitês de uma conference e delega o render ao componente já usado
// pela rota /conference/:id (mesmo grid de cards).
function ConferenceBlock({ conference }) {
  const [committees, setCommittees] = useState([]);

  useEffect(
    () => subscribeCommittees(conference.id, setCommittees),
    [conference.id]
  );

  return <ConferenceCommittees conference={conference} committees={committees} />;
}
