import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  subscribeConference,
  subscribeCommittees,
} from "../../data/firestore";
import PageShell from "./PageShell";
import ConferenceCommittees from "./ConferenceCommittees";

/** Tela 1 — Página da simulação: cabeçalho + grid de comitês (real-time). */
export default function ConferencePage() {
  const { conferenceId } = useParams();
  const [conference, setConference] = useState(undefined); // undefined = carregando
  const [committees, setCommittees] = useState([]);

  useEffect(() => {
    const unsubConf = subscribeConference(conferenceId, setConference);
    const unsubComs = subscribeCommittees(conferenceId, setCommittees);
    return () => {
      unsubConf();
      unsubComs();
    };
  }, [conferenceId]);

  if (conference === undefined) {
    return (
      <PageShell>
        <p style={{ color: "var(--text-muted)" }}>Carregando…</p>
      </PageShell>
    );
  }

  if (conference === null) {
    return (
      <PageShell>
        <p style={{ color: "var(--text-secondary)" }}>
          Simulação não encontrada.{" "}
          <Link to="/" style={{ color: "var(--brand-400)" }}>
            Voltar ao início
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ConferenceCommittees conference={conference} committees={committees} />
    </PageShell>
  );
}
