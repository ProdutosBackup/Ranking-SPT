import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { consolidar } from "../lib/consolidado";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { PARTICIPACAO } from "../lib/participacao";
import { REGRAS_PADRAO, VERSAO_REGRAS } from "../lib/regras";

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

/** Muda os pontos de uma linha e acerta o total do jogador, para a integridade continuar fechando. */
function trocarPontos(d: DadosSpt, nomeTorneio: (n: string) => boolean, alvo: (r: { position: number | null }) => boolean, pontos: number) {
  const t = d.torneios.find((x) => nomeTorneio(x.name))!;
  for (const j of d.jogadores) {
    const r = j.resultados.find((x) => x.tournamentId === t.id && alvo(x));
    if (!r) continue;
    j.rankingPoints = Math.round((j.rankingPoints - r.points + pontos) * 100) / 100;
    r.points = pontos;
    return { jogador: j.name, torneio: t.name };
  }
  throw new Error("linha não encontrada");
}
const conferido = (d: DadosSpt) => {
  const aud = auditar(d, REGRAS_PADRAO);
  conferir(d, REGRAS_PADRAO, aud); // o verificador independente concorda
  return aud;
};

describe("participação de flight: 10 pontos fixos", () => {
  it("a versão das regras subiu para 1.3", () => expect(VERSAO_REGRAS).toBe("1.3"));

  it("flight com 10,00 é Correto; com 12,1 é Erro com a diferença registrada", async () => {
    const d = structuredClone(await fixture("taua-2026"));
    const antes = conferido(d);
    expect(antes.linhas.filter((l) => l.participacao)).toHaveLength(202);
    expect(antes.linhas.filter((l) => l.participacao).every((l) => l.esperado === 10 && l.situacao === "ERRO")).toBe(true); // nenhum dos 202 vale 10,00
    const { jogador, torneio } = trocarPontos(d, (n) => /dia 1a/i.test(n), () => true, 10);
    const depois = conferido(d);
    const l = depois.linhas.find((x) => x.jogador === jogador && x.torneio === torneio)!;
    expect([l.situacao, l.esperado, l.participacao, l.causaCodigo]).toEqual(["CORRETO", 10, true, null]);
    expect(depois.resumo).toMatchObject({ ERRO: 201, PENDENTE_REGRA: 0 });
    const erro = depois.linhas.find((x) => x.participacao && x.registrado === 12.1)!;
    expect([erro.situacao, erro.esperado, erro.diferenca, erro.causaCodigo, erro.causaProvavel]).toEqual(["ERRO", 10, 2.1, "PARTICIPACAO", PARTICIPACAO.causa]);
    expect(erro.inverso).toBeNull();
  });

  it("flights não têm tolerância de arredondamento: 10,01 é Erro", async () => {
    const d = structuredClone(await fixture("taua-2026"));
    const { jogador, torneio } = trocarPontos(d, (n) => /dia 1a/i.test(n), () => true, 10.01);
    const l = conferido(d).linhas.find((x) => x.jogador === jogador && x.torneio === torneio)!;
    expect(l.situacao).toBe("ERRO");
  });

  it("Dia Final sem posição é participação; com posição fica como antes", async () => {
    const d = structuredClone(await fixture("vale-suico-2026"));
    const aud = conferido(d);
    const dia = aud.linhas.filter((l) => l.torneio.includes("Dia Final"));
    expect(dia.filter((l) => l.participacao)).toHaveLength(126);
    expect(dia.filter((l) => l.participacao).every((l) => l.posicao == null && l.situacao === "CORRETO" && l.esperado === 10)).toBe(true);
    expect(dia.filter((l) => !l.participacao)).toHaveLength(64);
    expect(dia.filter((l) => !l.participacao).every((l) => l.posicao != null)).toBe(true);
    const t = aud.torneios.find((x) => x.torneio.includes("Dia Final"))!;
    expect([t.comPosicao, t.participacao, t.total]).toEqual([64, 126, 190]);
    expect(aud.resumo).toMatchObject({ CORRETO: 260, ERRO: 10, PENDENTE_REGRA: 0 });
    // com valor diferente de 10 vira Erro
    const { jogador } = trocarPontos(d, (n) => n.includes("Dia Final"), (r) => r.position == null, 12);
    const l = conferido(d).linhas.find((x) => x.jogador === jogador && x.torneio.includes("Dia Final"))!;
    expect([l.situacao, l.diferenca, l.causaCodigo]).toEqual(["ERRO", 2, "PARTICIPACAO"]);
  });

  it("não depende da regra de fora da premiação", async () => {
    const d = await fixture("vale-suico-2026");
    const aud = auditar(d, { ...REGRAS_PADRAO, foraDoItm: "10fixos" });
    expect(aud.linhas.filter((l) => l.participacao && l.situacao === "CORRETO")).toHaveLength(126);
  });
});

describe("aba Aguardando regra e Consolidado", () => {
  it("sem flights nem Dia Final sem posição pendentes, a aba fica vazia, com o texto próprio", async () => {
    const d = await fixture("vale-suico-2026");
    const r = montarResposta("vale-suico-2026", d, REGRAS_PADRAO, auditar(d, REGRAS_PADRAO), identificador(d));
    expect(r.painel.aguardandoGrupos).toEqual([]);
    expect(r.painel.indicadores.aguardando).toBe(0);
    expect(PARTICIPACAO.vazioAguardando).toBe("Nenhum resultado aguardando regra.");
  });

  it("o Consolidado soma a participação (10,00 por linha) e não conta primeiro lugar de flight", async () => {
    const d = await fixture("taua-2026");
    const aud = auditar(d, REGRAS_PADRAO);
    const linhas = aud.linhas.map((l) => ({ jogador: l.jogador, posicao: l.posicao, esperadoCent: Math.round(l.esperado * 100), aguarda: l.situacao === "PENDENTE_REGRA", participacao: l.participacao }));
    const c = consolidar([{ numero: 1, jogadores: d.jogadores.map((j) => ({ nome: j.name, id: j.id })), linhas }]);
    expect(c.aguardando).toEqual([{ etapa: 1, n: 0 }]);
    const alvo = aud.linhas.find((l) => l.participacao)!;
    const doJogador = aud.linhas.filter((l) => l.jogador === alvo.jogador);
    const esperado = doJogador.reduce((a, l) => a + Math.round(l.esperado * 100), 0);
    expect(c.jogadores.find((j) => j.nome === alvo.jogador)!.totalCent).toBe(esperado);
    const primeirosDeFlight = aud.linhas.filter((l) => l.participacao && l.posicao === 1);
    expect(primeirosDeFlight.length).toBeGreaterThan(0);
    for (const l of primeirosDeFlight) {
      const naoFlight = aud.linhas.filter((x) => x.jogador === l.jogador && !x.participacao && x.posicao === 1 && x.esperado > 0).length;
      expect(c.jogadores.find((j) => j.nome === l.jogador)!.primeiros).toBe(naoFlight);
    }
  });
});
