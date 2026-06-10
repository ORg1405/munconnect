// ── Mock da simulação (protótipo) ─────────────────────────────────────────────
// Mantém a forma que o Firestore terá depois:
//   conference { id, nome }
//     └ committees [{ id, sigla, nomeCompleto, descricao, topics, documents }]
//         ├ topics    [{ id, ordem, titulo, subitems: [{ id, label, status }] }]
//         └ documents [{ id, titulo, subitemId, autor }]
//   status ∈ "complete" | "needs_revision" | "incomplete"
//
// Para plugar o Firestore: substituir getConference/getCommittee por queries
// reais mantendo as mesmas assinaturas — as telas não precisam mudar.

export const STATUS = {
  complete: {
    label: "Completo",
    color: "var(--success)",
    bg: "hsl(160 70% 50% / 0.12)",
    border: "hsl(160 70% 50% / 0.3)",
    weight: 1,
  },
  needs_revision: {
    label: "Precisa de revisão",
    suffix: "*",
    color: "var(--warning)",
    bg: "hsl(38 95% 60% / 0.12)",
    border: "hsl(38 95% 60% / 0.3)",
    weight: 0.5,
  },
  incomplete: {
    label: "Incompleto",
    color: "var(--text-muted)",
    bg: "hsl(220 8% 50% / 0.12)",
    border: "hsl(220 8% 50% / 0.3)",
    weight: 0,
  },
};

export const MOCK_CONFERENCE = {
  id: "diplomun-2026",
  nome: "DiploMUN 2026",
  committees: [
    {
      id: "disec",
      sigla: "DISEC",
      nomeCompleto: "Comitê de Desarmamento e Segurança Internacional",
      descricao:
        "Primeira comissão da Assembleia Geral. Debate ameaças à paz, regimes de desarmamento e o controle de tecnologias militares emergentes.",
      topics: [
        {
          id: "disec-t1",
          ordem: 1,
          titulo: "Tópico 1 — Regulação de sistemas de armas autônomas letais",
          subitems: [
            { id: "disec-1-1", label: "1.1", status: "complete" },
            { id: "disec-1-2", label: "1.2", status: "complete" },
            { id: "disec-1-3", label: "1.3", status: "needs_revision" },
          ],
        },
        {
          id: "disec-t2",
          ordem: 2,
          titulo: "Tópico 2 — Desmilitarização do espaço sideral",
          subitems: [
            { id: "disec-2-1", label: "2.1", status: "needs_revision" },
            { id: "disec-2-2", label: "2.2", status: "incomplete" },
            { id: "disec-2-3", label: "2.3", status: "incomplete" },
          ],
        },
      ],
      documents: [
        {
          id: "disec-d1",
          titulo: "WP 1.1 — Definições operativas e escopo de autonomia",
          subitemId: "disec-1-1",
          autor: "Delegação da Suíça",
        },
        {
          id: "disec-d2",
          titulo: "WP 1.2 — Mecanismo de verificação sob a CCW",
          subitemId: "disec-1-3",
          autor: "Delegação do Brasil",
        },
        {
          id: "disec-d3",
          titulo: "WP 2.1 — Moratória de testes ASAT destrutivos",
          subitemId: "disec-2-1",
          autor: "Delegação do Japão",
        },
      ],
    },
    {
      id: "cdh",
      sigla: "CDH",
      nomeCompleto: "Conselho de Direitos Humanos",
      descricao:
        "Fórum responsável pela promoção e proteção dos direitos humanos. Examina violações e recomenda respostas à comunidade internacional.",
      topics: [
        {
          id: "cdh-t1",
          ordem: 1,
          titulo: "Tópico 1 — Direitos digitais e vigilância estatal",
          subitems: [
            { id: "cdh-1-1", label: "1.1", status: "complete" },
            { id: "cdh-1-2", label: "1.2", status: "complete" },
            { id: "cdh-1-3", label: "1.3", status: "complete" },
            { id: "cdh-1-4", label: "1.4", status: "needs_revision" },
          ],
        },
      ],
      documents: [
        {
          id: "cdh-d1",
          titulo: "WP 1.1 — Salvaguardas judiciais para interceptação de dados",
          subitemId: "cdh-1-4",
          autor: "Delegação da Estônia",
        },
      ],
    },
    {
      id: "csnu",
      sigla: "CSNU",
      nomeCompleto: "Conselho de Segurança das Nações Unidas",
      descricao:
        "Órgão com mandato de manter a paz e a segurança internacionais. Crises em tempo real, vetos e resoluções vinculantes.",
      topics: [
        {
          id: "csnu-t1",
          ordem: 1,
          titulo: "Tópico 1 — A situação no Sahel e missões de paz híbridas",
          subitems: [
            { id: "csnu-1-1", label: "1.1", status: "needs_revision" },
            { id: "csnu-1-2", label: "1.2", status: "incomplete" },
            { id: "csnu-1-3", label: "1.3", status: "incomplete" },
            { id: "csnu-1-4", label: "1.4", status: "incomplete" },
          ],
        },
      ],
      documents: [
        {
          id: "csnu-d1",
          titulo: "WP 1.1 — Mandato de transição para a força regional",
          subitemId: "csnu-1-1",
          autor: "Delegação da França",
        },
      ],
    },
  ],
};

// ── Acesso aos dados (trocar por Firestore depois) ────────────────────────────

export function getConference(conferenceId) {
  return MOCK_CONFERENCE.id === conferenceId ? MOCK_CONFERENCE : null;
}

export function getCommittee(conferenceId, committeeId) {
  const conf = getConference(conferenceId);
  return conf?.committees.find((c) => c.id === committeeId) ?? null;
}

// ── Progresso ─────────────────────────────────────────────────────────────────
// progresso = (complete × 1 + needs_revision × 0.5) / total de subitems

export function computeProgress(committee) {
  const subitems = committee.topics.flatMap((t) => t.subitems);
  if (subitems.length === 0) return { ratio: 0, counts: {}, total: 0 };

  const counts = { complete: 0, needs_revision: 0, incomplete: 0 };
  let score = 0;
  for (const s of subitems) {
    counts[s.status] += 1;
    score += STATUS[s.status].weight;
  }
  return { ratio: score / subitems.length, counts, total: subitems.length };
}
