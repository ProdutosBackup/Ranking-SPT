import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { auditar } from "../lib/auditoria";
import { conferir, identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { lerPlanilha, LIMITE_BYTES, MSG_GRANDE, MSG_NAO_XLSX, type DadosPlanilha } from "../lib/planilha";
import { REGRAS_PADRAO } from "../lib/regras";

const ARQUIVO = readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx");
const ENVIO = { enviadoEm: new Date("2026-10-21T12:00:00Z"), arquivo: "ranking-spt-3a-etapa.xlsx", stage: "bendito-cacao-2026" };

/** Abre o exemplar, aplica a mudança e devolve os bytes do novo .xlsx. */
async function variante(mudar: (wb: ExcelJS.Workbook) => void) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(ARQUIVO as unknown as ExcelJS.Buffer);
  mudar(wb);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
const aba = (wb: ExcelJS.Workbook, nome: string) => wb.getWorksheet(nome)!;
async function ler(mudar: (wb: ExcelJS.Workbook) => void) {
  return lerPlanilha(await variante(mudar), ENVIO);
}
const bloqueio = async (mudar: (wb: ExcelJS.Workbook) => void) => {
  const r = await ler(mudar);
  if (r.ok) throw new Error("era para bloquear");
  return r.erros.join("\n");
};
const avisosDe = async (mudar: (wb: ExcelJS.Workbook) => void) => {
  const r = await ler(mudar);
  if (!r.ok) throw new Error(`bloqueou: ${r.erros.join(" | ")}`);
  return r.avisos.join("\n");
};

describe("leitura do exemplar", () => {
  let dados: DadosPlanilha;
  let avisos: string[];
  let resumo: Extract<Awaited<ReturnType<typeof lerPlanilha>>, { ok: true }>["resumo"];
  beforeAll(async () => {
    const r = await lerPlanilha(new Uint8Array(ARQUIVO), ENVIO);
    if (!r.ok) throw new Error(r.erros.join(" | "));
    ({ dados, avisos, resumo } = r);
  });

  it("contagens e soma", () => {
    expect(resumo).toMatchObject({ torneios: 11, jogadores: 241, linhas: 554, somaPontos: 102141.55, porTipo: { FINAL: 1, STANDALONE: 10 }, consolidadoConferido: true });
    expect(dados.jogadores.reduce((a, j) => a + j.rankingPoints, 0)).toBeCloseTo(102141.55, 2);
    expect(dados.jogadores.reduce((a, j) => a + j.resultados.length, 0)).toBe(554);
    expect(dados.origem).toEqual({ tipo: "planilha", arquivo: "ranking-spt-3a-etapa.xlsx", premiadosInferidos: true });
  });

  it("papéis, buy-in e inscritos do motor", () => {
    const final = dados.torneios.filter((t) => t.role === "FINAL");
    expect(final.map((t) => [t.name, t.buyIn, t.players])).toEqual([["Main Event SPT - Dia Final", 0, 79]]);
    expect(dados.torneios.every((t) => t.status === "FINISHED" && t.flightLabel == null)).toBe(true);
    expect(new Set(dados.torneios.map((t) => t.id)).size).toBe(11);
  });

  it("prêmio inferido: só linhas com pontos diferentes de 10", () => {
    for (const j of dados.jogadores) for (const r of j.resultados) expect(r.prize != null).toBe(r.points !== 10);
  });

  it("linhas com — viram posição nula, contadas por aba", () => {
    expect(resumo.semColocacaoPorAba).toMatchObject({ "SUPER K.O": 28, "100K OMAHA MYSTERY BOUNTY": 15, "PLO-NLH DEALER´S CHOICE PIJAMA": 13, "Main Event SPT - Dia Final": 135, "SECOND CHANCE": 1, HORSE: 0 });
    const nulas = dados.jogadores.flatMap((j) => j.resultados).filter((r) => r.position == null).length;
    expect(nulas).toBe(Object.values(resumo.semColocacaoPorAba).reduce((a, b) => a + b, 0));
  });

  it("fatos observados: posição 14 repetida no OMAHA e posição máxima 110 no CHAMPIONSHIP com 65 linhas", () => {
    const posicoes = (nome: string) => {
      const id = dados.torneios.find((t) => t.name === nome)!.id;
      return dados.jogadores.flatMap((j) => j.resultados).filter((r) => r.tournamentId === id).map((r) => r.position);
    };
    const omaha = posicoes("OMAHA DEALER´S CHOICE");
    expect(omaha.filter((p) => p === 14)).toHaveLength(2);
    const champ = posicoes("CHAMPIONSHIP HIGH ROLLER 200K");
    expect(champ).toHaveLength(65);
    expect(Math.max(...(champ as number[]))).toBe(110);
    expect(avisos.some((a) => a.includes("OMAHA DEALER´S CHOICE") && a.includes("posição repetida: 14"))).toBe(true);
    expect(avisos.some((a) => a.includes("CHAMPIONSHIP") && a.includes("faltam posições entre 1 e 110"))).toBe(true);
  });

  it("avisos do exemplar: só posição repetida e posições faltando", () => {
    expect(avisos.filter((a) => !/posição repetida|faltam posições/.test(a))).toEqual([]);
  });

  it("hash estável e que muda se um ponto mudar", async () => {
    const outra = await lerPlanilha(new Uint8Array(ARQUIVO), { ...ENVIO, enviadoEm: new Date("2027-01-01T00:00:00Z") });
    if (!outra.ok) throw new Error("falhou");
    expect(identificador(outra.dados).sha256).toBe(identificador(dados).sha256);
    const mudou = await lerPlanilha(await variante((wb) => (aba(wb, "HORSE").getCell("C9").value = 553)), ENVIO);
    if (!mudou.ok) throw new Error("falhou");
    expect(identificador(mudou.dados).sha256).not.toBe(identificador(dados).sha256);
  });
});

describe("bloqueios", () => {
  it("arquivo que não é .xlsx", async () => {
    const texto = await lerPlanilha(new TextEncoder().encode("isto não é uma planilha"), ENVIO);
    expect(texto).toMatchObject({ ok: false, erros: [MSG_NAO_XLSX] });
    const zipRuim = await lerPlanilha(new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5, 6]), ENVIO);
    expect(zipRuim).toMatchObject({ ok: false, erros: [MSG_NAO_XLSX] });
  });
  it("arquivo acima de 4 MB", async () => {
    const r = await lerPlanilha(new Uint8Array(LIMITE_BYTES + 1), ENVIO);
    expect(r).toMatchObject({ ok: false, erros: [MSG_GRANDE] });
    expect(MSG_GRANDE).toContain("4 MB");
  });
  it("aba de torneio sem Posição ou sem Jogador", async () => {
    expect(await bloqueio((wb) => (aba(wb, "HORSE").getCell("A7").value = "Colocação"))).toContain('Na aba "HORSE" não encontrei a linha de colunas com "Posição" e "Jogador"');
    expect(await bloqueio((wb) => (aba(wb, "HORSE").getCell("B7").value = "Nome"))).toContain('Na aba "HORSE" não encontrei a linha de colunas');
  });
  it("pontos não numéricos ou negativos", async () => {
    expect(await bloqueio((wb) => (aba(wb, "HORSE").getCell("C9").value = "muitos"))).toContain('Aba "HORSE": linha 9');
    expect(await bloqueio((wb) => (aba(wb, "HORSE").getCell("C9").value = -5))).toContain("pontos não numéricos ou negativos");
  });
  it("ID repetido na mesma aba", async () => {
    const msg = await bloqueio((wb) => {
      const ws = aba(wb, "HORSE");
      ws.getCell("D9").value = ws.getCell("D8").value;
      ws.getCell("B9").value = ws.getCell("B8").value;
    });
    expect(msg).toContain("aparece mais de uma vez na aba");
  });
  it("mesmo ID com nomes diferentes", async () => {
    const msg = await bloqueio((wb) => (aba(wb, "HORSE").getCell("B9").value = "Outro Nome Qualquer")); // Marcelo Lanza também joga outros torneios
    expect(msg).toContain("aparece com nomes diferentes");
  });
  it("torneio sem buy-in ou sem inscritos numéricos", async () => {
    expect(await bloqueio((wb) => (aba(wb, "HORSE").getCell("B3").value = "grátis"))).toContain('Aba "HORSE": o torneio não tem buy-in numérico');
    expect(await bloqueio((wb) => (aba(wb, "HORSE").getCell("B4").value = null))).toContain('Aba "HORSE": o torneio não tem número de inscritos');
  });
  it("nenhuma aba de torneio", async () => {
    const msg = await bloqueio((wb) => wb.worksheets.filter((w) => w.name !== "Consolidado").forEach((w) => wb.removeWorksheet(w.id)));
    expect(msg).toContain("nenhuma aba de torneio");
  });
  it("vários problemas aparecem juntos", async () => {
    const msg = await bloqueio((wb) => {
      aba(wb, "HORSE").getCell("C9").value = "x";
      aba(wb, "SUPER K.O").getCell("B3").value = "x";
    });
    expect(msg).toContain('Aba "HORSE"');
    expect(msg).toContain('Aba "SUPER K.O"');
  });
});

