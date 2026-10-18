// Funções PURAS da interface do Debate Trainer (sem React nem Firebase), com
// testes em debateUi.test.js.

// ── Comitês de blocos (ex.: TPI) ────────────────────────────────────────────
// O comitê declara `blocs` em src/data/munCommittees.js; o aluno escolhe um e o
// oponente fica com o outro (o backend recusa blocos iguais).

export function isBlocCommittee(committee) {
  return Array.isArray(committee?.blocs) && committee.blocs.length === 2;
}

export function opposingBloc(committee, userBloc) {
  return committee.blocs.find((b) => b.code2 !== userBloc.code2);
}

// `setup` do callable debateTurn (só vai no primeiro turno).
export function blocDebateSetup({ committee, userBloc, topic, difficulty, nivelDelegado, simsAnteriores }) {
  const aiBloc = opposingBloc(committee, userBloc);
  return {
    committeeName: committee.name,
    topic,
    userCountry: { code2: userBloc.code2, name: userBloc.name },
    aiDelegation: { code2: aiBloc.code2, name: aiBloc.name },
    difficulty,
    nivelDelegado,
    simsAnteriores,
  };
}
