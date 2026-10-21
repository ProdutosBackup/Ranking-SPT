import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buscarDados, extracao, MSG_FORA, MSG_MUDOU, MSG_SEM_RANKING, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { lerCompartilhado } from "../lib/cache";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { lerRegras, REGRAS_PADRAO } from "../lib/regras";
import { verificar } from "../lib/verificador";

// ---------- servidor simulado: serve as fixtures e deixa cada teste interferir em chamadas específicas ----------
type Resp = { ok: boolean; status: number; json: () => Promise<unknown> };
const ok = (corpo: unknown): Resp => ({ ok: true, status: 200, json: async () => structuredClone(corpo) });
const http = (status: number): Resp => ({ ok: false, status, json: async () => ({}) });
const jsonInvalido = (): Resp => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected end of JSON input"); } });
const PENDURAR = Symbol("pendurar");
type Fx = { ranking: { updatedAt: string; ranking: { rank: number; name: string; points: number }[] }; tournaments: { updatedAt: string; tournaments: { players: number }[] }; playerSummaries: Record<string, unknown> };
type Tipo = "ranking" | "torneios" | "jogador";
type Gancho = (tipo: Tipo, n: number, nome: string | null, fx: Fx) => Resp | typeof PENDURAR | undefined | Promise<Resp | undefined>;

function servidor(stage: string, gancho?: Gancho) {
  const fx: Fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  const chamadas: Record<Tipo, number> = { ranking: 0, torneios: 0, jogador: 0 };
  vi.stubGlobal("fetch", async (url: string, init?: { signal?: AbortSignal }) => {
    const u = new URL(url);
    const tipo: Tipo = u.pathname.endsWith("/ranking") ? "ranking" : u.pathname.endsWith("/tournaments") ? "torneios" : "jogador";
    const nome = u.searchParams.get("name");
    const n = ++chamadas[tipo];
    const g = await gancho?.(tipo, n, nome, fx);
    if (g === PENDURAR)
      return new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("tempo esgotado", "AbortError"))));
    if (g) return g;
    return ok(tipo === "ranking" ? fx.ranking : tipo === "torneios" ? fx.tournaments : fx.playerSummaries[nome!]);
  });
  return { fx, chamadas };
}
const carregar = (stage: string) => {
  servidor(stage);
  return buscarDados(stage);
};

const ES = extracao.esperasMs;
beforeEach(() => {
  extracao.timeoutMs = 30;
  extracao.esperasMs = [1, 1];
});
afterEach(() => {
  vi.unstubAllGlobals();
  extracao.timeoutMs = 15000;
  extracao.esperasMs = ES;
});

const E2 = "vale-suico-2026";
const E1 = "taua-2026";

