import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { calcularCenario } from "../lib/calculo";
import { consolidar, type EtapaConsolidado, type LinhaConsolidado } from "../lib/consolidado";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { dadosDaPlanilha } from "../lib/planilha-guardada";
import { CAMPO_CENARIO, CENARIOS, FATOR_FAIXA_CENARIO, MOTIVO_MAIN_EVENT_ETAPA1, MOTIVO_SEM_ACOES, MOTIVO_SEM_PARTICIPANTES, REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";
import { BOUNTY_API } from "./bounty-mock";


/** Linha do Main Event (flight ou Dia Final), pelo papel ou, na Etapa 1, pelo nome. */
const ehMainEvent = (l: { role: string; torneio: string }) => l.role === "FLIGHT" || l.role === "FINAL" || (l.role === "STANDALONE" && /dia 1|^final main event/i.test(l.torneio));

const E1 = "taua-2026";
const E2 = "vale-suico-2026";
const E3 = "bendito-cacao-2026";
const FLIGHTS = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: `1${"ABCDE"[i]}`, status: "FINISHED" }));

async function dados(stage: string): Promise<DadosSpt> {
  if (stage === E3) {
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ tournaments: [...FLIGHTS, ...BOUNTY_API] }) }));
    const registro = { arquivo: "ranking-spt-3a-etapa.xlsx", enviadoEm: "2026-11-05T00:00:00Z", tamanho: 1, sha256: "x", inscritosDiaFinal: null, resumo: {}, avisos: [] };
    return dadosDaPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), registro as never);
  }
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const body = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => body };
  });
  return buscarDados(stage);
}
afterEach(() => vi.unstubAllGlobals());

type Aud = ReturnType<typeof auditar>;
const auditados: Record<string, { d: DadosSpt; aud: Aud }> = {};
beforeAll(async () => {
  for (const s of [E1, E2, E3]) {
    const d = await dados(s);
    const aud = auditar(d, REGRAS_PADRAO);
    conferir(d, REGRAS_PADRAO, aud); // o verificador independente concorda com o motor, inclusive nos 4 cenários
    auditados[s] = { d, aud };
  }
});
const linha = (s: string, torneio: string, posicao: number | null, jogador?: string) =>
  auditados[s].aud.linhas.find((l) => l.torneio === torneio && l.posicao === posicao && (!jogador || l.jogador === jogador))!;

describe("os 4 cenários: definição", () => {
  it("A = só entradas, faixa 1,0; B = entradas, 0,9; C = ações, 1,0; D = ações, 0,9", () => {
    expect(CENARIOS).toEqual(["A", "B", "C", "D"]);
    expect(FATOR_FAIXA_CENARIO).toEqual({ A: 1, B: 0.9, C: 1, D: 0.9 });
    expect(CAMPO_CENARIO).toEqual({ A: "entradas", B: "entradas", C: "acoes", D: "acoes" });
    expect(REGRAS_PADRAO.fatorFaixaAte1000).toBe(1); // o 0,9 é cenário, não padrão
  });
  it("calcularCenario: só mudam o campo e o fator da faixa; acima de R$ 1.000 o fator da faixa não pesa", () => {
    const e = { posicao: 1, prize: 1, buyIn: 500, field: 100, premiados: 10 };
    const normal = { zero: false, semPosicao: false, acordo: null };
    expect(calcularCenario(e, REGRAS_PADRAO, normal, 100, 1)).toBe(150000); // 1000 × 1,5 × 1,0 = 1.500
    expect(calcularCenario(e, REGRAS_PADRAO, normal, 100, 0.9)).toBe(135000);
    expect(calcularCenario({ ...e, buyIn: 2000 }, REGRAS_PADRAO, normal, 100, 0.9)).toBe(calcularCenario({ ...e, buyIn: 2000 }, REGRAS_PADRAO, normal, 100, 1));
    expect(calcularCenario(e, REGRAS_PADRAO, { zero: true, semPosicao: false, acordo: null }, 100, 0.9)).toBe(0);
    expect(calcularCenario(e, REGRAS_PADRAO, { zero: false, semPosicao: true, acordo: null }, 100, 1)).toBe(1500); // 10 × 1,5 = 15
    expect(calcularCenario(e, REGRAS_PADRAO, { zero: false, semPosicao: false, acordo: 4 }, 100, 1)).toBe(90000); // base do 4º: 600 × 1,5
  });
});

