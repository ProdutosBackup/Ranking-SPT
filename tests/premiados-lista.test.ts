import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { auditar } from "../lib/auditoria";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { lerPlanilha, type DadosPlanilha } from "../lib/planilha";
import { comBounty } from "./bounty-mock";
import { chaveTorneio, PREMIADOS_ETAPA3, premiadosDaLista } from "../lib/premiados-etapa3";
import { REGRAS_PADRAO } from "../lib/regras";
import { chaveNomeV, premiadosListaV, verificar } from "../lib/verificador";

const ARQUIVO = readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx");
const FLIGHTS = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: "ABCDE"[i], status: "FINISHED" }));

// A lista do responsável [CONFIRMADO 05/11/2026, compêndio 6.5], escrita aqui de forma independente da tabela.
const LISTA: Record<string, number> = {
  "Main Event SPT - Dia Final": 64,
  "200K OMAHA 5 K.O": 11,
  HORSE: 3,
  "SUPER K.O": 6,
  "8 GAME": 4,
  "100K OMAHA MYSTERY BOUNTY": 8,
  "CHAMPIONSHIP HIGH ROLLER 200K": 10,
  "PLO-NLH DEALER´S CHOICE PIJAMA": 4,
  "SECOND CHANCE": 20,
  "HIGH ROLLER 50K": 9,
  "OMAHA DEALER´S CHOICE": 7,
};

describe("tabela de premiados da Etapa 3", () => {
  it("confere com a lista do responsável", () => {
    expect(Object.fromEntries(PREMIADOS_ETAPA3.map((x) => [x.aba, x.premiados]))).toEqual(LISTA);
    expect(PREMIADOS_ETAPA3).toHaveLength(11);
  });

  it("nomes: ignora maiúsculas, acentos, hífen, barra e o apóstrofo ´ (motor e verificador concordam)", () => {
    const variantes: [string, number][] = [
      ["PLO/NLH DEALER´S CHOICE PIJAMA", 4], // como a API escreve
      ["plo-nlh dealer's choice pijama", 4],
      ["Plo–Nlh Dealer’s Choice Pijama", 4],
      ["Main Event SPT — Dia Final", 64], // travessão da API
      ["main event spt - dia final", 64],
      ["  horse ", 3],
      ["200k omaha 5 k.o", 11],
      ["Championship High Roller 200K", 10],
    ];
    for (const [nome, n] of variantes) {
      expect(premiadosDaLista(nome), nome).toBe(n);
      expect(premiadosListaV(nome), nome).toBe(n);
    }
    for (const nome of [...PREMIADOS_ETAPA3.map((x) => x.aba), ...variantes.map((v) => v[0]), "Ladies", "HORSE 2", "Satélite PLO 200K", "ÓMAHÂ ´`'’ -/ x"])
      expect(chaveNomeV(nome)).toBe(chaveTorneio(nome));
    expect(premiadosDaLista("TORNEIO NOVO")).toBeNull();
    expect(premiadosListaV("TORNEIO NOVO")).toBeNull();
  });
});