describe("leitura da API: falhas e mensagens", () => {
  it("tempo limite: 3 tentativas e bloqueio 'o site não respondeu'", async () => {
    const { chamadas } = servidor(E2, (t) => (t === "ranking" ? PENDURAR : undefined));
    await expect(buscarDados(E2)).rejects.toThrow(MSG_FORA);
    expect(chamadas.ranking).toBe(3);
  });

  it("HTTP 429 seguido de sucesso: tenta de novo e conclui", async () => {
    const { chamadas } = servidor(E2, (t, n) => (t === "ranking" && n === 1 ? http(429) : undefined));
    const d = await buscarDados(E2);
    expect(d.jogadores).toHaveLength(208);
    expect(chamadas.ranking).toBe(3); // 429, nova tentativa, releitura final
  });

  it("HTTP 500 três vezes: bloqueio 'o site não respondeu'", async () => {
    const { chamadas } = servidor(E2, (t) => (t === "torneios" ? http(500) : undefined));
    await expect(buscarDados(E2)).rejects.toThrow(MSG_FORA);
    expect(chamadas.torneios).toBe(3);
  });

  it("falha de rede (fetch lança erro) conta como falha passageira", async () => {
    servidor(E2, (t, n) => {
      if (t === "ranking" && n === 1) throw new TypeError("fetch failed");
      return undefined;
    });
    await expect(buscarDados(E2)).resolves.toBeTruthy();
  });

  it("resposta que não é JSON válido: bloqueio com mensagem clara, sem repetir a chamada", async () => {
    const { chamadas } = servidor(E2, (t) => (t === "ranking" ? jsonInvalido() : undefined));
    await expect(buscarDados(E2)).rejects.toThrow(/não foi possível entender/);
    expect(chamadas.ranking).toBe(1);
  });

  it("etapa sem ranking", async () => {
    servidor(E2, (t, _n, _nome, fx) => (t === "ranking" ? ok({ updatedAt: fx.ranking.updatedAt, ranking: [] }) : undefined));
    await expect(buscarDados(E2)).rejects.toThrow(MSG_SEM_RANKING);
    expect(MSG_SEM_RANKING).toBe("Esta etapa ainda não tem ranking publicado.");
  });

  it("jogador que volta sem resultados", async () => {
    const { fx } = servidor(E2, (t, _n, nome) => (t === "jogador" && nome === "Rafael Bryan" ? ok({ results: [] }) : undefined));
    expect(fx.ranking.ranking.some((p) => p.name === "Rafael Bryan")).toBe(true);
    await expect(buscarDados(E2)).rejects.toThrow("Não foi possível ler os resultados de Rafael Bryan.");
  });

  it("falha definitiva em um jogador interrompe as outras chamadas", async () => {
    const primeiro = JSON.parse(readFileSync(`tests/fixtures/${E2}.json`, "utf8")).ranking.ranking[0].name;
    const { chamadas } = servidor(E2, async (t, _n, nome) => {
      if (t !== "jogador") return undefined;
      if (nome === primeiro) return http(500);
      await new Promise((r) => setTimeout(r, 15));
      return undefined;
    });
    await expect(buscarDados(E2)).rejects.toThrow(MSG_FORA);
    expect(chamadas.jogador).toBeLessThan(30); // de 208
  });

  it("nomes duplicados no ranking: bloqueio com a lista dos nomes", async () => {
    servidor(E2, (t, _n, _nome, fx) => {
      if (t !== "ranking") return undefined;
      const r = fx.ranking.ranking;
      return ok({ ...fx.ranking, ranking: [...r, { ...r[0] }, { ...r[1] }] });
    });
    const nomes = JSON.parse(readFileSync(`tests/fixtures/${E2}.json`, "utf8")).ranking.ranking.slice(0, 2).map((p: { name: string }) => p.name);
    await expect(buscarDados(E2)).rejects.toThrow(`O ranking tem jogadores com o mesmo nome: ${nomes.join(", ")}.`);
  });
});

describe("dados mudando durante a leitura", () => {
  const alterados = (fx: Fx, n: number) => {
    const c = structuredClone(fx.tournaments);
    c.tournaments[0].players += n;
    return ok(c);
  };
  it("muda uma vez entre a leitura e a releitura: refaz a leitura e conclui", async () => {
    const { chamadas } = servidor(E2, (t, n, _nome, fx) => (t === "torneios" && n >= 2 ? alterados(fx, 1) : undefined));
    const d = await buscarDados(E2);
    expect(d.torneios[0].players).toBe(JSON.parse(readFileSync(`tests/fixtures/${E2}.json`, "utf8")).tournaments.tournaments[0].players + 1);
    expect(chamadas.torneios).toBe(4); // leitura, releitura (mudou), nova leitura, nova releitura
  });
  it("muda de novo: bloqueia com a mensagem de dados mudando", async () => {
    servidor(E2, (t, n, _nome, fx) => (t === "torneios" ? alterados(fx, n) : undefined));
    await expect(buscarDados(E2)).rejects.toThrow(MSG_MUDOU);
    expect(MSG_MUDOU).toBe("Os dados do site mudaram durante a leitura. Tente novamente em alguns minutos.");
  });
});

describe("duas auditorias simultâneas da mesma etapa", () => {
  it("compartilham a mesma leitura (mesmo número de chamadas à API)", async () => {
    const a = servidor(E2);
    await lerCompartilhado(E2);
    const sozinha = a.chamadas.ranking + a.chamadas.torneios + a.chamadas.jogador;

    const b = servidor(E2);
    const progresso: number[] = [];
    const [x, y] = await Promise.all([lerCompartilhado(E2), lerCompartilhado(E2, (f) => progresso.push(f))]);
    expect(b.chamadas.ranking + b.chamadas.torneios + b.chamadas.jogador).toBe(sozinha);
    expect(x).toBe(y);
    expect(progresso.length).toBeGreaterThan(0);
  });
});