describe("consistência: o cenário A é o esperado que a auditoria já calcula", () => {
  for (const [s, nome] of [[E1, "Etapa 1"], [E2, "Etapa 2"], [E3, "Etapa 3"]] as const)
    it(`${nome}: em todas as linhas, A = esperado (centésimos)`, () => {
      const { aud } = auditados[s];
      expect(aud.linhas.length).toBeGreaterThan(200);
      expect(aud.linhas.filter((l) => l.cenarios.A !== l.esperadoCent)).toEqual([]);
      expect(aud.linhas.every((l) => Number.isInteger(l.cenarios.A) && Number.isInteger(l.cenarios.B))).toBe(true);
    });

  it("motor e verificador concordam nos 4 cenários em todas as linhas (e o verificador pega um motor errado)", () => {
    for (const s of [E1, E2, E3]) {
      const { d, aud } = auditados[s];
      expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
    }
    const { d, aud } = auditados[E3];
    for (const k of CENARIOS) {
      const errado = aud.linhas.map((l, i) => (i === 7 && l.cenarios[k] != null ? { ...l, cenarios: { ...l.cenarios, [k]: l.cenarios[k]! + 1 } } : l));
      const alvo = errado.some((l, i) => l !== aud.linhas[i]);
      if (alvo) expect(verificar(d, REGRAS_PADRAO, errado, aud.torneios).map((x) => x.campo)).toEqual([`cenario${k}`]);
    }
  });
});

describe("cenário B: fator 0,9 só na faixa de buy-in total até R$ 1.000", () => {
  it("Main Event (Dia Final, buy-in R$ 0) da Etapa 2, sem acordo: 1º = 1000 × 3,81 × 1,0 = 3.810 e 1000 × 3,81 × 0,9 = 3.429", () => {
    const l = linha(E2, "Main Event SPT — Dia Final", 1);
    expect([l.buyIn, l.field, l.base, l.cenarios.A, l.cenarios.B]).toEqual([0, 331, 1000, 381000, 342900]);
  });
  it("Main Event da Etapa 2 com o acordo K=4 marcado: 600 × 3,81 × 1,0 = 2.286 e 600 × 3,81 × 0,9 = 2.057,40", () => {
    const { d } = auditados[E2];
    const final = d.torneios.find((t) => t.role === "FINAL")!;
    const l = auditar(d, REGRAS_PADRAO, { [final.id]: 4 }).linhas.find((x) => x.torneioId === final.id && x.posicao === 1)!;
    expect([l.base, l.acordo, l.cenarios.A, l.cenarios.B]).toEqual([600, 4, 228600, 205740]);
  });
  it("EV #3 30K SUPER K.O da Etapa 2 (buy-in 500 + bounty 500 = R$ 1.000): 1000 × 0,94 × 1,0 = 940 e × 0,9 = 846", () => {
    const l = linha(E2, "EV #3 30K SUPER K.O", 1);
    expect([l.buyInFator, l.cenarios.A, l.cenarios.B]).toEqual([1000, 94000, 84600]);
  });
  it("HORSE da Etapa 3 (buy-in R$ 800): 1000 × 0,69 × 1,0 = 690 e × 0,9 = 621", () => {
    const l = linha(E3, "HORSE", 1);
    expect([l.buyIn, l.field, l.cenarios.A, l.cenarios.B]).toEqual([800, 19, 69000, 62100]);
  });
  it("torneio de R$ 2.000 não muda (200K OMAHA 5 K.O da Etapa 2: total 3.000, fator 2,5): 1º = 1000 × 0,84 × 2,5 = 2.100 nos dois", () => {
    const l = linha(E2, "EV #2 200K PLO 5 K.O", 1);
    expect([l.buyInFator, l.cenarios.A, l.cenarios.B]).toEqual([3000, 210000, 210000]);
  });
  it("o resto da regra é o mesmo em todos os cenários: acordo (4º colocado), fora da premiação (10 × fatores) e torneio que não pontua", () => {
    const final = auditados[E2].d.torneios.find((t) => t.role === "FINAL")!;
    const acordo = auditar(auditados[E2].d, REGRAS_PADRAO, { [final.id]: 4 }).linhas.find((x) => x.torneioId === final.id && x.posicao === 3)!; // acordo marcado na mão: K=4
    expect(acordo.acordo).toBe(4);
    expect(acordo.cenarios.B).toBe(Math.round(600 * 3.81 * 0.9 * 100)); // base do 4º × fatores, com 0,9
    const fora = linha(E2, "Main Event SPT — Dia Final", 64);
    expect([fora.base, fora.cenarios.A, fora.cenarios.B]).toEqual([10, 3810, 3429]); // 10 × 3,81 × 1,0 e × 0,9
    const sat = auditados[E1].aud.linhas.filter((l) => l.naoPontua != null);
    for (const l of sat) expect(CENARIOS.map((k) => l.cenarios[k])).toEqual([0, 0, 0, 0]);
  });
});

