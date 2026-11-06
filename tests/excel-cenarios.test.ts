import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { CENARIOS_COLUNAS, exportacaoXlsx, INSUFICIENTE, relatorioXlsx } from "../lib/excel";
import { identificador } from "../lib/integridade";
import { dadosDaPlanilha } from "../lib/planilha-guardada";
import { REGRAS_PADRAO, VERSAO_REGRAS } from "../lib/regras";
import { BOUNTY_API } from "./bounty-mock";

const E1 = "taua-2026";
const E2 = "vale-suico-2026";
const E3 = "bendito-cacao-2026";
const FLIGHTS = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: `1${"ABCDE"[i]}`, status: "FINISHED" }));
const txt = (v: ExcelJS.CellValue): string => (v == null ? "" : typeof v === "object" ? ("richText" in v ? v.richText.map((x) => x.text).join("") : String((v as { text?: string }).text ?? "")) : String(v));

function dadosSite(stage: string): DadosSpt {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  return {
    stage,
    updatedAt: { ranking: fx.ranking.updatedAt, tournaments: fx.tournaments.updatedAt },
    torneios: fx.tournaments.tournaments,
    jogadores: fx.ranking.ranking.map((p: { name: string; rank: number; points: number }) => ({ name: p.name, rank: p.rank, rankingPoints: p.points, resultados: fx.playerSummaries[p.name].results })),
  };
}
async function dadosPlanilha(): Promise<DadosSpt> {
  vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ tournaments: [...FLIGHTS, ...BOUNTY_API] }) }));
  const registro = { arquivo: "ranking-spt-3a-etapa.xlsx", enviadoEm: "2026-11-05T00:00:00Z", tamanho: 1, sha256: "x", inscritosDiaFinal: null, resumo: {}, avisos: [] };
  return dadosDaPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), registro as never);
}
afterEach(() => vi.unstubAllGlobals());

const COLUNAS_1_A_18 = [
  "Jogador", "Torneio", "Posição", "Prêmio (R$)", "Buy-in (R$)", "Inscritos usados", "Premiados", "Base da posição", "Fator de participantes", "Fator de buy-in",
  "Conta correta", "Pontos corretos", "Pontos no site", "Diferença", "Situação", "Categoria", "Acordo", "Causa (hipótese)",
];
const COLUNAS_NOVAS = ["A · Só entradas · fator 1,0", "B · Só entradas · fator 0,9", "C · Total de ações · fator 1,0", "D · Total de ações · fator 0,9", "Motivo (dados insuficientes)"];

async function abrir(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}

async function conferir(stage: string, dados: DadosSpt, esperado: { insuficientes: number; zero?: number; comValor?: number }) {
  const aud = auditar(dados, REGRAS_PADRAO);
  const id = identificador(dados);
  const rel = await abrir(await relatorioXlsx(stage, dados, aud, REGRAS_PADRAO, id));
  const exp = await abrir(await exportacaoXlsx(dados, aud, id));
  const abas = [rel.getWorksheet("Todos os cálculos")!, exp.getWorksheet("Dados")!];
  const n = aud.linhas.length;
  const aguardando = aud.linhas.filter((l) => l.situacao === "PENDENTE_REGRA").length;
  let insuf = { C: 0, D: 0 };
  for (const ws of abas) {
    expect(ws.rowCount - 1).toBe(n);
    expect(CENARIOS_COLUNAS.map((h, i) => txt(ws.getCell(1, 19 + i).value))).toEqual(COLUNAS_NOVAS.slice(0, 4));
    expect([...Array(23).keys()].map((i) => txt(ws.getCell(1, i + 1).value))).toEqual([...COLUNAS_1_A_18, ...COLUNAS_NOVAS]);
    insuf = { C: 0, D: 0 };
    let zeros = 0;
    let valores = 0;
    aud.linhas.forEach((l, i) => {
      const row = ws.getRow(i + 2);
      (["A", "B", "C", "D"] as const).forEach((k, j) => {
        const cell = row.getCell(19 + j);
        if (l.situacao === "PENDENTE_REGRA") expect(cell.value ?? null, `${k} vazio em aguardando`).toBeNull();
        else if (l.cenarios[k] == null) {
          expect(cell.value).toBe(INSUFICIENTE);
          expect(cell.fill).toMatchObject({ fgColor: { argb: "FFEFEFF1" } });
          if (k === "C") insuf.C++;
          if (k === "D") insuf.D++;
        } else {
          expect(cell.value).toBe(l.cenarios[k]! / 100); // ao centésimo
          if (k === "C") l.cenarios.C === 0 ? zeros++ : valores++;
        }
      });
      const motivo = txt(row.getCell(23).value);
      if (l.situacao !== "PENDENTE_REGRA" && l.cenarios.C == null) expect(motivo).toMatch(new RegExp(`^Etapa ${stage === E1 ? 1 : stage === E2 ? 2 : 3}: .+ \\(1 linha\\)$`));
      else expect(motivo).toBe("");
      // colunas 1 a 18 não mudam: Pontos corretos continua vazio em aguardando e igual ao motor nas demais
      expect(row.getCell(12).value ?? null).toBe(l.situacao === "PENDENTE_REGRA" ? null : l.esperado);
    });
    if (esperado.zero != null) expect(zeros).toBe(esperado.zero);
    if (esperado.comValor != null) expect(valores).toBe(esperado.comValor);
    expect(insuf.C).toBe(esperado.insuficientes);
    expect(insuf.D).toBe(esperado.insuficientes);
  }
  // Relatório e Exportação têm as mesmas 18 primeiras colunas
  for (let i = 2; i <= n + 1; i++) for (let c = 1; c <= 18; c++) expect(txt(abas[0].getCell(i, c).value)).toBe(txt(abas[1].getCell(i, c).value));
  // Identificação (Exportação)
  const info = new Map(exp.getWorksheet("Identificação")!.getRows(1, 40)!.map((x) => [txt(x.getCell(1).value), txt(x.getCell(2).value)]));
  expect(info.get("Versão das regras")).toBe(VERSAO_REGRAS);
  expect(info.get("Fatores incluídos")).toContain("1,0 e 0,9");
  expect(info.get("Linhas com dados insuficientes no cenário C")).toBe(String(esperado.insuficientes));
  expect(info.get("Linhas com dados insuficientes no cenário D")).toBe(String(esperado.insuficientes));
  for (const k of ["A", "B", "C", "D"]) expect(info.get(`Cenário ${k}`)).toBeTruthy();
  // Regras (Relatório)
  const regras: string[] = [];
  rel.getWorksheet("Regras")!.eachRow((row) => regras.push(txt(row.getCell(1).value)));
  expect(regras).toContain("Cenários A a D");
  expect(regras).toContain(`Versão das regras: ${VERSAO_REGRAS}`);
  expect(regras.filter((x) => /^Cenário [ABCD]: /.test(x))).toHaveLength(4);
  return { n, aguardando, insuf };
}