// ---------- situações anormais nos dados (variações das fixtures) ----------
describe("torneio não finalizado, cancelado, sem buy-in e prêmio fora dos premiados", () => {
  const regras = REGRAS_PADRAO;
  const painel = (d: DadosSpt) => {
    const aud = auditar(d, regras);
    conferir(d, regras, aud); // integridade e verificador independente fecham
    return { aud, r: montarResposta(E2, d, regras, aud, identificador(d)) };
  };
  const por = (d: DadosSpt, prefixo: string) => d.torneios.find((t) => t.name.startsWith(prefixo))!;

  it("em andamento com resultados: aguardando, fora dos erros, com aviso", async () => {
    const d = structuredClone(await carregar(E2));
    por(d, "EV #2").status = "RUNNING";
    const { aud, r } = painel(d);
    expect(aud.resumo).toMatchObject({ ERRO: 9, PENDENTE_REGRA: 12 });
    const ls = r.linhas.filter((l) => l.torneio.startsWith("EV #2"));
    expect(new Set(ls.map((l) => l.rotulo))).toEqual(new Set(["Aguardando: torneio não finalizado"]));
    expect(r.painel.avisos).toContain("Há torneios não finalizados nesta etapa.");
    expect(r.painel.aguardando.some((a) => a.texto === "12 resultados de EV #2 200K PLO 5 K.O: torneio não finalizado")).toBe(true);
    expect(r.painel.indicadores.erros).toBe(9);
  });

  it("cancelado com resultados: aguardando, motivo 'torneio cancelado'", async () => {
    const d = structuredClone(await carregar(E2));
    por(d, "EV #6").status = "CANCELED";
    const { aud, r } = painel(d);
    expect(aud.resumo).toMatchObject({ ERRO: 9, PENDENTE_REGRA: 3 });
    expect(r.linhas.filter((l) => l.torneio.startsWith("EV #6")).every((l) => l.rotulo === "Aguardando: torneio cancelado")).toBe(true);
    expect(r.painel.aguardando.some((a) => a.texto.endsWith("torneio cancelado"))).toBe(true);
    expect(r.painel.avisos).toContain("Há resultados registrados em torneio cancelado.");
  });

  it("buy-in 0 em torneio comum: aguardando, sem cálculo silencioso", async () => {
    const d = structuredClone(await carregar(E2));
    por(d, "EV #3").buyIn = 0;
    const { aud, r } = painel(d);
    expect(aud.resumo).toMatchObject({ ERRO: 10, PENDENTE_REGRA: 9, CORRETO: 260 - 9 });
    expect(r.linhas.filter((l) => l.torneio.startsWith("EV #3")).every((l) => l.rotulo === "Aguardando: buy-in não informado")).toBe(true);
    expect(r.painel.avisos).toContain("Há torneios sem buy-in informado.");
  });

  it("satélite nunca pontua: pontos registrados são Erro; zero é Correto", async () => {
    const d = structuredClone(await carregar(E2));
    por(d, "EV #3").name = "Satélite EV #3";
    const { aud } = painel(d);
    const ls = aud.linhas.filter((l) => l.torneio === "Satélite EV #3");
    expect(ls).toHaveLength(9);
    expect(ls.every((l) => l.situacao === "ERRO" && l.esperado === 0 && l.causaProvavel === "Satélite com pontos registrados")).toBe(true);
    expect(aud.resumo).toMatchObject({ ERRO: 10 + 9, PENDENTE_REGRA: 0, CORRETO: 260 - 9 });
    // com pontos zerados a linha fecha como Correto, e o verificador concorda
    for (const j of d.jogadores) for (const r of j.resultados) if (r.tournamentId === por(d, "Satélite EV #3").id) r.points = 0;
    const zero = auditar(d, REGRAS_PADRAO);
    expect(zero.linhas.filter((l) => l.torneio === "Satélite EV #3").every((l) => l.situacao === "CORRETO")).toBe(true);
    expect(verificar(d, REGRAS_PADRAO, zero.linhas, zero.torneios)).toEqual([]);
  });

  it("buy-in 0 no Dia Final continua usando o valor da regra", async () => {
    const d = await carregar(E2);
    expect(por(d, "Main Event SPT — Dia Final").buyIn).toBe(0);
    expect(auditar(d, regras).resumo).toMatchObject({ ERRO: 10, CORRETO: 260, PENDENTE_REGRA: 0 });
  });

  it("prêmio em posição maior que o número de premiados: SUSPEITO no motor e no verificador", async () => {
    const original = await carregar(E2);
    const antes = auditar(original, regras);
    const d = structuredClone(original);
    const t = por(d, "EV #10");
    const res = d.jogadores.flatMap((j) => j.resultados).find((x) => x.tournamentId === t.id && x.position === 5)!;
    expect(res.prize).toBeGreaterThan(0);
    res.position = 99;
    const { aud, r } = painel(d); // conferir() passa: verificador e motor concordam
    expect(aud.resumo).toMatchObject({ SUSPEITO: 1, CORRETO: 259, ERRO: 10 });
    expect(r.linhas.find((l) => l.posicao === 99)!.rotulo).toBe("Revisar");
    // o verificador pega um motor que ainda dissesse CORRETO para essa linha
    expect(verificar(d, regras, antes.linhas, aud.torneios).length).toBeGreaterThan(0);
  });
});

