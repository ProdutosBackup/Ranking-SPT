import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarDados, type DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { PISO_PARTICIPACAO, REGRAS_PADRAO, VERSAO_REGRAS } from "../lib/regras";
import { verificar } from "../lib/verificador";

// Piso de participação [usuário, 16/11/2026: "A pontuação mínima de participação é 10 cravado. Eu preciso que isso entre na regra e que não faça
// 'correção' com base em cálculo com pontuação menor que 10."]. Esperado = maior valor entre 10 e 10 × Fator_Participantes × Fator_Buy-in, em todos os
// cenários. Não vale para linhas que valem 0 nem para linhas pontuadas por posição. Os valores abaixo são contas à mão.

afterEach(() => vi.unstubAllGlobals());

// Dados inventados: um campeão (com prêmio) e um jogador fora da premiação por torneio.
const torneio = (id: string, name: string, players: number, buyIn: number, acoes?: number) => ({
  id, name, buyIn, players, role: "STANDALONE", flightLabel: null, status: "FINISHED", ...(acoes != null ? { buyIns: acoes, reentries: 0 } : {}),
});
const sintetico = (): DadosSpt => {
  const torneios = [
    torneio("t20", "Torneio Vinte", 20, 500, 20), // fator 0,7 (C e D com 20 ações)
    torneio("t50", "Torneio Cinquenta", 50, 500), // fator 1,0 (sem ações: C e D sem valor)
    torneio("t100", "Torneio Cem", 100, 1000), // fator 1,5
    torneio("sat", "Satélite Teste", 20, 500),
  ];
  const r = (t: string, position: number, points: number, prize: number | null) => ({ tournamentId: t, tournamentName: torneios.find((x) => x.id === t)!.name, position, points, prize });
  const jogadores = [
    { name: "Jogador Alfa", rank: 1, rankingPoints: 0, resultados: [r("t20", 1, 700, 5000), r("t50", 1, 1000, 9000), r("t100", 1, 1500, 20000), r("sat", 1, 0, 1000)] },
    { name: "Jogador Beta", rank: 2, rankingPoints: 0, resultados: [r("t20", 2, 10, 0), r("t50", 2, 10, 0), r("t100", 2, 15, 0), r("sat", 2, 0, 0)] },
  ];
  for (const j of jogadores) j.rankingPoints = j.resultados.reduce((a, x) => a + x.points, 0);
  return { stage: "etapa-teste", updatedAt: { ranking: "", tournaments: "" }, torneios, jogadores };
};

describe("piso de 10 nos pontos de participação", () => {
  it("constante e versão", () => {
    expect(PISO_PARTICIPACAO).toBe(10);
    expect(VERSAO_REGRAS).toBe("2.12");
  });

  it("casos inventados: abaixo de 10 vale 10; 10 ou mais não muda; posição e linhas que valem 0 não mudam", () => {
    const d = sintetico();
    const aud = auditar(d, REGRAS_PADRAO);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]); // os dois motores concordam em todas as linhas e nos 4 cenários
    const l = (t: string, pos: number) => aud.linhas.find((x) => x.torneioId === t && x.posicao === pos)!;
    const ver = (x: ReturnType<typeof l>) => [x.esperadoCent, x.cenarios.A, x.cenarios.B, x.cenarios.C, x.cenarios.D, x.situacao];

    // 20 participantes, R$ 500: 10 × 0,7 × 1,0 = 7 → 10; B: 10 × 0,7 × 0,9 = 6,3 → 10; C e D (20 ações): iguais, 7 e 6,3 → 10.
    expect(ver(l("t20", 2))).toEqual([1000, 1000, 1000, 1000, 1000, "CORRETO"]);
    expect(l("t20", 2).conta).toBe("10 × 0,7 × 1 = 7; vale o mínimo de 10");
    // 50 participantes, R$ 500: 10 × 1,0 × 1,0 = 10 → 10 (sem o texto do mínimo); B: 10 × 1,0 × 0,9 = 9 → 10. Sem ações: C e D sem valor.
    expect(ver(l("t50", 2))).toEqual([1000, 1000, 1000, null, null, "CORRETO"]);
    expect(l("t50", 2).conta).toBe("10 × 1 × 1");
    // 100 participantes, R$ 1.000: 10 × 1,5 × 1,0 = 15 (o piso não sobe o que já passa de 10); B: 15 × 0,9 = 13,5.
    expect(ver(l("t100", 2))).toEqual([1500, 1500, 1350, null, null, "CORRETO"]);
    expect(l("t100", 2).conta).toBe("10 × 1,5 × 1");
    // Pontuados por posição: sem piso. Campeão do de 20: 1000 × 0,7 = 700; B: 630.
    expect(ver(l("t20", 1))).toEqual([70000, 70000, 63000, 70000, 63000, "CORRETO"]);
    // Satélite: vale 0 em todos os cenários.
    for (const p of [1, 2]) expect(ver(l("sat", p))).toEqual([0, 0, 0, 0, 0, "CORRETO"]);
  });

  it("registrado com a conta abaixo de 10 (7) é Erro: vale o mínimo de 10", () => {
    const d = sintetico();
    d.jogadores[1].resultados[0].points = 7;
    const aud = auditar(d, REGRAS_PADRAO);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
    const x = aud.linhas.find((y) => y.torneioId === "t20" && y.posicao === 2)!;
    expect([x.registrado, x.esperado, x.diferenca, x.situacao]).toEqual([7, 10, -3, "ERRO"]);
  });

  it("o verificador pega um motor que errasse o piso (esperado e cenários pela conta pura)", () => {
    const d = sintetico();
    const aud = auditar(d, REGRAS_PADRAO);
    const semPiso = aud.linhas.map((x) => (x.torneioId === "t20" && x.posicao === 2 ? { ...x, esperadoCent: 700, cenarios: { A: 700, B: 630, C: 700, D: 630 } } : x));
    const div = verificar(d, REGRAS_PADRAO, semPiso, aud.torneios);
    expect(div.map((x) => [x.campo, x.motor, x.verificador])).toEqual([
      ["esperadoCent", 700, 1000],
      ["cenarioA", 700, 1000],
      ["cenarioB", 630, 1000],
      ["cenarioC", 700, 1000],
      ["cenarioD", 630, 1000],
    ]);
  });
});

