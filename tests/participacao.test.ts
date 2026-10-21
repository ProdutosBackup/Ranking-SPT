import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { lerPlanilha } from "../lib/planilha";
import { CAMPO, PARTICIPACAO } from "../lib/participacao";
import { lerRegras, REGRAS_PADRAO, VERSAO_REGRAS, type Regras } from "../lib/regras";

function fixture(stage: string) {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  vi.stubGlobal("fetch", async (url: string) => {
    const u = new URL(url);
    const body = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
    return { ok: true, status: 200, json: async () => body };
  });
  return buscarDados(stage);
}
afterEach(() => vi.unstubAllGlobals());

const conferido = (d: DadosSpt, regras: Regras = REGRAS_PADRAO) => {
  const aud = auditar(d, regras);
  conferir(d, regras, aud); // o verificador independente concorda
  return aud;
};
/** Informa as ações (buy-ins + re-entries) de um torneio. */
const comAcoes = (d: DadosSpt, nome: RegExp, buyIns: number, reentries: number) => {
  const t = d.torneios.find((x) => nome.test(x.name))!;
  t.buyIns = buyIns;
  t.reentries = reentries;
  return t;
};

describe("flights: 10 × fatores com o campo em ações", () => {
  it("a versão das regras é 1.4", () => expect(VERSAO_REGRAS).toBe("1.4"));

  it("sem as ações do flight, a linha aguarda regra, com o motivo claro", async () => {
    const d = await fixture("taua-2026");
    const aud = conferido(d);
    const flights = aud.linhas.filter((l) => l.participacao);
    expect(flights).toHaveLength(202);
    expect(flights.every((l) => l.situacao === "PENDENTE_REGRA" && l.pendencia === "FLIGHT" && l.causaProvavel === PARTICIPACAO.motivoFlight)).toBe(true);
    expect(aud.resumo).toMatchObject({ ERRO: 0, PENDENTE_REGRA: 202 });
    const r = montarResposta("taua-2026", d, REGRAS_PADRAO, aud, identificador(d));
    expect(r.linhas.find((l) => l.participacao)!.rotulo).toBe("Aguardando: faltam as ações deste flight");
    expect(r.painel.aguardandoGrupos[0]).toMatchObject({ codigo: "FLIGHT", titulo: PARTICIPACAO.tituloFlight, total: 202 });
  });

  it("126 ações e buy-in R$ 1.000: esperado 17,6 (Dia 1A); 71 ações: 12,1 (Dia 1D)", async () => {
    const d = structuredClone(await fixture("taua-2026"));
    comAcoes(d, /dia 1a/i, 100, 26); // 126 ações
    comAcoes(d, /dia 1d/i, 71, 0); // 71 ações
    const aud = conferido(d);
    const a = aud.linhas.filter((l) => l.torneio.includes("1A"));
    expect(a).toHaveLength(83);
    expect(a.every((l) => l.situacao === "CORRETO" && l.esperado === 17.6 && l.registrado === 17.6 && l.field === 126 && l.participacao)).toBe(true);
    const dd = aud.linhas.filter((l) => /dia 1d/i.test(l.torneio));
    expect(dd.every((l) => l.situacao === "CORRETO" && l.esperado === 12.1 && l.field === 71)).toBe(true);
    // os outros flights seguem aguardando (1C e 1E sem ações)
    expect(aud.resumo).toMatchObject({ ERRO: 0, PENDENTE_REGRA: 202 - 83 - 55 });
  });

  it("ações que não reproduzem o valor registrado: Erro, sem tolerância", async () => {
    const d = structuredClone(await fixture("taua-2026"));
    comAcoes(d, /dia 1a/i, 71, 0); // 71 ações → 12,1, mas o site pagou 17,6
    const aud = conferido(d);
    const l = aud.linhas.find((x) => x.torneio.includes("1A"))!;
    expect([l.situacao, l.esperado, l.registrado, l.diferenca, l.causaCodigo, l.causaProvavel]).toEqual(["ERRO", 12.1, 17.6, 5.5, "PARTICIPACAO", PARTICIPACAO.causa]);
    expect(l.inverso).toBeNull();
    // 0,01 de diferença também é Erro (nada de arredondamento nos flights)
    const e = structuredClone(await fixture("taua-2026"));
    comAcoes(e, /dia 1a/i, 100, 26);
    const j = e.jogadores.find((x) => x.resultados.some((r) => e.torneios.find((t) => t.id === r.tournamentId)!.name.includes("1A")))!;
    const r = j.resultados.find((x) => e.torneios.find((t) => t.id === x.tournamentId)!.name.includes("1A"))!;
    j.rankingPoints = Math.round((j.rankingPoints - r.points + 17.61) * 100) / 100;
    r.points = 17.61;
    expect(conferido(e).linhas.find((x) => x.jogador === j.name && x.torneio.includes("1A"))!.situacao).toBe("ERRO");
  });

  it("a regra do flight não depende da opção de fora da premiação", async () => {
    const d = structuredClone(await fixture("taua-2026"));
    comAcoes(d, /dia 1a/i, 100, 26);
    const aud = conferido(d, { ...REGRAS_PADRAO, foraDoItm: "10fixos" });
    expect(aud.linhas.filter((l) => l.torneio.includes("1A")).every((l) => l.situacao === "CORRETO" && l.esperado === 17.6)).toBe(true);
  });
});