describe("lerRegras", () => {
  const q = (s: string) => new URLSearchParams(s);
  it("sem parâmetros: padrões", () => expect(lerRegras(q(""))).toEqual(REGRAS_PADRAO));
  it("parâmetros válidos", () => {
    expect(lerRegras(q("foraDoItm=10fixos&aposDecimoOitavo=base10&tolerancia=0,5"))).toMatchObject({
      foraDoItm: "10fixos", aposDecimoOitavo: "base10", toleranciaArredondamento: 0.5,
    });
    expect(lerRegras(q("tolerancia=1.25")).toleranciaArredondamento).toBe(1.25);
    expect(lerRegras(q("satelitesPontuam=true"))).toEqual(REGRAS_PADRAO); // parâmetro antigo é ignorado
  });
  it.each([
    ["foraDoItm=nada", /foraDoItm inválido/],
    ["aposDecimoOitavo=x", /aposDecimoOitavo inválido/],
    ["tolerancia=abc", /tolerancia inválida/],
    ["tolerancia=-1", /tolerancia inválida/],
  ])("inválido: %s", (s, msg) => expect(() => lerRegras(q(s))).toThrow(msg));
});

describe("painel: indicadores e grupos das duas etapas", () => {
  it("Etapa 1", async () => {
    const d = await carregar(E1);
    const r = montarResposta(E1, d, REGRAS_PADRAO, auditar(d, REGRAS_PADRAO), identificador(d));
    expect(r.painel.indicadores).toMatchObject({
      auditados: 642, corretos: 440, divergenciasInscritos: { torneios: 5, resultadosExplicados: 386 }, erros: 202,
      pontosEmDiscordancia: 883, jogadoresAfetados: 158, aguardando: 0, arredondamento: 0,
    });
    expect(r.painel.grupos.map((g) => [g.indices.length, g.titulo])).toEqual([[202, "Participação de flight com pontos diferentes de 10"]]);
    expect(r.painel.impacto).toHaveLength(158);
    expect(r.painel.divergencias).toHaveLength(5);
    expect(r.painel.divergencias[0].texto).toContain("não prova que o site esteja certo");
    expect(r.painel.aguardando).toHaveLength(0);
    expect(r.painel.avisos).toEqual([]);
  });
  it("Etapa 2", async () => {
    const d = await carregar(E2);
    const r = montarResposta(E2, d, REGRAS_PADRAO, auditar(d, REGRAS_PADRAO), identificador(d));
    expect(r.painel.indicadores).toMatchObject({
      auditados: 270, corretos: 260, erros: 10, jogadoresAfetados: 10, aguardando: 0, arredondamento: 0,
      divergenciasInscritos: { torneios: 0, resultadosExplicados: 0 },
    });
    expect(r.painel.grupos.map((g) => [g.indices.length, g.titulo])).toEqual([
      [5, "10 pontos fixos em vez de 10 × fatores"],
      [3, "Valor igual ao de um 4º colocado"],
      [2, "Campeão com valor igual ao de um 2º colocado"],
    ]);
    expect(r.painel.impacto).toHaveLength(10);
    expect(r.painel.aguardando).toEqual([]);
    const dia = r.painel.torneios.find((t) => t.nome.includes("Dia Final"))!;
    expect([dia.comPosicao, dia.participacao, dia.resultados]).toEqual([64, 126, 190]);
    expect(r.painel.divergencias).toEqual([]);
  });
});