describe("Etapa 3: nº de premiados vem da lista, não dos pontos", () => {
  let base: DadosPlanilha;
  beforeAll(async () => {
    const r = await lerPlanilha(new Uint8Array(ARQUIVO), { stage: "bendito-cacao-2026", arquivo: "ranking-spt-3a-etapa.xlsx", enviadoEm: new Date("2026-10-21T12:00:00Z") });
    if (!r.ok) throw new Error(r.erros.join(" | "));
    base = comBounty({ ...r.dados, torneios: [...r.dados.torneios, ...FLIGHTS] });
  });
  const rodar = (d: DadosPlanilha) => {
    const aud = auditar(d, REGRAS_PADRAO);
    expect(() => conferir(d, REGRAS_PADRAO, aud)).not.toThrow(); // o verificador independente concorda em todas as linhas
    expect(verificar(d, REGRAS_PADRAO, aud.linhas as never, aud.torneios as never)).toEqual([]);
    return aud;
  };

  it("lista completa: nenhum torneio fica pendente e o nº de premiados é o da lista", () => {
    const aud = rodar(base);
    expect((aud.resumo as Record<string, number>).PENDENTE_REGRA).toBe(0);
    expect((aud.resumo as Record<string, number>).SUSPEITO).toBe(0); // sem prêmio na planilha não há "posição e prêmio não concordam"
    expect(aud.linhas.some((l) => l.pendencia === "SEM_PREMIADOS")).toBe(false);
    for (const t of aud.torneios.filter((x) => x.total > 0)) expect(t.premiados, t.torneio).toBe(LISTA[t.torneio]);
  });

  it("HORSE, 4º colocado que a planilha pagou: vale 10 × fatores, com a divergência apontada", () => {
    const l = rodar(base).linhas.find((x) => x.torneio === "HORSE" && x.posicao === 4)!;
    expect(l.premiados).toBe(3);
    expect([l.itm, l.base, l.situacao]).toEqual([false, 10, "ERRO"]);
    expect(l.esperadoCent).toBe(Math.round(10 * l.fatorParticipantes * l.fatorBuyIn * 100));
    expect(l.registrado).toBeGreaterThan(l.esperado); // a planilha pagou como 4º colocado
    expect(l.causaCodigo).toBe("PREMIADOS_LISTA");
    expect(l.causaProvavel).toBe("premiados informados: 3; a planilha pagou 4");
  });

  it("200K OMAHA 5 K.O, 11º colocado: base 250 × fatores, contra os 10 que a planilha pagou", () => {
    const l = rodar(base).linhas.find((x) => x.torneio === "200K OMAHA 5 K.O" && x.posicao === 11)!;
    expect(l.premiados).toBe(11);
    expect([l.itm, l.base, l.situacao, l.registrado]).toEqual([true, 250, "ERRO", 10]);
    expect(l.esperadoCent).toBe(Math.round(250 * l.fatorParticipantes * l.fatorBuyIn * 100));
    expect(l.causaProvavel).toBe("premiados informados: 11; a planilha pagou 10");
    // o 10º e o 12º não são afetados pela divergência
    const aud = rodar(base);
    const m = aud.torneios.find((t) => t.torneio === "200K OMAHA 5 K.O")!;
    expect([m.premiados, m.premiadosPagos]).toEqual([11, 10]);
    expect(aud.linhas.find((x) => x.torneio === "200K OMAHA 5 K.O" && x.posicao === 10)!.causaCodigo).not.toBe("PREMIADOS_LISTA");
  });

  it("só HORSE e 200K OMAHA 5 K.O divergem da lista; nos demais a planilha pagou o mesmo nº de premiados", () => {
    const dif = rodar(base).torneios.filter((t) => t.total > 0 && t.premiadosPagos !== t.premiados).map((t) => [t.torneio, t.premiados, t.premiadosPagos]);
    expect(dif.sort()).toEqual([
      ["200K OMAHA 5 K.O", 11, 10],
      ["HORSE", 3, 4],
    ]);
  });

  it("Championship: posições até 110 com 65 linhas é anomalia dos dados e não muda o nº de premiados (10)", () => {
    const aud = rodar(base);
    const ls = aud.linhas.filter((l) => l.torneio === "CHAMPIONSHIP HIGH ROLLER 200K");
    expect([ls.length, Math.max(...ls.map((l) => l.posicao ?? 0)), ls[0].premiados]).toEqual([65, 110, 10]);
    expect(ls.every((l) => l.causaCodigo !== "PREMIADOS_LISTA")).toBe(true);
  });

  it("torneio fora da tabela: as linhas aguardam, com o motivo, e o verificador concorda", () => {
    const d: DadosPlanilha = { ...base, torneios: base.torneios.map((t) => (t.name === "HORSE" ? { ...t, name: "HORSE NOVO" } : t)) };
    const aud = rodar(d);
    const ls = aud.linhas.filter((l) => l.torneio === "HORSE NOVO");
    expect(ls).toHaveLength(19);
    expect(ls.every((l) => l.situacao === "PENDENTE_REGRA" && l.pendencia === "SEM_PREMIADOS" && l.causaProvavel === "nº de premiados não informado")).toBe(true);
    expect(aud.linhas.filter((l) => l.torneio !== "HORSE NOVO").some((l) => l.situacao === "PENDENTE_REGRA")).toBe(false);
    const r = montarResposta("bendito-cacao-2026", d, REGRAS_PADRAO, aud, identificador(d));
    expect(r.painel.aguardando.map((a) => a.texto)).toEqual(["19 resultados de HORSE NOVO: nº de premiados não informado"]);
    expect(r.painel.avisos).toContain("Há torneios sem nº de premiados informado.");
  });

  it("torneio que não pontua e flights não precisam estar na lista", () => {
    const d: DadosPlanilha = { ...base, torneios: base.torneios.map((t) => (t.name === "HORSE" ? { ...t, name: "Ladies" } : t)) };
    const aud = rodar(d);
    expect(aud.linhas.filter((l) => l.torneio === "Ladies").every((l) => l.pendencia == null && l.naoPontua === "Ladies")).toBe(true);
  });

  it("a posição deixa de depender dos pontos: o prêmio fica nulo e o resultado da planilha não muda o nº de premiados", () => {
    // pontos de todos os do HORSE trocados por 10: o nº de premiados continua 3
    const idHorse = base.torneios.find((t) => t.name === "HORSE")!.id;
    const d: DadosPlanilha = {
      ...base,
      jogadores: base.jogadores.map((j) => ({ ...j, resultados: j.resultados.map((r) => (r.tournamentId === idHorse ? { ...r, points: 10 } : r)) })),
    };
    const aud = auditar(d, REGRAS_PADRAO);
    expect(aud.torneios.find((t) => t.torneio === "HORSE")!.premiados).toBe(3);
  });
});
