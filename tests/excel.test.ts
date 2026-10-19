import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { BASE, exportacaoXlsx, relatorioXlsx, TOPO } from "../lib/excel";
import { dadosDosGraficos, svgBarras } from "../lib/graficos-excel";
import { identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { REGRAS_PADRAO } from "../lib/regras";

// Monta os dados a partir das fixtures (sem internet), do mesmo jeito que a leitura da API faz.
function dadosDe(stage: string): DadosSpt {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  return {
    stage,
    updatedAt: { ranking: fx.ranking.updatedAt, tournaments: fx.tournaments.updatedAt },
    torneios: fx.tournaments.tournaments,
    jogadores: fx.ranking.ranking.map((p: { name: string; rank: number; points: number }) => ({
      name: p.name, rank: p.rank, rankingPoints: p.points, resultados: fx.playerSummaries[p.name].results,
    })),
  };
}

const ABAS = ["Resumo", "Erros", "Divergências de inscritos", "Jogadores", "Torneios", "Aguardando regra", "Regras", "Todos os cálculos"];
const PROIBIDOS_TEXTO = ["foraDoItm", "base10xFatores", "10fixos", "field", "buyInDiaFinalZero", "fatorBuyInAbaixo500", "aposDecimoOitavo", "satelitesPontuam", "toleranciaArredondamento", "CORRETO_SITE", "PENDENTE_REGRA", "updatedAt", "SHA-256", "UTC"];
const PROIBIDOS_PALAVRA = ["TRUE", "FALSE", "STANDALONE", "FLIGHT", "FINAL", "PARENT"].map((p) => new RegExp(`\\b${p}\\b`));
const proibidos = (t: string) => [...PROIBIDOS_TEXTO.filter((p) => t.includes(p)), ...PROIBIDOS_PALAVRA.filter((r) => r.test(t)).map((r) => r.source)];
const txt = (v: ExcelJS.CellValue): string => (v == null ? "" : typeof v === "object" ? ("richText" in v ? v.richText.map((x) => x.text).join("") : String((v as { text?: string }).text ?? "")) : String(v));

async function gerar(stage: string) {
  const dados = dadosDe(stage);
  const aud = auditar(dados, REGRAS_PADRAO);
  const id = identificador(dados);
  const buf = await relatorioXlsx(stage, dados, aud, REGRAS_PADRAO, id);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return { dados, aud, id, buf, wb, r: montarResposta(stage, dados, REGRAS_PADRAO, aud, id) };
}

async function termosProibidos(buf: Buffer, wb: ExcelJS.Workbook): Promise<string[]> {
  const textos: string[] = [];
  wb.eachSheet((ws) => {
    textos.push(ws.name, ws.headerFooter?.oddHeader ?? "", ws.headerFooter?.oddFooter ?? "");
    ws.eachRow((row) => row.eachCell((c) => textos.push(txt(c.value))));
  });
  for (const k of ["title", "subject", "creator", "lastModifiedBy", "company", "description", "keywords", "category"] as const) textos.push(String(wb[k] ?? ""));
  const z = await JSZip.loadAsync(buf);
  for (const nome of Object.keys(z.files)) {
    if (/sharedStrings\.xml$|docProps\/.*\.xml$|workbook\.xml$/.test(nome)) textos.push((await z.file(nome)!.async("string")).replace(/<[^>]+>/g, " "));
    if (/worksheets\/sheet\d+\.xml$/.test(nome)) textos.push(((await z.file(nome)!.async("string")).match(/<headerFooter[\s\S]*?<\/headerFooter>/)?.[0] ?? "").replace(/<[^>]+>/g, " "));
  }
  return textos.filter((t) => proibidos(t).length).map((t) => `${proibidos(t)} em "${t.slice(0, 50)}"`);
}

describe("Excel do Relatório (painel de auditoria)", () => {
  it("Etapa 2: abas, Resumo, identificador, todos os cálculos, termos e gráficos", async () => {
    const { wb, id, r, buf, aud } = await gerar("vale-suico-2026");
    expect(wb.worksheets.map((w) => w.name)).toEqual(ABAS);
    expect(wb.title).toBe("Auditoria do Ranking — Suprema Poker Tour");

    const rs = wb.getWorksheet("Resumo")!;
    const achar = (t: string) => { let c: ExcelJS.Cell | undefined; rs.eachRow((row) => row.eachCell((x) => { if (!c && txt(x.value) === t) c = x; })); return c; };
    const abaixo = (t: string) => rs.getCell(achar(t)!.row + 1, achar(t)!.col).value;
    expect([abaixo("Erros"), abaixo("Pontos em discordância"), abaixo("Jogadores afetados"), abaixo("Divergências de inscritos"), abaixo("Aguardando regra"), abaixo("Resultados corretos (entre os conferidos)")]).toEqual([10, 3155.65, 10, 0, 126, 93.1]);
    expect(achar("Etapa 2: 10 resultados com pontuação diferente da regra, afetando 10 jogadores (3.155,65 pontos em discordância). 126 resultados aguardam definição de regra.")).toBeDefined();
    expect(txt(rs.getCell(4, 8).value)).toContain(`Identificador ${id.sha256.slice(0, 8)}`);
    expect(rs.pageSetup).toMatchObject({ fitToPage: true, fitToWidth: 1, fitToHeight: 1, orientation: "landscape", paperSize: 9 });
    expect(rs.getImages()).toHaveLength(4); // logo + 3 gráficos

    const tc = wb.getWorksheet("Todos os cálculos")!;
    expect(tc.rowCount - 1).toBe(270);
    const cont: Record<string, number> = {};
    for (let i = 2; i <= tc.rowCount; i++) { const s = txt(tc.getCell(i, 15).value); cont[s] = (cont[s] ?? 0) + 1; }
    expect(cont).toEqual({ Correto: 134, Erro: 10, "Aguardando regra": 126 });

    const erros = wb.getWorksheet("Erros")!;
    const nomes: string[] = [];
    erros.eachRow((row, i) => { if (i > 1 && typeof row.getCell(4).value === "number") nomes.push(txt(row.getCell(2).value)); });
    expect(nomes).toHaveLength(10);
    expect(nomes).toContain("Emerson Rocha Sheik");

    expect(await termosProibidos(buf, wb)).toEqual([]);

    // gráficos: a soma dos dados é a soma da tabela correspondente
    const g = dadosDosGraficos(r);
    const soma = (xs: { valor: number }[]) => Math.round(xs.reduce((a, x) => a + x.valor, 0) * 100) / 100;
    expect(soma(g.torneios)).toBe(3155.65);
    expect(soma(g.causas)).toBe(3155.65);
    const tt = wb.getWorksheet("Torneios")!;
    let porTorneio = 0;
    for (let i = 2; i <= tt.rowCount; i++) porTorneio += Number(tt.getCell(i, 12).value) || 0;
    expect(Math.round(porTorneio * 100) / 100).toBe(soma(g.torneios));
    const jg = wb.getWorksheet("Jogadores")!;
    const dif: Record<string, number> = {};
    for (let i = 2; i <= jg.rowCount; i++) dif[txt(jg.getCell(i, 1).value)] = Number(jg.getCell(i, 6).value);
    expect(Math.round(g.jogadores.reduce((a, x) => a + Math.abs(dif[x.rotulo]), 0) * 100) / 100).toBe(soma(g.jogadores));
    expect(aud.resumo.total).toBe(270);
  });

  it("Etapa 1: sem erros, com 5 divergências e gráficos vazios sem quebrar", async () => {
    const { wb, r, buf } = await gerar("taua-2026");
    expect(wb.worksheets.map((w) => w.name)).toEqual(ABAS);
    expect(r.painel.veredito).toContain("Nenhum erro de pontuação encontrado");
    const dv = wb.getWorksheet("Divergências de inscritos")!;
    expect(dv.rowCount - 1).toBe(5);
    expect(wb.getWorksheet("Todos os cálculos")!.rowCount - 1).toBe(642);
    expect(wb.getWorksheet("Resumo")!.getImages()).toHaveLength(4);
    expect(dadosDosGraficos(r)).toEqual({ torneios: [], causas: [], jogadores: [] });
    expect(await termosProibidos(buf, wb)).toEqual([]);
  });

  it("gráfico sem dados mostra a frase e a faixa escura usa as cores da logo do globals.css", () => {
    expect(svgBarras("Título", [], 424, 290, "#C40F14")).toContain("Nenhuma diferença encontrada");
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain(`--logo-fundo-topo: #${TOPO.slice(2).toLowerCase()}`);
    expect(css).toContain(`--logo-fundo-base: #${BASE.slice(2).toLowerCase()}`);
  });
});

describe("Excel da Exportação de dados", () => {
  it("Etapa 2: tabela simples, 16 colunas, aba de identificação", async () => {
    const dados = dadosDe("vale-suico-2026");
    const aud = auditar(dados, REGRAS_PADRAO);
    const id = identificador(dados);
    const buf = await exportacaoXlsx(dados, aud, id);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Dados", "Identificação"]);
    const d = wb.getWorksheet("Dados")!;
    expect(d.rowCount - 1).toBe(270);
    expect(d.getRow(1).values).toContain("Fator de participantes");
    expect(d.autoFilter).toBeTruthy();
    const info = Object.fromEntries(wb.getWorksheet("Identificação")!.getRows(1, 6)!.map((x) => [txt(x.getCell(1).value), txt(x.getCell(2).value)]));
    expect(info["Identificador"]).toBe(id.sha256.slice(0, 8));
    expect(info["Etapa"]).toBe("Etapa 2 — Vale Suíço Resort");
    expect(await termosProibidos(buf, wb)).toEqual([]);
  });
});