describe("cenários C e D: total de ações (entradas + reentradas)", () => {
  it("100K OMAHA MYSTERY BOUNTY da Etapa 3: 25 entradas + 43 reentradas = 68 ações, fator de participantes 1,18", () => {
    const l = linha(E3, "100K OMAHA MYSTERY BOUNTY", 1);
    expect([l.field, l.acoesCampo, l.buyInFator, l.fatorBuyIn]).toEqual([25, 68, 2500, 1.5]);
    expect(l.cenarios).toEqual({ A: 112500, B: 112500, C: 177000, D: 177000 }); // 1000 × 1,18 × 1,5 = 1.770 (a faixa de 2.500 não é a de até R$ 1.000)
    expect(l.cenariosMotivo).toBeNull();
  });
  it("HORSE da Etapa 3: 19 entradas + 4 reentradas = 23 ações (fator 0,73): 1000 × 0,73 × 1,0 = 730 e × 0,9 = 657", () => {
    const l = linha(E3, "HORSE", 1);
    expect([l.acoesCampo, l.cenarios.C, l.cenarios.D, l.cenariosMotivo]).toEqual([23, 73000, 65700, null]);
  });
  it("Dia Final e flights da Etapa 3 e todas as linhas das Etapas 1 e 2: C e D são null, com o motivo escrito (o do Main Event é outro)", () => {
    const final = auditados[E3].aud.linhas.filter((l) => l.torneio.includes("Dia Final"));
    expect(final.length).toBe(214);
    // Etapa 3 sem a planilha de participantes: o que falta nas linhas do Main Event é essa planilha, não o Excel da etapa.
    expect(final.every((l) => l.cenarios.C == null && l.cenarios.D == null && l.cenariosMotivo === MOTIVO_SEM_PARTICIPANTES && l.acoesCampo == null)).toBe(true);
    expect(MOTIVO_SEM_ACOES).toBe("reentradas não disponíveis: falta o Excel da etapa");
    expect(MOTIVO_SEM_PARTICIPANTES).toBe("reentradas não disponíveis: falta a planilha de participantes do Main Event");
    expect(MOTIVO_MAIN_EVENT_ETAPA1).toBe("dado ausente: a Etapa 1 foi operada fora do Stack Plus e não traz as reentradas do Main Event");
    // Etapas 1 e 2: linhas do Main Event com o motivo do Main Event da etapa; as demais, o texto antigo.
    for (const [s, textoMain] of [[E1, MOTIVO_MAIN_EVENT_ETAPA1], [E2, MOTIVO_SEM_PARTICIPANTES]] as const) {
      const ls = auditados[s].aud.linhas.filter((l) => l.naoPontua == null && !l.causaCodigo?.startsWith("FLIGHT_ZERO"));
      expect(ls.every((l) => l.cenarios.C == null && l.cenarios.D == null && l.cenariosMotivo === (ehMainEvent(l) ? textoMain : MOTIVO_SEM_ACOES))).toBe(true);
      expect(ls.some(ehMainEvent) && ls.some((l) => !ehMainEvent(l))).toBe(true);
    }
  });
  it("contagem das linhas null em C e D por etapa", () => {
    const nulas = (s: string) => ({ C: auditados[s].aud.linhas.filter((l) => l.cenarios.C == null).length, D: auditados[s].aud.linhas.filter((l) => l.cenarios.D == null).length, total: auditados[s].aud.linhas.length });
    expect(nulas(E1)).toEqual({ C: 598, D: 598, total: 642 }); // 2.7: as 51 linhas do Dia Final de quem jogou flight deixaram de valer 0 e não têm ações
    expect(nulas(E2)).toEqual({ C: 270, D: 270, total: 270 });
    expect(nulas(E3)).toEqual({ C: 214, D: 214, total: 554 });
    // A e B nunca são null
    for (const s of [E1, E2, E3]) expect(auditados[s].aud.linhas.every((l) => l.cenarios.A != null && l.cenarios.B != null)).toBe(true);
  });
  it("linha que vale 0 sem depender do campo (flight de quem já pontua) não é null em C e D", () => {
    const zeros = auditados[E1].aud.linhas.filter((l) => l.causaCodigo === "FLIGHT_ZERO" && l.esperadoCent === 0);
    expect(zeros.length).toBeGreaterThan(0);
    expect(zeros.every((l) => CENARIOS.every((k) => l.cenarios[k] === 0))).toBe(true);
  });
  it("torneio cancelado pelo usuário vale 0 nos 4 cenários, mesmo sem reentradas", () => {
    const { d } = auditados[E2];
    const t = d.torneios.find((x) => x.name.startsWith("EV #2"))!;
    const aud = auditar(d, REGRAS_PADRAO, {}, [t.id]);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios, {}, [t.id])).toEqual([]);
    expect(aud.linhas.filter((l) => l.torneioId === t.id).every((l) => CENARIOS.every((k) => l.cenarios[k] === 0))).toBe(true);
  });
});