describe("cenários A a D no Excel", () => {
  it("Etapa 1: 598 linhas com C e D null mostram o texto e o motivo; 44 valem 0", async () => {
    const r = await conferir(E1, dadosSite(E1), { insuficientes: 598, zero: 44 });
    expect(r.n).toBe(642);
  });
  it("Etapa 2: todas as 270 linhas mostram Dados insuficientes", async () => {
    const r = await conferir(E2, dadosSite(E2), { insuficientes: 270, zero: 0, comValor: 0 });
    expect(r.n).toBe(270);
  });
  it("Etapa 3 (planilha de teste): 214 do Dia Final sem dados; 340 comuns com valor", async () => {
    const dados = await dadosPlanilha();
    const r = await conferir(E3, dados, { insuficientes: 214 });
    expect(r.n).toBe(554);
    const c = auditar(dados, REGRAS_PADRAO).linhas.filter((l) => l.situacao !== "PENDENTE_REGRA" && l.cenarios.C != null).length;
    expect(c).toBe(340);
  });
});

describe("identificador cobre reentradas e versão das regras", () => {
  it("mesmos dados, mesmo identificador; mudar uma reentrada ou buy-ins muda", async () => {
    const d = await dadosPlanilha();
    const a = identificador(d).sha256;
    expect(identificador(structuredClone(d)).sha256).toBe(a);
    const alt = structuredClone(d);
    const t = alt.torneios.find((x) => x.reentries != null)!;
    t.reentries = t.reentries! + 1;
    expect(identificador(alt).sha256).not.toBe(a);
    const alt2 = structuredClone(d);
    const t2 = alt2.torneios.find((x) => x.buyIns != null)!;
    t2.buyIns = t2.buyIns! + 1;
    expect(identificador(alt2).sha256).not.toBe(a);
  });
  it("a versão das regras entra no hash", () => {
    const site = dadosSite(E2);
    expect(identificador(site).sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(identificador(site).versaoRegras).toBe(VERSAO_REGRAS);
  });
});

describe("linhas aguardando regra", () => {
  it("as 4 células de cenário e o motivo ficam vazios, mesmo que o motor entregue valor", async () => {
    const dados = dadosSite(E2);
    const aud = auditar(dados, REGRAS_PADRAO);
    expect(aud.linhas.filter((l) => l.situacao === "PENDENTE_REGRA")).toHaveLength(0); // nas fixtures reais não há nenhuma: forço duas
    for (const i of [3, 10]) aud.linhas[i].situacao = "PENDENTE_REGRA";
    const exp = await abrir(await exportacaoXlsx(dados, aud, identificador(dados)));
    const ws = exp.getWorksheet("Dados")!;
    for (const i of [3, 10]) {
      expect([19, 20, 21, 22, 23].map((c) => ws.getRow(i + 2).getCell(c).value ?? null)).toEqual([null, null, null, null, ""]);
      expect(ws.getRow(i + 2).getCell(12).value ?? null).toBeNull(); // Pontos corretos também vazio, como já era
    }
    const info = new Map(exp.getWorksheet("Identificação")!.getRows(1, 40)!.map((x) => [txt(x.getCell(1).value), txt(x.getCell(2).value)]));
    expect(info.get("Linhas com dados insuficientes no cenário C")).toBe("268"); // 270 − 2 aguardando; elas não entram na contagem
  });
});
