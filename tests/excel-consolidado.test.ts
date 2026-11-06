import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DadosSpt } from "../lib/api-spt";
import { auditar } from "../lib/auditoria";
import { consolidar } from "../lib/consolidado";
import { ETAPAS_SLUGS, etapaParaConsolidar } from "../lib/consolidado-etapas";
import { relatorioXlsx } from "../lib/excel";
import { identificador } from "../lib/integridade";
import { montarResposta } from "../lib/painel";
import { dadosDaPlanilha } from "../lib/planilha-guardada";
import { REGRAS_PADRAO } from "../lib/regras";
import { BOUNTY_API } from "./bounty-mock";
import { CONSOLIDADO } from "../app/components/estrutura";

const FLIGHTS = [77, 64, 55, 67, 65].map((players, i) => ({ id: `f${i}`, name: `Dia 1 ${"ABCDE"[i]}`, buyIn: 1000, players, role: "FLIGHT", flightLabel: `1${"ABCDE"[i]}`, status: "FINISHED" }));
afterEach(() => vi.unstubAllGlobals());
const txt = (v: ExcelJS.CellValue) => (v == null ? "" : typeof v === "object" ? ("richText" in v ? v.richText.map((x) => x.text).join("") : String((v as { text?: string }).text ?? "")) : String(v));

async function dadosDe(stage: string): Promise<DadosSpt> {
  if (stage === ETAPAS_SLUGS[2]) {
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => ({ tournaments: [...FLIGHTS, ...BOUNTY_API] }) }));
    const registro = { arquivo: "ranking-spt-3a-etapa.xlsx", enviadoEm: "2026-11-05T00:00:00Z", tamanho: 1, sha256: "x", inscritosDiaFinal: null, resumo: {}, avisos: [] };
    return dadosDaPlanilha(new Uint8Array(readFileSync("tests/fixtures/ranking-spt-3a-etapa.xlsx")), registro as never);
  }
  const fx = JSON.parse(readFileSync(`tests/fixtures/${stage}.json`, "utf8"));
  return {
    stage,
    updatedAt: { ranking: fx.ranking.updatedAt, tournaments: fx.tournaments.updatedAt },
    torneios: fx.tournaments.tournaments,
    jogadores: fx.ranking.ranking.map((p: { name: string; rank: number; points: number }) => ({ name: p.name, rank: p.rank, rankingPoints: p.points, resultados: fx.playerSummaries[p.name].results })),
  };
}

/** Gera o Relatório da etapa `ate` (1 a 3) como a rota faz, e o consolidar() direto das mesmas etapas. */
async function gerar(ate: number) {
  const stages = ETAPAS_SLUGS.slice(0, ate);
  const feitos = [];
  for (const s of stages) {
    const dados = await dadosDe(s);
    const aud = auditar(dados, REGRAS_PADRAO);
    const id = identificador(dados);
    feitos.push({ stage: s, dados, aud, id, regras: REGRAS_PADRAO });
  }
  const ult = feitos[ate - 1];
  const buf = await relatorioXlsx(ult.stage, ult.dados, ult.aud, REGRAS_PADRAO, ult.id, feitos.slice(0, ate - 1));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const c = consolidar(feitos.map((f, i) => etapaParaConsolidar(i + 1, montarResposta(f.stage, f.dados, REGRAS_PADRAO, f.aud, f.id))));
  return { wb, c, feitos, buf };
}

const GRUPOS = ["estava", "A", "B", "C", "D"] as const; // grupo i começa na coluna 2 + 5 i: Posição, Pontos, SPT1, SPT2, SPT3
function linhaDeRotulos(ws: ExcelJS.Worksheet) {
  let lr = 0;
  ws.eachRow((r, i) => { if (!lr && txt(r.getCell(1).value) === "Jogador") lr = i; });
  return lr;
}