describe("avisos", () => {
  it("posição repetida", async () => {
    expect(await avisosDe((wb) => (aba(wb, "HORSE").getCell("A10").value = 1))).toContain('Aba "HORSE": posição repetida: 1');
  });
  it("saltos de posição", async () => {
    expect(await avisosDe((wb) => (aba(wb, "HORSE").getCell("A11").value = 30))).toContain('Aba "HORSE": faltam posições entre 1 e 30');
  });
  it('"Inscritos" diferente do bloco lateral', async () => {
    expect(await avisosDe((wb) => (aba(wb, "HORSE").getCell("B4").value = 20))).toContain('Aba "HORSE": "Inscritos" (20) é diferente dos buy-ins do bloco lateral (19)');
  });
  it("soma diferente do Total da aba", async () => {
    expect(await avisosDe((wb) => (aba(wb, "HORSE").getCell("C9").value = 553))).toMatch(/Aba "HORSE": a soma dos pontos \(2\.290\) é diferente do total da aba \(2\.289\)/);
  });
  it("soma diferente da Consolidado (total geral e por jogador)", async () => {
    const a = await avisosDe((wb) => {
      const c = aba(wb, "Consolidado");
      c.getCell("D247").value = 1;
      c.getCell("D6").value = 5;
    });
    expect(a).toContain('é diferente do total da aba "Consolidado" (1)');
    expect(a).toContain('O total de 1 jogador(es) não bate com a aba "Consolidado": PEDRO HERNESTO ZUCCARATO BAROSSI');
  });
  it("abas desconhecidas são ignoradas", async () => {
    const a = await avisosDe((wb) => (wb.addWorksheet("Anotações").getCell("A1").value = "lembrete"));
    expect(a).toContain('A aba "Anotações" não parece um torneio e foi ignorada.');
  });
  it("mesmo nome com IDs diferentes: mantém as duas pessoas, com sufixo e aviso", async () => {
    const r = await ler((wb) => {
      const ws = aba(wb, "HORSE");
      ws.getCell("D9").value = "11111111-2222-3333-4444-555555555555"; // outra pessoa, ainda chamada "Marcelo Lanza"
    });
    if (!r.ok) throw new Error(r.erros.join(" | "));
    expect(r.avisos.join("\n")).toContain('O nome "Marcelo Lanza" aparece com 2 IDs diferentes');
    const nomes = r.dados.jogadores.map((j) => j.name).filter((n) => n.startsWith("Marcelo Lanza"));
    expect(nomes.sort()).toEqual(["Marcelo Lanza (0387)", "Marcelo Lanza (1111)"]);
    expect(new Set(r.dados.jogadores.map((j) => j.name)).size).toBe(r.dados.jogadores.length);
  });
});