describe("Dia Final sem posição aguarda regra", () => {
  it("126 linhas aguardando, com o motivo; com posição fica como antes", async () => {
    const d = await fixture("vale-suico-2026");
    const aud = conferido(d);
    const dia = aud.linhas.filter((l) => l.torneio.includes("Dia Final"));
    const sem = dia.filter((l) => l.participacao);
    expect(sem).toHaveLength(126);
    expect(sem.every((l) => l.posicao == null && l.situacao === "PENDENTE_REGRA" && l.pendencia === "FINAL_SEM_POSICAO" && l.causaProvavel === PARTICIPACAO.motivoDiaFinal)).toBe(true);
    expect(dia.filter((l) => !l.participacao)).toHaveLength(64);
    const t = aud.torneios.find((x) => x.torneio.includes("Dia Final"))!;
    expect([t.comPosicao, t.participacao]).toEqual([64, 126]);
    expect(aud.resumo).toMatchObject({ CORRETO: 134, ERRO: 10, PENDENTE_REGRA: 126 });
    const r = montarResposta("vale-suico-2026", d, REGRAS_PADRAO, aud, identificador(d));
    expect(r.painel.aguardandoGrupos[0]).toMatchObject({ codigo: "FINAL_SEM_POSICAO", titulo: PARTICIPACAO.tituloDiaFinal, total: 126 });
    expect(r.painel.indicadores.percentualCorretos).toBe(93.1);
  });
});

describe("opção de regra: campo do torneio", () => {
  it("o padrão é inscritos; o parâmetro campo=acoes liga a opção; valor inválido é erro", () => {
    expect(REGRAS_PADRAO.field).toBe("players");
    expect(lerRegras(new URLSearchParams("campo=inscritos")).field).toBe("players");
    expect(lerRegras(new URLSearchParams("campo=acoes")).field).toBe("acoes");
    expect(() => lerRegras(new URLSearchParams("campo=outro"))).toThrow('campo inválido: "outro"');
    expect(lerRegras(new URLSearchParams(""))).toEqual(REGRAS_PADRAO);
  });

  it("desligada, não muda nada: o resultado é idêntico ao padrão; o texto das regras mostra inscritos", async () => {
    const d = await fixture("vale-suico-2026");
    const padrao = auditar(d, REGRAS_PADRAO);
    const explicita = auditar(d, lerRegras(new URLSearchParams("campo=inscritos")));
    expect(JSON.stringify(explicita)).toBe(JSON.stringify(padrao));
    const r = montarResposta("vale-suico-2026", d, REGRAS_PADRAO, padrao, identificador(d));
    expect(r.painel.regrasTexto.find((x) => x.titulo === CAMPO.rotulo)!.valor).toBe(CAMPO.inscritos);
    expect(r.painel.avisos.some((a) => a.includes("Campo do torneio"))).toBe(false);
  });

  it("ligada, o campo vem de buy-ins + re-entries da planilha; Dia Final continua com a soma dos flights", async () => {
    const lida = await lerPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), { stage: "bendito-cacao-2026" });
    if (!lida.ok) throw new Error(lida.erros.join(" | "));
    const flight = { id: "f", name: "Dia 1 A", buyIn: 1000, players: 328, role: "FLIGHT", flightLabel: "1A", status: "FINISHED" };
    const d = { ...lida.dados, torneios: [...lida.dados.torneios, flight] };
    const acoes = { ...REGRAS_PADRAO, field: "acoes" } as Regras;
    const campo = (aud: ReturnType<typeof auditar>) => Object.fromEntries(aud.torneios.filter((t) => t.total > 0).map((t) => [t.torneio, t.field]));
    const padrao = campo(conferido(d));
    const ligada = campo(conferido(d, acoes));
    expect(padrao["HIGH ROLLER 50K"]).toBe(31);
    expect(ligada["HIGH ROLLER 50K"]).toBe(61); // 31 buy-ins + 30 re-entries
    expect(ligada["HORSE"]).toBe(23);
    expect(ligada["SECOND CHANCE"]).toBe(173);
    expect(ligada["Main Event SPT - Dia Final"]).toBe(328); // soma dos flights, nas duas opções
    expect(padrao["Main Event SPT - Dia Final"]).toBe(328);
    const r = montarResposta("bendito-cacao-2026", d, acoes, auditar(d, acoes), identificador(d));
    expect(r.painel.regrasTexto.find((x) => x.titulo === CAMPO.rotulo)!.valor).toBe(`${CAMPO.acoes}; ${CAMPO.semAcoes}`);
  });

  it("onde não há ações informadas (site), usa os inscritos e lista os torneios no resultado", async () => {
    const d = await fixture("vale-suico-2026");
    const acoes = { ...REGRAS_PADRAO, field: "acoes" } as Regras;
    const aud = conferido(d, acoes);
    expect(JSON.stringify(aud.linhas.map((l) => [l.field, l.situacao]))).toBe(JSON.stringify(auditar(d, REGRAS_PADRAO).linhas.map((l) => [l.field, l.situacao])));
    const r = montarResposta("vale-suico-2026", d, acoes, aud, identificador(d));
    const aviso = r.painel.avisos.find((a) => a.startsWith("Campo do torneio = ações:"))!;
    expect(aviso).toContain("8 torneios não têm as ações informadas e usaram os inscritos");
    expect(aviso).toContain("EV #2 200K PLO 5 K.O");
  });
});