describe("Etapa 1, 50K Cucurucho (28 inscritos, R$ 1.500, fator 1,2)", () => {
  async function etapa1() {
    const fx = JSON.parse(readFileSync("tests/fixtures/taua-2026.json", "utf8"));
    vi.stubGlobal("fetch", async (url: string) => {
      const u = new URL(url);
      const body = u.pathname.endsWith("/ranking") ? fx.ranking : u.pathname.endsWith("/tournaments") ? fx.tournaments : fx.playerSummaries[u.searchParams.get("name")!];
      return { ok: true, status: 200, json: async () => body };
    });
    return buscarDados("taua-2026");
  }
  const cucurucho = (aud: ReturnType<typeof auditar>) => aud.linhas.filter((l) => l.torneio === "50K Cucurucho" && l.base === 10);

  it("fixture gravado (9,36 do 7º ao 28º): esperado 10 e Erro nas 22 linhas", async () => {
    const d = await etapa1();
    const aud = auditar(d, REGRAS_PADRAO);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
    const ls = cucurucho(aud);
    expect(ls.map((l) => l.posicao).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 22 }, (_, i) => i + 7));
    for (const l of ls) {
      expect([l.field, l.fatorParticipantes, l.fatorBuyIn, l.registrado, l.esperado, l.situacao]).toEqual([28, 0.78, 1.2, 9.36, 10, "ERRO"]);
      expect(l.conta).toBe("10 × 0,78 × 1,2 = 9,36; vale o mínimo de 10");
    }
  });

  it("com os valores do site em 16/11/2026 (10 do 7º ao 28º): esperado 10, registrado 10, Correto", async () => {
    const d = await etapa1();
    const t = d.torneios.find((x) => x.name === "50K Cucurucho")!;
    for (const j of d.jogadores) for (const r of j.resultados) if (r.tournamentId === t.id && r.position != null && r.position >= 7) r.points = 10;
    const aud = auditar(d, REGRAS_PADRAO);
    expect(verificar(d, REGRAS_PADRAO, aud.linhas, aud.torneios)).toEqual([]);
    const ls = cucurucho(aud);
    expect(ls).toHaveLength(22);
    expect(ls.every((l) => l.registrado === 10 && l.esperado === 10 && l.situacao === "CORRETO" && l.cenarios.A === 1000 && l.cenarios.B === 1000)).toBe(true);
    expect(ls.filter((l) => l.posicao! >= 15)).toHaveLength(14); // 15º a 28º
    expect(aud.resumo).toMatchObject({ ERRO: 202, CORRETO: 189 }); // as 22 linhas voltam a Correto: os números de antes do piso
  });
});