describe("leitura por rótulo", () => {
  it("bloco lateral em outra posição", async () => {
    const mover = (lateral: number) => (wb: ExcelJS.Workbook) => {
      const ws = aba(wb, "HORSE");
      for (const e of ["E3", "F2", "F3", "G2", "G3"]) ws.getCell(e).value = null;
      ws.getCell("J12").value = "BUY IN";
      ws.getCell("J13").value = lateral;
      ws.getCell("K12").value = "REENTRY";
      ws.getCell("K13").value = 4;
    };
    const igual = await ler(mover(19));
    if (!igual.ok) throw new Error(igual.erros.join(" | "));
    expect(igual.avisos.filter((a) => a.includes("bloco lateral"))).toEqual([]);
    expect(await avisosDe(mover(20))).toContain('"Inscritos" (19) é diferente dos buy-ins do bloco lateral (20)');
  });
  it("sem bloco lateral não há aviso nem bloqueio", async () => {
    const r = await ler((wb) => {
      const ws = aba(wb, "HORSE");
      for (const e of ["E3", "F2", "F3", "G2", "G3"]) ws.getCell(e).value = null;
    });
    expect(r.ok).toBe(true);
  });
  it("aba Consolidado ausente", async () => {
    const r = await ler((wb) => wb.removeWorksheet(aba(wb, "Consolidado").id));
    if (!r.ok) throw new Error(r.erros.join(" | "));
    expect(r.resumo).toMatchObject({ torneios: 11, jogadores: 241, linhas: 554, consolidadoConferido: false });
    expect(r.avisos.filter((a) => a.includes("Consolidado"))).toEqual([]);
  });
  it("nomes normalizados (espaços e Unicode)", async () => {
    const r = await ler((wb) => {
      aba(wb, "HORSE").getCell("B8").value = "  Luke   James  Zinger ";
      aba(wb, "HORSE").getCell("B10").value = "Carlos Felipe Verlangieri Difini".normalize("NFD");
    });
    if (!r.ok) throw new Error(r.erros.join(" | "));
    const nomes = new Set(r.dados.jogadores.map((j) => j.name));
    expect(nomes.has("Luke James Zinger")).toBe(true);
    expect(nomes.has("Carlos Felipe Verlangieri Difini")).toBe(true);
    expect(r.dados.jogadores).toHaveLength(241);
  });
});