describe("painel: dados entregues à tela", () => {
  it("Etapa 2: veredito, composição, hipótese de Emerson, jogadores e tabelas", async () => {
    const d = await carregar(E2);
    const r = montarResposta(E2, d, REGRAS_PADRAO, auditar(d, REGRAS_PADRAO), identificador(d));
    const p = r.painel;
    expect(p.veredito).toBe("Etapa 2: 10 resultados com pontuação diferente da regra, afetando 10 jogadores (3.155,65 pontos em discordância).");
    expect(p.indicadores.composicao).toEqual({ corretos: 260, corretosSite: 0, erros: 10, aguardando: 0, revisar: 0 });
    expect(p.indicadores.percentualCorretos).toBe(96.3);
    const e = r.linhas.find((l) => l.jogador === "Emerson Rocha Sheik" && l.posicao === 1)!;
    expect([e.base, e.fatorParticipantes, e.fatorBuyIn, e.esperado, e.registrado, e.diferenca]).toEqual([1000, 3.81, 1, 3810, 2286, -1524]);
    expect(e.hipotese).toEqual({ texto: "Valor igual ao de um 4º colocado", conta: "600 × 3,81 × 1 = 2.286" });
    expect(e.faixaBuyIn).toBe("de R$ 500 a R$ 1.000");
    expect(p.grupos.map((g) => g.pontos)).toEqual([99.85, 2667, 389.8].map((x, i) => p.grupos[i].pontos)); // pontos por causa presentes
    expect(p.grupos.reduce((a, g) => a + g.pontos, 0)).toBeCloseTo(p.indicadores.pontosEmDiscordancia, 2);
    expect(p.jogadores).toHaveLength(208);
    expect(p.jogadores.filter((j) => j.erros > 0)).toHaveLength(10);
    expect(p.jogadores.find((j) => j.nome === "Emerson Rocha Sheik")).toMatchObject({ pontosSite: 2286, pontosCorretos: 3810, diferenca: 1524 });
    expect(p.aguardandoGrupos).toHaveLength(0);
    expect(p.tabelas.buyIn.map((b) => b.fator)).toEqual([1, 1, 1.2, 1.5, 2.5]);
    expect(p.tabelas.bases[0]).toEqual({ posicao: "1º", pontos: 1000 });
    expect(p.tabelas.bases.at(-1)).toEqual({ posicao: "19º em diante (premiados)", pontos: 100 });
    expect(p.torneios.filter((t) => t.estado === "erro")).toHaveLength(5);
    expect(p.torneios.filter((t) => t.estado === "vazio").length).toBe(10);
  });
  it("Etapa 1: veredito sem erro, com divergências", async () => {
    const d = await carregar(E1);
    const r = montarResposta(E1, d, REGRAS_PADRAO, auditar(d, REGRAS_PADRAO), identificador(d));
    expect(r.painel.veredito).toBe("Etapa 1: 202 resultados com pontuação diferente da regra, afetando 158 jogadores (883 pontos em discordância). 5 torneios têm inscritos diferentes da API (386 resultados explicados).");
    expect(r.painel.indicadores.percentualCorretos).toBe(68.5);
    expect(r.painel.torneios.filter((t) => t.estado === "divergencia")).toHaveLength(5);
    expect(r.painel.divergencias.every((x) => x.torneioId)).toBe(true);
  });
});
