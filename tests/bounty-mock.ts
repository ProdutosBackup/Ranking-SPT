import type { DadosSpt, Torneio } from "../lib/api-spt";

/** Os torneios com bounty da Etapa 3 como a API os informa (05/11/2026): buy-in base + bounty. Sem rede nos testes. */
export const BOUNTY_API: Torneio[] = [
  { id: "api-ko", name: "200K OMAHA 5 K.O", buyIn: 2000, players: 30, role: "STANDALONE", flightLabel: null, status: "FINISHED", bountyType: "KO", bountyAmount: 1000 },
  { id: "api-sko", name: "SUPER K.O", buyIn: 500, players: 34, role: "STANDALONE", flightLabel: null, status: "FINISHED", bountyType: "KO", bountyAmount: 500 },
  { id: "api-mys", name: "100K OMAHA MYSTERY BOUNTY", buyIn: 1500, players: 25, role: "STANDALONE", flightLabel: null, status: "FINISHED", bountyType: "MYSTERY", bountyAmount: 1000 },
];

/** Aplica o bounty da API aos torneios da planilha (o que dadosDaPlanilha faz), para os testes que leem a planilha direto. */
export function comBounty<T extends DadosSpt>(d: T): T {
  return {
    ...d,
    torneios: d.torneios.map((t) => {
      const a = BOUNTY_API.find((x) => x.name === t.name);
      return a ? { ...t, bountyType: a.bountyType, bountyAmount: a.bountyAmount } : t;
    }),
  };
}