describe("integração com o motor", () => {
  const CAMPO_FINAL = (d: DadosPlanilha, inscritos: number): DadosPlanilha => ({
    ...d,
    torneios: d.torneios.map((t) => (t.role === "FINAL" ? { ...t, players: inscritos } : t)),
  });
  let base: DadosPlanilha;
  beforeAll(async () => {
    const r = await lerPlanilha(new Uint8Array(ARQUIVO), ENVIO);
    if (!r.ok) throw new Error(r.erros.join(" | "));
    base = r.dados;
  });
  const rodar = (d: DadosPlanilha, foraDoItm: "base10xFatores" | "10fixos") => {
    const regras = { ...REGRAS_PADRAO, foraDoItm };
    const aud = auditar(d, regras);
    expect(() => conferir(d, regras, aud)).not.toThrow(); // o verificador independente concorda
    return aud;
  };

  it('10 fixos, Dia Final com 328: só os três campeões erram', () => {
    const aud = rodar(CAMPO_FINAL(base, 328), "10fixos");
    expect(aud.resumo).toMatchObject({ total: 554, CORRETO: 551, CORRETO_SITE: 0, ERRO: 3, SUSPEITO: 0, PENDENTE_REGRA: 0 });
    const erros = aud.linhas.filter((l) => l.situacao === "ERRO").map((l) => [l.torneio, l.posicao, l.registrado, l.esperado]);
    expect(erros.sort()).toEqual([
      ["CHAMPIONSHIP HIGH ROLLER 200K", 1, 2300, 2875],
      ["HIGH ROLLER 50K", 1, 972, 1215],
      ["SUPER K.O", 1, 672, 840],
    ]);
  });

  it("10 fixos, Dia Final com os 79 da planilha: o motor aponta sozinho os 328", () => {
    const aud = rodar(base, "10fixos");
    expect(aud.resumo).toMatchObject({ total: 554, CORRETO: 487, CORRETO_SITE: 64, ERRO: 3, PENDENTE_REGRA: 0 });
    const final = aud.torneios.find((t) => t.torneio.includes("Dia Final")) as unknown as { achado: { fieldApi: number; fieldSite: number; linhasExplicadas: number } };
    expect(final.achado).toMatchObject({ fieldApi: 79, fieldSite: 328, linhasExplicadas: 64 });
  });

  it("regra padrão (10 × fatores), Dia Final com 328: 276 erros (3 campeões + 273 linhas de 10 fixos)", () => {
    const aud = rodar(CAMPO_FINAL(base, 328), "base10xFatores");
    expect(aud.resumo).toMatchObject({ total: 554, CORRETO: 278, ERRO: 276, PENDENTE_REGRA: 0 });
    expect(aud.linhas.filter((l) => l.situacao === "ERRO" && l.registrado === 10)).toHaveLength(273);
  });

  it("regra padrão com os inscritos da planilha (79): as 64 linhas premiadas do Dia Final também erram", () => {
    const aud = rodar(base, "base10xFatores");
    expect(aud.resumo).toMatchObject({ total: 554, CORRETO: 214, CORRETO_SITE: 0, ERRO: 340, PENDENTE_REGRA: 0 });
    const final = aud.linhas.filter((l) => l.torneio.includes("Dia Final") && l.situacao === "ERRO" && l.registrado !== 10);
    expect(final).toHaveLength(64);
    expect(final.every((l) => /328 inscritos/.test(l.causaProvavel ?? ""))).toBe(true);
  });
});

