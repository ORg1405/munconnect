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
];

export function findCommitteeById(id) {
  return MUN_COMMITTEES.find((c) => c.id === id);
}