describe("a resposta da auditoria traz os campos novos, uma vez por linha", () => {
  it("cenarios (centésimos), cenariosMotivo e acoesCampo na linha da resposta", () => {
    const { d, aud } = auditados[E3];
    const r = montarResposta(E3, d, REGRAS_PADRAO, aud, identificador(d));
    const l = r.linhas.find((x) => x.torneio === "100K OMAHA MYSTERY BOUNTY" && x.posicao === 1)!;
    expect(l.cenarios).toEqual({ A: 112500, B: 112500, C: 177000, D: 177000 });
    expect([l.cenariosMotivo, l.acoesCampo]).toEqual([null, 68]);
    const f = r.linhas.find((x) => x.torneio.includes("Dia Final"))!;
    expect(f.cenarios.C).toBeNull();
    expect(f.cenariosMotivo).toBe(MOTIVO_SEM_PARTICIPANTES); // linha do Main Event na Etapa 3 sem a planilha de participantes
  });
});

describe("consolidado: totais por cenário, por etapa e acumulado", () => {
  const linhasDe = (s: string): LinhaConsolidado[] =>
    auditados[s].aud.linhas.map((l) => ({
      jogador: l.jogador, posicao: l.posicao, esperadoCent: l.esperadoCent, aguarda: l.situacao === "PENDENTE_REGRA", participacao: l.participacao, acordo: l.acordo != null,
      registradoCent: l.registradoCent, cenarios: l.cenarios, cenariosMotivo: l.cenariosMotivo,
    }));
  const etapa = (numero: number, s: string): EtapaConsolidado => ({ numero, jogadores: auditados[s].d.jogadores.map((j) => ({ nome: j.name, id: j.id })), linhas: linhasDe(s) });

  it("A é o total atual; B nunca é null; C e D dependem das reentradas", () => {
    const c = consolidar([etapa(1, E1), etapa(2, E2), etapa(3, E3)]);
    for (const j of c.jogadores) {
      expect(j.cenarios.A.totalCent).toBe(j.totalCent);
      expect(j.cenarios.A.insuficiente || j.cenarios.B.insuficiente).toBe(false);
      expect(j.cenarios.B.totalCent).not.toBeNull();
    }
    // quem jogou as Etapas 1 e 2 tem C e D insuficientes, com os motivos por etapa
    const comE1 = c.jogadores.filter((j) => j.porEtapa[0] != null);
    expect(comE1.length).toBeGreaterThan(100);
    for (const j of comE1) {
      const d = j.cenarios.D;
      expect([d.totalCent, d.insuficiente]).toEqual([null, true]);
      // Etapa 1: linhas comuns com o texto antigo e linhas do Main Event com o texto da Etapa 1; Etapa 2: o texto antigo e o da planilha de participantes.
      expect(d.motivos.every((m) => (m.etapa === 1 ? [MOTIVO_SEM_ACOES, MOTIVO_MAIN_EVENT_ETAPA1] : [MOTIVO_SEM_ACOES, MOTIVO_SEM_PARTICIPANTES]).includes(m.motivo))).toBe(true);
      expect(d.motivos.map((m) => m.etapa)).toContain(1);
      expect(d.porEtapa[0]).toMatchObject({ cent: null, insuficiente: true });
      expect(d.posicao).toBeNull();
    }
  });

  it("só a Etapa 3: quem jogou torneio com reentradas tem C e D; quem jogou o Dia Final fica com dados insuficientes e o motivo", () => {
    const c = consolidar([etapa(1, E3)]);
    const finalistas = new Set(auditados[E3].aud.linhas.filter((l) => l.torneio.includes("Dia Final")).map((l) => l.jogador));
    const comTotal = c.jogadores.filter((j) => j.cenarios.C.totalCent != null);
    const semTotal = c.jogadores.filter((j) => j.cenarios.C.insuficiente);
    expect(comTotal.length + semTotal.length).toBe(c.jogadores.length);
    expect(comTotal.length).toBeGreaterThan(0);
    for (const j of semTotal) {
      expect(finalistas.has(j.nome)).toBe(true);
      // quem tem dados insuficientes aqui só tem linhas do Dia Final nulas: o motivo é o da planilha de participantes
      expect(j.cenarios.C.motivos).toEqual([{ etapa: 1, motivo: MOTIVO_SEM_PARTICIPANTES, linhas: expect.any(Number) }]);
      expect(j.cenarios.C.parcialCent).toBeGreaterThanOrEqual(0);
    }
    for (const j of comTotal) expect(finalistas.has(j.nome)).toBe(false);
    // a posição de C só existe entre os que têm total; o desempate é o mesmo critério (primeiros lugares) em todos os cenários
    const pos = comTotal.map((j) => j.cenarios.C.posicao);
    expect(pos.every((p) => p != null)).toBe(true);
    expect(Math.min(...(pos as number[]))).toBe(1);
  });

  it('"ranking como estava": os pontos publicados, por etapa e acumulado (Etapa 3: os registrados na planilha)', () => {
    const c = consolidar([etapa(1, E1), etapa(2, E2), etapa(3, E3)]);
    const publicado = (s: string) => {
      const m = new Map<string, number>();
      for (const j of auditados[s].d.jogadores) m.set(j.name, Math.round(j.rankingPoints * 100));
      return m;
    };
    const [p1, p2, p3] = [publicado(E1), publicado(E2), publicado(E3)];
    for (const j of c.jogadores) {
      const esperado = (p1.get(j.nome) ?? 0) + (p2.get(j.nome) ?? 0) + (p3.get(j.nome) ?? 0);
      // o jogador unido por ID pode ter nomes diferentes entre etapas: confere só quem tem o mesmo nome nas três chaves
      if (j.porEtapa.filter((x) => x != null).length === [p1, p2, p3].filter((p) => p.has(j.nome)).length) expect(j.publicadoCent).toBe(esperado);
    }
    expect(c.jogadores.reduce((a, j) => a + j.publicadoCent, 0)).toBe([E1, E2, E3].reduce((a, s) => a + auditados[s].aud.linhas.reduce((b, l) => b + l.registradoCent, 0), 0));
    // não muda o que a coluna é: o total corrigido continua sendo o de sempre
    expect(c.jogadores.reduce((a, j) => a + j.totalCent, 0)).toBe([E1, E2, E3].reduce((a, s) => a + auditados[s].aud.linhas.filter((l) => l.situacao !== "PENDENTE_REGRA").reduce((b, l) => b + l.esperadoCent, 0), 0));
  });

  it("acumulado até a etapa escolhida: a etapa 2 acumulada só soma as etapas 1 e 2", () => {
    const ate2 = consolidar([etapa(1, E1), etapa(2, E2)]);
    const ate3 = consolidar([etapa(1, E1), etapa(2, E2), etapa(3, E3)]);
    const nome = auditados[E2].aud.linhas.find((l) => l.posicao === 1)!.jogador;
    const a = ate2.jogadores.find((j) => j.nome === nome)!;
    const b = ate3.jogadores.find((j) => j.nome === nome)!;
    expect(a.cenarios.B.porEtapa).toHaveLength(2);
    expect(b.cenarios.B.porEtapa).toHaveLength(3);
    expect(b.cenarios.B.porEtapa.slice(0, 2)).toEqual(a.cenarios.B.porEtapa);
  });

  it("desempate pelo mesmo critério em todos os cenários (primeiros lugares), sem posição para dados insuficientes", () => {
    const L = (jogador: string, posicao: number | null, a: number, c: number | null): LinhaConsolidado => ({
      jogador, posicao, esperadoCent: a, aguarda: false, cenarios: { A: a, B: a - 10, C: c, D: c == null ? null : c - 10 }, cenariosMotivo: c == null ? MOTIVO_SEM_ACOES : null,
    });
    const e: EtapaConsolidado = { numero: 1, jogadores: [{ nome: "Ana" }, { nome: "Beto" }, { nome: "Caio" }], linhas: [L("Ana", 1, 500, 600), L("Beto", 2, 500, 600), L("Caio", 3, 100, null)] };
    const c = consolidar([e]);
    const por = (n: string) => c.jogadores.find((j) => j.nome === n)!;
    for (const k of ["A", "B", "C", "D"] as const) {
      expect([por("Ana").cenarios[k].posicao, por("Beto").cenarios[k].posicao]).toEqual(k === "A" || k === "B" ? [1, 2] : [1, 2]); // Ana tem o 1º lugar: ganha o empate em todos
      expect(por("Ana").cenarios[k].empate).toBe(false);
    }
    expect(por("Caio").cenarios.A.posicao).toBe(3);
    expect(por("Caio").cenarios.C).toMatchObject({ totalCent: null, insuficiente: true, posicao: null, motivos: [{ etapa: 1, motivo: MOTIVO_SEM_ACOES, linhas: 1 }] });
  });
});