describe("buy-ins, re-entries e ações (bloco lateral)", () => {
  let dados: DadosPlanilha;
  beforeAll(async () => {
    const r = await lerPlanilha(new Uint8Array(ARQUIVO), ENVIO);
    if (!r.ok) throw new Error(r.erros.join(" | "));
    dados = r.dados;
  });
  const painel = (d: DadosPlanilha) => {
    const aud = auditar(d, REGRAS_PADRAO);
    return montarResposta("bendito-cacao-2026", d, REGRAS_PADRAO, aud, identificador(d)).painel.torneios;
  };

  it("HIGH ROLLER 50K: buy-ins 31, re-entries 30, ações 61", () => {
    const t = painel(dados).find((x) => x.nome === "HIGH ROLLER 50K")!;
    expect([t.inscritos, t.buyIns, t.reentries, t.acoes]).toEqual([31, 31, 30, 61]);
  });

  it("as 11 abas: ações = buy-ins + re-entries; REENTRADA (PIJAMA) também é lido; o Dia Final não tem re-entries", () => {
    const por = Object.fromEntries(painel(dados).map((t) => [t.nome, [t.buyIns, t.reentries, t.acoes]]));
    expect(por).toEqual({
      "200K OMAHA 5 K.O": [30, 36, 66],
      HORSE: [19, 4, 23],
      "SUPER K.O": [34, 9, 43],
      "8 GAME": [14, 4, 18],
      "100K OMAHA MYSTERY BOUNTY": [25, 43, 68],
      "CHAMPIONSHIP HIGH ROLLER 200K": [65, 20, 85],
      "PLO-NLH DEALER´S CHOICE PIJAMA": [20, 12, 32],
      "Main Event SPT - Dia Final": [79, null, null],
      "SECOND CHANCE": [79, 94, 173],
      "HIGH ROLLER 50K": [31, 30, 61],
      "OMAHA DEALER´S CHOICE": [23, 31, 54],
    });
  });

  it("nenhum torneio do exemplar tem buy-ins diferente de inscritos", () => {
    expect(painel(dados).filter((t) => t.buyIns != null && t.buyIns !== t.inscritos)).toEqual([]);
  });

  it("o field do cálculo continua sendo só os inscritos (buy-ins), nunca as ações", () => {
    const aud = auditar(dados, REGRAS_PADRAO);
    const t = aud.linhas.find((l) => l.torneio === "HIGH ROLLER 50K")!;
    expect(t.field).toBe(31);
  });

  it("ler o bloco lateral em outra posição também traz re-entries", async () => {
    const r = await lerPlanilha(
      await variante((wb) => {
        const ws = aba(wb, "HORSE");
        for (const e of ["E3", "F2", "F3", "G2", "G3"]) ws.getCell(e).value = null;
        ws.getCell("J12").value = "BUY IN";
        ws.getCell("J13").value = 19;
        ws.getCell("K12").value = "REENTRY";
        ws.getCell("K13").value = 4;
      }),
      ENVIO,
    );
    if (!r.ok) throw new Error(r.erros.join(" | "));
    expect(painel(r.dados).find((x) => x.nome === "HORSE")).toMatchObject({ buyIns: 19, reentries: 4, acoes: 23 });
  });

  it("buy-ins diferente de inscritos fica visível nos dados", async () => {
    const r = await lerPlanilha(await variante((wb) => (aba(wb, "HORSE").getCell("G3").value = 4) && (aba(wb, "HORSE").getCell("F3").value = 18)), ENVIO);
    if (!r.ok) throw new Error(r.erros.join(" | "));
    const t = painel(r.dados).find((x) => x.nome === "HORSE")!;
    expect([t.inscritos, t.buyIns, t.buyIns !== t.inscritos]).toEqual([19, 18, true]);
  });

  it("etapas do site: o site não informa re-entries, então tudo fica nulo (a tela mostra — e \"não informado pelo site\")", async () => {
    const fx = JSON.parse(readFileSync("tests/fixtures/vale-suico-2026.json", "utf8"));
    const chaves = new Set<string>(fx.tournaments.tournaments.flatMap((t: object) => Object.keys(t)));
    expect([...chaves].filter((k) => /entr|reent|acoes|buyins/i.test(k))).toEqual([]); // a API não tem contagem de entradas
    const t = auditar({ stage: "x", updatedAt: { ranking: "", tournaments: "" }, torneios: fx.tournaments.tournaments, jogadores: [] }, REGRAS_PADRAO).torneios;
    expect(t.every((x) => x.buyIns === null && x.reentries === null)).toBe(true);
  });
});
