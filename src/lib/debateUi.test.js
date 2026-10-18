import { describe, expect, it } from "vitest";
import { findCommitteeById } from "../data/munCommittees";
import { blocDebateSetup, isBlocCommittee, opposingBloc } from "./debateUi";

const tpi = findCommitteeById("TPI");
const [acusacao, defesa] = tpi.blocs;

describe("comitês de blocos", () => {
  it("TPI é comitê de blocos; os demais não", () => {
    expect(isBlocCommittee(tpi)).toBe(true);
    expect(isBlocCommittee(findCommitteeById("UNSC"))).toBe(false);
  });

  it("o oponente fica sempre com o bloco oposto", () => {
    expect(opposingBloc(tpi, acusacao)).toEqual(defesa);
    expect(opposingBloc(tpi, defesa)).toEqual(acusacao);
  });

  it("monta o setup do debateTurn com os dois blocos", () => {
    const setup = blocDebateSetup({
      committee: tpi,
      userBloc: defesa,
      topic: tpi.topics[1],
      difficulty: "advanced",
      nivelDelegado: "Não informado",
      simsAnteriores: null,
    });
    expect(setup).toEqual({
      committeeName: "TPI: O Julgamento de Benjamin Netanyahu",
      topic: "Fome como método de guerra",
      userCountry: { code2: "DEF", name: "Bloco da Defesa" },
      aiDelegation: { code2: "ACUS", name: "Bloco da Acusação" },
      difficulty: "advanced",
      nivelDelegado: "Não informado",
      simsAnteriores: null,
    });
  });
});