describe("Relatório: aba Consolidado", () => {
  for (const [ate, linhas, insuficientesC] of [[1, 278, 278], [2, 416, 416], [3, 555, 538]] as const) {
    it(`até a Etapa ${ate}: ${linhas} linhas; A a D e SPT1 a SPT3 iguais ao consolidar(); ${insuficientesC} "Dados insuficientes" em C`, async () => {
      const { wb, c } = await gerar(ate);
      expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumo", "Erros", "Divergências de inscritos", "Jogadores", "Torneios", "Aguardando regra", "Regras", "Consolidado", "Todos os cálculos"]);
      const ws = wb.getWorksheet("Consolidado")!;
      const lr = linhaDeRotulos(ws);
      expect(ws.rowCount - lr).toBe(linhas);
      expect(c.jogadores).toHaveLength(linhas);

      // cabeçalho: etapas incluídas com identificador e origem
      expect(txt(ws.getCell(1, 1).value)).toContain(`Etapa 1 até Etapa ${ate}`);
      for (let k = 0; k < ate; k++) {
        const t = txt(ws.getCell(2 + k, 1).value);
        expect(t).toMatch(/Identificador [0-9a-f]{8} · Origem: (site|planilha)/);
        expect(t).toContain(k === 2 ? "Origem: planilha ranking-spt-3a-etapa.xlsx" : "Origem: site");
      }
      // grupos mesclados na linha de cima, rótulos embaixo, filtro na linha de rótulos
      const gr = lr - 1;
      expect(GRUPOS.map((_, i) => txt(ws.getCell(gr, 2 + i * 5).value))).toEqual([
        CONSOLIDADO.titulos[0], `${CONSOLIDADO.titulos[1]}, fator 1,0 (A)`, `${CONSOLIDADO.titulos[1]}, fator 0,9 (B)`, `${CONSOLIDADO.titulos[2]}, fator 1,0 (C)`, `${CONSOLIDADO.titulos[2]}, fator 0,9 (D)`,
      ]);
      expect(Object.keys((ws as unknown as { _merges: Record<string, unknown> })._merges)).toEqual(expect.arrayContaining(["B", "G", "L", "Q", "V"].map((l) => `${l}${gr}`).map((a) => a)));
      expect([1, 2, 3, 4, 5, 6, 27].map((col) => txt(ws.getCell(lr, col).value))).toEqual(["Jogador", "Posição", "Pontos", "SPT1", "SPT2", "SPT3", "Motivo (dados insuficientes)"]);
      expect(ws.autoFilter).toBe(`A${lr}:AA${ws.rowCount}`);
      expect(ws.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: lr });

      const linhaPor = new Map<string, ExcelJS.Row>();
      for (let i = lr + 1; i <= ws.rowCount; i++) linhaPor.set(txt(ws.getCell(i, 1).value), ws.getRow(i));
      expect(linhaPor.size).toBe(linhas);

      let insC = 0;
      let ultimaPosA = 0;
      for (let i = lr + 1; i <= ws.rowCount; i++) {
        const p = ws.getCell(i, 2 + 5).value; // posição de A
        if (typeof p === "number") { expect(p).toBeGreaterThanOrEqual(ultimaPosA); ultimaPosA = p; } // ordem: por posição de A, do 1º para baixo
      }
      for (const j of c.jogadores) {
        const row = linhaPor.get(j.nome)!;
        expect(row, j.nome).toBeDefined();
        GRUPOS.forEach((g, i) => {
          const c1 = 2 + i * 5;
          const pos = row.getCell(c1);
          const pts = row.getCell(c1 + 1);
          const cenario = g === "estava" ? null : j.cenarios[g];
          if (g === "estava") expect(pts.value, `${j.nome} publicado`).toBe(j.publicadoCent / 100);
          else if (cenario!.totalCent == null) {
            expect(pts.value).toBe("Dados insuficientes");
            expect(pts.fill).toMatchObject({ fgColor: { argb: "FFEFEFF1" } });
            expect(pos.value ?? null).toBeNull(); // sem posição
            if (g === "C") insC++;
          } else {
            expect(pts.value, `${j.nome} ${g}`).toBe(cenario!.totalCent / 100);
            expect(pos.value).toBe(cenario!.posicao);
            expect(pos.numFmt).toBe(cenario!.empate ? '0"="' : "0"); // o "=" do empate sai pelo formato, a célula continua numérica
          }
          // por etapa: só pontos; etapa que o jogador não jogou fica vazia; soma das etapas = acumulado onde há número
          let soma = 0;
          let todos = true;
          for (let k = 0; k < 3; k++) {
            const v = row.getCell(c1 + 2 + k).value;
            const esperado = g === "estava" ? (j.publicadoPorEtapa[k] == null ? null : j.publicadoPorEtapa[k]! / 100) : j.cenarios[g].porEtapa[k] == null ? null : (j.cenarios[g].porEtapa[k]!.cent == null ? "Dados insuficientes" : j.cenarios[g].porEtapa[k]!.cent! / 100);
            expect(v ?? null, `${j.nome} ${g} SPT${k + 1}`).toBe(esperado);
            if (typeof v === "number") soma += v;
            if (v === "Dados insuficientes") todos = false;
          }
          if (typeof pts.value === "number" && todos) expect(Math.round(soma * 100)).toBe(Math.round((pts.value as number) * 100));
        });
        // motivo: o mesmo texto da tela, uma etapa por linha
        const esperadoMotivo = j.cenarios.C.motivos.map((m) => CONSOLIDADO.motivoEtapa(m.etapa, m.motivo, m.linhas)).join("\n");
        expect(txt(row.getCell(27).value), j.nome).toBe(esperadoMotivo);
      }
      expect(insC).toBe(insuficientesC);
      expect(c.jogadores.filter((j) => j.cenarios.C.totalCent == null)).toHaveLength(insuficientesC);
      expect(c.jogadores.filter((j) => j.cenarios.D.totalCent == null)).toHaveLength(insuficientesC);
    });
  }

  it("três jogadores de teste, com os mesmos números e motivos da tela (Etapa 3)", async () => {
    const { wb, c } = await gerar(3);
    const ws = wb.getWorksheet("Consolidado")!;
    const lr = linhaDeRotulos(ws);
    const por = (nome: string) => { for (let i = lr + 1; i <= ws.rowCount; i++) if (txt(ws.getCell(i, 1).value) === nome) return ws.getRow(i); };
    const rb = por("Rafael Bryan")!;
    expect([rb.getCell(3).value, rb.getCell(8).value, rb.getCell(13).value]).toEqual([9732.55, 10061.25, 9608.38]); // publicado, A e B
    expect(txt(rb.getCell(27).value).split("\n")).toEqual([
      "Etapa 1: reentradas não disponíveis: falta o Excel da etapa (6 linhas)",
      "Etapa 2: reentradas não disponíveis: falta o Excel da etapa (4 linhas)",
      "Etapa 3: reentradas não disponíveis: falta o Excel da etapa (1 linha)",
    ]);
    const ab = por("Abilio Moço Vieira Neto")!;
    expect(txt(ab.getCell(27).value).split("\n")).toEqual([
      "Etapa 1: reentradas não disponíveis: falta o Excel da etapa (5 linhas)",
      "Etapa 2: reentradas não disponíveis: falta o Excel da etapa (2 linhas)",
    ]);
    expect([ab.getCell(18).value, ab.getCell(21).value, ab.getCell(26).value]).toEqual(["Dados insuficientes", 584.4, 535.67]); // C acumulado sem dados; sem Dia Final na Etapa 3, C e D por etapa têm valor
    const ad = por("Adrian Moro Moz")!;
    expect(txt(ad.getCell(27).value)).toBe("Etapa 3: reentradas não disponíveis: falta o Excel da etapa (1 linha)");
    expect([ad.getCell(4).value, ad.getCell(5).value, ad.getCell(6).value]).toEqual([null, null, 758]); // só jogou a Etapa 3
    expect(c.jogadores.find((j) => j.nome === "Adrian Moro Moz")!.cenarios.A.porEtapa.map((x) => x?.cent ?? null)).toEqual([null, null, 99655]);
  });

  it("não há texto técnico proibido na aba", async () => {
    const { wb } = await gerar(3);
    const proibidos = ["foraDoItm", "base10xFatores", "field", "CORRETO_SITE", "PENDENTE_REGRA", "updatedAt", "SHA-256", "UTC", "undefined", "NaN"];
    const ws = wb.getWorksheet("Consolidado")!;
    const achados: string[] = [];
    ws.eachRow((row) => row.eachCell((cell) => { const t = txt(cell.value); for (const p of proibidos) if (t.includes(p)) achados.push(`${p} em "${t.slice(0, 40)}"`); if (/\b(TRUE|FALSE|STANDALONE|FLIGHT|FINAL|PARENT)\b/.test(t)) achados.push(t); }));
    expect(achados).toEqual([]);
  });

  it("falta dado de uma etapa anterior: a aba mostra o aviso e o resto do Relatório sai", async () => {
    const dados = await dadosDe(ETAPAS_SLUGS[1]);
    const aud = auditar(dados, REGRAS_PADRAO);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await relatorioXlsx(dados.stage, dados, aud, REGRAS_PADRAO, identificador(dados), "Não foi possível falar com o servidor.")) as unknown as ArrayBuffer);
    expect(txt(wb.getWorksheet("Consolidado")!.getCell(1, 1).value)).toBe("Não foi possível montar o consolidado. Não foi possível falar com o servidor.");
    expect(wb.getWorksheet("Todos os cálculos")!.rowCount - 1).toBe(270);
  });
});
