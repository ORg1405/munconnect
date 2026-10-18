// Common MUN committees with realistic sample topics.
export const MUN_COMMITTEES = [
  {
    id: "UNSC",
    name: "UN Security Council",
    short: "UNSC",
    topics: [
      "The situation in the Sahel",
      "Peacekeeping mandates in the DRC",
      "Maritime security in the Red Sea",
      "Nuclear non-proliferation on the Korean Peninsula",
    ],
  },
  {
    id: "UNGA",
    name: "UN General Assembly",
    short: "UNGA",
    topics: [
      "Reform of the Security Council",
      "Right to development and global inequality",
      "Use of veto power and accountability",
    ],
  },
  {
    id: "HRC",
    name: "Human Rights Council",
    short: "HRC",
    topics: [
      "Freedom of expression in the digital era",
      "Rights of indigenous peoples",
      "Universal Periodic Review reform",
    ],
  },
  {
    id: "ECOSOC",
    name: "Economic and Social Council",
    short: "ECOSOC",
    topics: [
      "Sovereign debt restructuring",
      "Just transition and labor rights",
      "Financing for climate adaptation",
    ],
  },
  {
    id: "DISEC",
    name: "Disarmament and International Security",
    short: "DISEC",
    topics: [
      "Lethal autonomous weapons systems",
      "Cybersecurity and state-sponsored attacks",
      "Small arms trade in conflict zones",
    ],
  },
  {
    id: "UNHCR",
    name: "UN High Commissioner for Refugees",
    short: "UNHCR",
    topics: [
      "Climate refugees and legal status",
      "Protection in protracted refugee situations",
      "Return and reintegration in post-conflict states",
    ],
  },
  {
    // PLACEHOLDER: tópico e dossiê reais ainda não definidos. O dossiê usado
    // pelo backend de IA fica em functions/src/dossiers/SOLIDARNOSC.md.
    id: "SOLIDARNOSC",
    name: "Solidarność (PLACEHOLDER)",
    short: "SOLIDARNOSC",
    topics: ["PLACEHOLDER — tópico a definir"],
  },
  {
    // SISTA III. Comitê de julgamento: dois blocos opostos em vez de países.
    // Os topics são os temas dos ciclos da Instrução. Dossiê e prompts do
    // backend de IA: functions/src/dossiers/TPI.md e functions/src/prompts/tpi.ts.
    id: "TPI",
    name: "TPI: O Julgamento de Benjamin Netanyahu",
    short: "TPI",
    conference: "SISTA III",
    topics: [
      "Competência do TPI",
      "Fome como método de guerra",
      "Ataques a civis e condução das hostilidades",
    ],
    blocs: [
      { code2: "ACUS", name: "Bloco da Acusação" },
      { code2: "DEF", name: "Bloco da Defesa" },
    ],
  },
];

export function findCommitteeById(id) {
  return MUN_COMMITTEES.find((c) => c.id === id);
}
