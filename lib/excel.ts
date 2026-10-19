// Excel do Relatório (painel de auditoria) e da Exportação de dados.
// Usa o mesmo resultado que a tela (montarResposta). Aqui só há formatação e somas/contagens simples,
// conferidas contra os totais da auditoria. Nenhum termo técnico vai para células, abas, cabeçalhos ou propriedades.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import type { DadosSpt } from "./api-spt";
import type { auditar } from "./auditoria";
import { gerarGraficos } from "./graficos-excel";
import type { identificador } from "./integridade";
import { montarResposta } from "./painel";
import { REGRAS_PADRAO, type Regras } from "./regras";

type Aud = ReturnType<typeof auditar>;
type Id = ReturnType<typeof identificador>;
type Resp = ReturnType<typeof montarResposta>;
type LinhaAud = Resp["linhas"][number];

// Cores do SPT. TOPO e BASE são as mesmas de --logo-fundo-topo e --logo-fundo-base (app/globals.css); um teste confere.
export const TOPO = "FF1A1C1E";
export const BASE = "FF222427";
const C = {
  laranja: "FFEFA144", pessego: "FFF8D3A8", creme: "FFFCEBD6", tinta: "FF1A1C1E", apoio: "FF6B6E73", branco: "FFFFFFFF",
  linha: "FFE3DFDA", zebra: "FFFBF9F6", cartao: "FFF6F3EE", cabecalho: "FF222427",
  // estados: suaves nas linhas, fortes só no selo da situação
  erroSuave: "FFFBE4E4", erroForte: "FFC40F14", atencaoSuave: "FFFEF0DC", atencaoForte: "FFEFA144",
  pendenteSuave: "FFEFEFF1", pendenteForte: "FF7D7F85", okSuave: "FFFFF7EC", okForte: "FFF2D2A2", arredSuave: "FFFFF3E0",
};
const SUAVE: Record<string, string> = { erro: C.erroSuave, revisar: C.atencaoSuave, aguarda: C.pendenteSuave, ok: "", arred: C.arredSuave };
const FORTE: Record<string, { fundo: string; texto: string }> = {
  erro: { fundo: C.erroForte, texto: C.branco },
  revisar: { fundo: C.atencaoForte, texto: C.tinta },
  aguarda: { fundo: C.pendenteForte, texto: C.branco },
  ok: { fundo: C.okForte, texto: C.tinta },
  arred: { fundo: C.pessego, texto: C.tinta },
};
const ETAPAS: Record<string, string> = {
  "taua-2026": "Etapa 1 — Tauá Resort Atibaia (referência)",
  "vale-suico-2026": "Etapa 2 — Vale Suíço Resort",
  "bendito-cacao-2026": "Etapa 3 — Bendito Cacao Family Resort",
};
const TITULO = "Auditoria do Ranking — Suprema Poker Tour";
const CABECALHO_IMPRESSAO = "Suprema Poker Tour · Auditoria do Ranking";
const FONTE = "Calibri";

// ---------- formatação pt-BR ----------
const n = (x: number, casas = 2) => x.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const np = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nSinal = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2, signDisplay: "exceptZero" }).replace(/^-/, "−");
export function dataBrasilia(d: Date | string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(d))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
const FMT = { ponto: "#,##0.00", dif: "#,##0.00;-#,##0.00;0.00", int: "#,##0", fator: "0.00##", pos: "0", pct: '0.0"%"' };

// ---------- construção de tabelas ----------
type Tipo = "texto" | "longo" | "ponto" | "dif" | "int" | "fator" | "pos" | "situacao";
type Col = { h: string; t: Tipo };
type Valor = string | number | null;
type Linha = { v: Valor[]; classe?: string; banner?: string };
const ehNumero = (t: Tipo) => t === "ponto" || t === "dif" || t === "int" || t === "fator" || t === "pos";
const formatoDe = (t: Tipo) => (t === "ponto" ? FMT.ponto : t === "dif" ? FMT.dif : t === "int" ? FMT.int : t === "fator" ? FMT.fator : t === "pos" ? FMT.pos : undefined);
const textoDe = (v: Valor, t: Tipo) => (v == null ? "" : typeof v === "number" ? (t === "pos" ? String(v) : n(v, t === "fator" ? 4 : t === "int" ? 0 : 2)) : v);
const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const fino: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: C.linha } }, bottom: { style: "thin", color: { argb: C.linha } },
  left: { style: "thin", color: { argb: C.linha } }, right: { style: "thin", color: { argb: C.linha } },
};

function larguras(cols: Col[], linhas: Linha[]): number[] {
  return cols.map((c, j) => {
    const maior = Math.max(...linhas.filter((l) => !l.banner).map((l) => textoDe(l.v[j], c.t).length), 0);
    const palavraCab = Math.max(...c.h.split(" ").map((p) => p.length));
    const teto = c.t === "longo" ? 52 : 38;
    return Math.min(teto, Math.max(maior + 3, palavraCab + 3, 9));
  });
}

function impressao(ws: ExcelJS.Worksheet, rodape: string, umaPagina = false, tituloLinhas?: string) {
  ws.pageSetup = {
    paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: umaPagina ? 1 : 0,
    margins: { left: 0.25, right: 0.25, top: 0.6, bottom: 0.6, header: 0.25, footer: 0.25 },
    horizontalCentered: true,
    ...(tituloLinhas ? { printTitlesRow: tituloLinhas } : {}),
  };
  ws.headerFooter = { oddHeader: `&C&"${FONTE},Bold"&11${CABECALHO_IMPRESSAO}`, oddFooter: `&L&"${FONTE},Regular"&9${rodape}&R&"${FONTE},Regular"&9Página &P de &N` };
}

/** Tabela de lista: cabeçalho escuro congelado, filtro automático, larguras pelo conteúdo, texto longo quebrando linha. */
function tabela(ws: ExcelJS.Worksheet, cols: Col[], linhas: Linha[], rodape: string, opcoes: { zebra?: boolean; semCor?: boolean; barraDif?: number } = {}) {
  const w = larguras(cols, linhas);
  cols.forEach((c, j) => (ws.getColumn(j + 1).width = w[j]));
  const cab = ws.addRow(cols.map((c) => c.h));
  cab.height = 30;
  cab.eachCell((cell, j) => {
    cell.font = { name: FONTE, size: 10, bold: true, color: { argb: C.branco } };
    cell.fill = fill(C.cabecalho);
    cell.alignment = { vertical: "middle", horizontal: ehNumero(cols[j - 1].t) && cols[j - 1].t !== "pos" ? "right" : cols[j - 1].t === "pos" ? "center" : "left", wrapText: true };
    cell.border = fino;
  });
  linhas.forEach((l, i) => {
    const r = ws.addRow(l.v);
    if (l.banner) {
      ws.mergeCells(r.number, 2, r.number, cols.length);
      const soma = w.slice(1).reduce((a, x) => a + x, 0);
      const partes = Math.ceil(String(l.v[1] ?? "").length / (soma * 0.95));
      r.height = Math.max(22, 15 * partes + 8);
      r.eachCell({ includeEmpty: true }, (cell, j) => {
        cell.fill = fill(C.creme);
        cell.font = { name: FONTE, size: 10, bold: j === 1, color: { argb: C.tinta } };
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = { ...fino, left: j === 1 ? { style: "thick", color: { argb: C.laranja } } : fino.left };
      });
      return;
    }
    const suave = !opcoes.semCor && l.classe ? SUAVE[l.classe] : "";
    r.eachCell({ includeEmpty: true }, (cell, j) => {
      const c = cols[j - 1];
      cell.font = { name: FONTE, size: 10, color: { argb: C.tinta } };
      cell.border = fino;
      if (suave) cell.fill = fill(suave);
      else if (opcoes.zebra && i % 2 === 1) cell.fill = fill(C.zebra);
      const fmt = formatoDe(c.t);
      if (fmt) cell.numFmt = fmt;
      cell.alignment = {
        vertical: "top",
        horizontal: c.t === "pos" ? "center" : ehNumero(c.t) ? "right" : "left",
        wrapText: c.t === "longo" || c.t === "texto",
      };
      if (c.t === "situacao" && l.classe && !opcoes.semCor) {
        const f = FORTE[l.classe];
        cell.fill = fill(f.fundo);
        cell.font = { name: FONTE, size: 10, bold: true, color: { argb: f.texto } };
        cell.alignment = { vertical: "top", horizontal: "center", wrapText: true };
      }
    });
  });
  ws.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: cols.length } };
  if (opcoes.barraDif != null && linhas.some((l) => !l.banner)) {
    const col = ws.getColumn(opcoes.barraDif + 1).letter;
    ws.addConditionalFormatting({
      ref: `${col}2:${col}${ws.rowCount}`,
      rules: [{ type: "dataBar", gradient: false, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: C.laranja }, priority: 1 } as ExcelJS.DataBarRuleType],
    });
  }
  impressao(ws, rodape, false, "1:1");
}

const conta = (l: LinhaAud) => (l.conta.includes("×") ? `${n(l.base)} × ${n(l.fatorParticipantes, 4)} × ${n(l.fatorBuyIn, 4)} = ${n(l.esperado)}` : `10 pontos fixos = ${n(l.esperado)}`);
const aguarda = (l: LinhaAud) => l.classe === "aguarda";

/** Colunas de "Todos os cálculos" (a Exportação usa as mesmas). */
const COLS_CALCULOS: Col[] = [
  { h: "Jogador", t: "texto" }, { h: "Torneio", t: "texto" }, { h: "Posição", t: "pos" }, { h: "Prêmio (R$)", t: "ponto" },
  { h: "Buy-in (R$)", t: "ponto" }, { h: "Inscritos usados", t: "int" }, { h: "Premiados", t: "int" }, { h: "Base da posição", t: "int" },
  { h: "Fator de participantes", t: "fator" }, { h: "Fator de buy-in", t: "fator" }, { h: "Conta correta", t: "texto" },
  { h: "Pontos corretos", t: "ponto" }, { h: "Pontos no site", t: "ponto" }, { h: "Diferença", t: "dif" }, { h: "Situação", t: "situacao" }, { h: "Causa (hipótese)", t: "longo" },
];
function linhasCalculos(linhas: LinhaAud[]): Linha[] {
  return linhas.map((l) => ({
    classe: l.classe,
    v: [
      l.jogador, l.torneio, l.posicao, l.prize, l.buyIn, l.field, l.premiados,
      aguarda(l) ? null : l.base, aguarda(l) ? null : l.fatorParticipantes, aguarda(l) ? null : l.fatorBuyIn,
      aguarda(l) ? null : conta(l), aguarda(l) ? null : l.esperado, l.registrado, aguarda(l) ? null : l.diferenca, l.rotulo, l.hipotese?.texto ?? "",
    ],
  }));
}

function propriedades(wb: ExcelJS.Workbook) {
  wb.title = TITULO;
  wb.subject = "Auditoria do Ranking";
  wb.creator = "Suprema Poker Tour";
  wb.lastModifiedBy = "Suprema Poker Tour";
  wb.company = "Suprema Poker Tour";
  wb.description = "Conferência da pontuação do ranking, com a conta de cada resultado.";
  wb.keywords = "ranking; auditoria; pontuação";
  wb.category = "Auditoria";
  wb.created = new Date();
  wb.modified = new Date();
}

// ---------- Resumo ----------
const NCOL = 24;
const LARG_COL = 7;

function alocar(partes: number[], celulas: number): number[] {
  const total = partes.reduce((a, b) => a + b, 0);
  if (!total) return partes.map(() => 0);
  const bruto = partes.map((p) => (p / total) * celulas);
  const alvo = bruto.map(Math.floor);
  let falta = celulas - alvo.reduce((a, b) => a + b, 0);
  [...bruto.keys()].sort((a, b) => bruto[b] - alvo[b] - (bruto[a] - alvo[a])).forEach((i) => {
    if (falta > 0) { alvo[i]++; falta--; }
  });
  partes.forEach((p, i) => {
    if (p > 0 && alvo[i] === 0) {
      alvo[alvo.indexOf(Math.max(...alvo))]--;
      alvo[i] = 1;
    }
  });
  return alvo;
}

async function resumo(wb: ExcelJS.Workbook, r: Resp, rodape: string, stage: string) {
  const ws = wb.addWorksheet("Resumo", { properties: { tabColor: { argb: C.laranja }, defaultRowHeight: 18 } });
  for (let c = 1; c <= NCOL; c++) ws.getColumn(c).width = LARG_COL;
  ws.views = [{ showGridLines: false }];
  const mesclar = (r1: number, c1: number, r2: number, c2: number, valor: ExcelJS.CellValue, estilo: { size?: number; bold?: boolean; cor?: string; fundo?: string; h?: "left" | "center" | "right"; fmt?: string; wrap?: boolean }) => {
    ws.mergeCells(r1, c1, r2, c2);
    const cell = ws.getCell(r1, c1);
    cell.value = valor;
    cell.font = { name: FONTE, size: estilo.size ?? 10, bold: estilo.bold, color: { argb: estilo.cor ?? C.tinta } };
    cell.alignment = { vertical: "middle", horizontal: estilo.h ?? "left", wrapText: estilo.wrap ?? true };
    if (estilo.fmt) cell.numFmt = estilo.fmt;
    if (estilo.fundo) for (let rr = r1; rr <= r2; rr++) for (let cc = c1; cc <= c2; cc++) ws.getCell(rr, cc).fill = fill(estilo.fundo);
  };
  const ind = r.painel.indicadores;
  const idCurto = r.identificador.sha256.slice(0, 8);

  // faixa de cabeçalho escura, com a cor de fundo da logo
  for (let rr = 1; rr <= 5; rr++) {
    ws.getRow(rr).height = 22;
    for (let cc = 1; cc <= NCOL; cc++) ws.getCell(rr, cc).fill = fill(rr <= 2 ? TOPO : BASE);
  }
  mesclar(1, 8, 2, NCOL, "Auditoria do Ranking", { size: 24, bold: true, cor: C.branco, fundo: TOPO, wrap: false });
  mesclar(3, 8, 3, NCOL, ETAPAS[stage] ?? stage, { size: 13, cor: C.pessego, fundo: BASE, wrap: false });
  mesclar(4, 8, 4, NCOL, `Dados do site de ${dataBrasilia(r.updatedAt.ranking)} (Brasília) · Identificador ${idCurto}`, { size: 10, cor: C.branco, fundo: BASE, wrap: false });
  mesclar(5, 8, 5, NCOL, "✓ Conta conferida por dois cálculos independentes", { size: 10, bold: true, cor: C.laranja, fundo: BASE, wrap: false });
  try {
    const logo = wb.addImage({ buffer: readFileSync(join(process.cwd(), "public", "logo-spt.png")) as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(logo, { tl: { col: 0.25, row: 0.3 }, ext: { width: 250, height: 87 } });
  } catch {
    /* sem a logo, o cabeçalho segue com o título */
  }

  ws.getRow(6).height = 8;
  ws.getRow(7).height = 26;
  ws.getRow(8).height = 26;
  mesclar(7, 1, 8, NCOL, r.painel.veredito, { size: 15, bold: true });
  ws.getRow(9).height = 8;

  // indicadores grandes
  const tiles: { rotulo: string; valor: number | null; fmt: string; destaque?: boolean }[] = [
    { rotulo: "Erros", valor: ind.erros, fmt: FMT.int, destaque: ind.erros > 0 },
    { rotulo: "Pontos em discordância", valor: ind.pontosEmDiscordancia, fmt: FMT.ponto },
    { rotulo: "Jogadores afetados", valor: ind.jogadoresAfetados, fmt: FMT.int },
    { rotulo: "Divergências de inscritos", valor: ind.divergenciasInscritos.torneios, fmt: FMT.int },
    { rotulo: "Aguardando regra", valor: ind.aguardando, fmt: FMT.int },
    { rotulo: "Resultados corretos (entre os conferidos)", valor: ind.percentualCorretos, fmt: FMT.pct },
  ];
  ws.getRow(10).height = 28;
  ws.getRow(11).height = 42;
  ws.getRow(12).height = 6;
  tiles.forEach((t, k) => {
    const c1 = 1 + 4 * k;
    const fundo = t.destaque ? C.laranja : C.cartao;
    mesclar(10, c1, 10, c1 + 3, t.rotulo, { size: 9, cor: t.destaque ? C.tinta : C.apoio, fundo });
    mesclar(11, c1, 11, c1 + 3, t.valor, { size: 26, bold: true, fundo, fmt: t.fmt, h: "left", wrap: false });
    mesclar(12, c1, 12, c1 + 3, null, { fundo });
    for (let rr = 10; rr <= 12; rr++) for (let cc = c1; cc <= c1 + 3; cc++) ws.getCell(rr, cc).border = { left: { style: "medium", color: { argb: C.branco } }, right: { style: "medium", color: { argb: C.branco } } };
  });
  ws.getRow(13).height = 8;

  // barra de composição em células proporcionais
  const comp = ind.composicao;
  mesclar(14, 1, 14, NCOL, `Como ficaram os ${n(ind.auditados)} resultados`, { size: 13, bold: true });
  ws.getRow(14).height = 24;
  const partes = [
    { rotulo: "Corretos", qtd: comp.corretos, cor: C.creme },
    { rotulo: "Corretos com inscritos do site", qtd: comp.corretosSite, cor: C.pessego },
    { rotulo: "Erros", qtd: comp.erros, cor: C.erroForte },
    { rotulo: "Revisar", qtd: comp.revisar, cor: C.laranja },
    { rotulo: "Aguardando regra", qtd: comp.aguardando, cor: C.pendenteForte },
  ];
  ws.getRow(15).height = 22;
  let col = 1;
  alocar(partes.map((p) => p.qtd), NCOL).forEach((cel, i) => {
    for (let k = 0; k < cel; k++) ws.getCell(15, col + k).fill = fill(partes[i].cor);
    col += cel;
  });
  ws.getRow(16).height = 28;
  const limites = [[1, 4], [5, 10], [11, 14], [15, 18], [19, 24]];
  partes.forEach((p, i) => {
    const [a, b] = limites[i];
    ws.mergeCells(16, a, 16, b);
    const cell = ws.getCell(16, a);
    cell.value = { richText: [{ text: "■ ", font: { name: FONTE, size: 11, color: { argb: p.cor } } }, { text: `${p.rotulo}: ${n(p.qtd, 0)}`, font: { name: FONTE, size: 9, color: { argb: C.tinta } } }] };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ws.getRow(17).height = 8;

  // gráficos (imagens em escala 2x)
  mesclar(18, 1, 18, NCOL, "Onde estão as diferenças", { size: 13, bold: true });
  ws.getRow(18).height = 24;
  for (let rr = 19; rr <= 29; rr++) ws.getRow(rr).height = 20;
  const G = { w: 424, h: 290 };
  const graficos = await gerarGraficos(r, G.w, G.h);
  if (graficos) {
    ([graficos.torneios, graficos.causas, graficos.jogadores] as Buffer[]).forEach((buf, i) => {
      const id = wb.addImage({ buffer: buf as unknown as ExcelJS.Buffer, extension: "png" });
      ws.addImage(id, { tl: { col: i * 8 + 0.1, row: 18.1 }, ext: { width: G.w, height: G.h } });
    });
  }
  ws.getRow(30).height = 8;

  // quadro de calor: torneios × situações
  mesclar(31, 1, 31, NCOL, "Situação dos resultados por torneio", { size: 13, bold: true });
  ws.getRow(31).height = 24;
  const cab = [["Torneio", 1, 8], ["Corretos", 9, 12], ["Erros", 13, 16], ["Revisar", 17, 20], ["Aguardando regra", 21, 24]] as const;
  cab.forEach(([t, a, b], i) => mesclar(32, a, 32, b, t, { size: 10, bold: true, cor: C.branco, fundo: C.cabecalho, h: i === 0 ? "left" : "center" }));
  ws.getRow(32).height = 22;
  const cont = new Map<string, number[]>();
  for (const l of r.linhas) {
    const v = cont.get(l.torneioId) ?? [0, 0, 0, 0];
    v[l.classe === "ok" ? 0 : l.classe === "erro" ? 1 : l.classe === "aguarda" ? 3 : 2]++;
    cont.set(l.torneioId, v);
  }
  const comResultado = r.painel.torneios.filter((t) => t.resultados > 0);
  const soma = [0, 0, 0, 0];
  comResultado.forEach((t, i) => {
    const rr = 33 + i;
    ws.getRow(rr).height = 20;
    const v = cont.get(t.id) ?? [0, 0, 0, 0];
    v.forEach((x, k) => (soma[k] += x));
    mesclar(rr, 1, rr, 8, t.nome, { size: 10, wrap: false });
    v.forEach((x, k) => mesclar(rr, 9 + 4 * k, rr, 12 + 4 * k, x, { size: 11, bold: true, h: "center", fmt: FMT.int, wrap: false }));
    for (let cc = 1; cc <= NCOL; cc++) ws.getCell(rr, cc).border = { bottom: { style: "thin", color: { argb: C.linha } } };
  });
  const ultima = 32 + comResultado.length;
  const alvo = [comp.corretos + comp.corretosSite, comp.erros, comp.revisar, comp.aguardando];
  // conferência contra os totais da auditoria
  if (comResultado.length && (soma[0] !== alvo[0] || soma[1] !== alvo[1] || soma[2] !== alvo[2] || soma[3] !== alvo[3]))
    throw new Error("Quadro de situações do Resumo não bate com os totais da auditoria.");
  const rt = ultima + 1;
  mesclar(rt, 1, rt, 8, "Total", { size: 10, bold: true });
  soma.forEach((x, k) => mesclar(rt, 9 + 4 * k, rt, 12 + 4 * k, x, { size: 11, bold: true, h: "center", fmt: FMT.int, wrap: false }));
  for (let cc = 1; cc <= NCOL; cc++) ws.getCell(rt, cc).border = { top: { style: "medium", color: { argb: C.tinta } } };
  if (comResultado.length) {
    const escalas: [string, string][] = [["I", C.creme], ["M", "FFE57373"], ["Q", C.laranja], ["U", "FFB9BBC0"]];
    for (const [letra, cor] of escalas)
      ws.addConditionalFormatting({
        ref: `${letra}33:${letra}${ultima}`,
        rules: [{ type: "colorScale", cfvo: [{ type: "min" }, { type: "max" }], color: [{ argb: C.branco }, { argb: cor }], priority: 1 } as ExcelJS.ColorScaleRuleType],
      });
  }
  impressao(ws, rodape, true);
  ws.pageSetup.printArea = `A1:X${rt}`;
}

// ---------- demais abas ----------
function erros(wb: ExcelJS.Workbook, r: Resp, rodape: string) {
  const ws = wb.addWorksheet("Erros");
  const cols: Col[] = [
    { h: "Causa (hipótese)", t: "longo" }, { h: "Jogador", t: "texto" }, { h: "Torneio", t: "texto" }, { h: "Posição", t: "pos" },
    { h: "Base da posição", t: "int" }, { h: "Fator de participantes", t: "fator" }, { h: "Fator de buy-in", t: "fator" },
    { h: "Pontos corretos", t: "ponto" }, { h: "Pontos no site", t: "ponto" }, { h: "Diferença", t: "dif" },
    { h: "Conta correta", t: "texto" }, { h: "Hipótese da causa", t: "longo" }, { h: "Cálculo inverso", t: "longo" },
  ];
  const linhas: Linha[] = [];
  for (const g of r.painel.grupos) {
    linhas.push({ banner: g.titulo, v: [g.titulo, `${n(g.indices.length)} ${g.indices.length === 1 ? "caso" : "casos"} · ${np(g.pontos)} pontos em discordância. ${g.explicacao}`] });
    [...g.indices]
      .sort((a, b) => Math.abs(r.linhas[b].diferenca) - Math.abs(r.linhas[a].diferenca))
      .forEach((i) => {
        const l = r.linhas[i];
        const inv = l.inverso
          ? `Pontos registrados ÷ base (${n(l.base)}) = fator total de ${n(l.inverso.fatorTotal, 4)}. ${l.inverso.fieldImplicito != null ? `Esse fator corresponde a ${n(l.inverso.fieldImplicito)} inscritos.` : "Nenhum número inteiro de inscritos reproduz o valor com essa base."}${l.inverso.candidatos.length ? ` Outras bases que reproduzem o valor: ${l.inverso.candidatos.map((c) => n(c.base)).join(", ")}.` : ""}`
          : "";
        const hip = l.hipotese ? `${l.hipotese.texto}.${l.hipotese.conta ? ` Conta que reproduz o valor do site: ${l.hipotese.conta}.` : ""}` : "";
        linhas.push({ classe: l.classe, v: [g.titulo, l.jogador, l.torneio, l.posicao, l.base, l.fatorParticipantes, l.fatorBuyIn, l.esperado, l.registrado, l.diferenca, conta(l), hip, inv] });
      });
  }
  if (!linhas.length) linhas.push({ v: ["Nenhum erro encontrado nesta etapa.", "", "", null, null, null, null, null, null, null, "", "", ""] });
  tabela(ws, cols, linhas, rodape, { barraDif: 9 });
}

function divergencias(wb: ExcelJS.Workbook, r: Resp, rodape: string) {
  const ws = wb.addWorksheet("Divergências de inscritos");
  const cols: Col[] = [
    { h: "Torneio", t: "texto" }, { h: "Inscritos na API", t: "int" }, { h: "Usados pelo site", t: "int" }, { h: "Diferença", t: "dif" },
    { h: "Resultados explicados", t: "int" }, { h: "Observação", t: "longo" },
  ];
  const lista = r.painel.divergencias;
  const linhas: Linha[] = lista.length
    ? lista.map((d) => ({ v: [d.torneio, d.inscritosApi, d.inscritosSite, d.diferenca, d.resultadosExplicados, "Isso é uma inconsistência entre a API e o site; não prova que o site esteja certo."] }))
    : [{ v: ["Nenhuma divergência de inscritos nesta etapa.", null, null, null, null, ""] }];
  tabela(ws, cols, linhas, rodape, { zebra: true });
}

function jogadores(wb: ExcelJS.Workbook, r: Resp, rodape: string) {
  const ws = wb.addWorksheet("Jogadores");
  const cols: Col[] = [
    { h: "Jogador", t: "texto" }, { h: "Resultados", t: "int" }, { h: "Erros", t: "int" }, { h: "Pontos no site", t: "ponto" },
    { h: "Pontos corretos", t: "ponto" }, { h: "Diferença", t: "dif" },
  ];
  const linhas: Linha[] = r.painel.jogadores.map((j) => ({ classe: j.erros ? "erro" : undefined, v: [j.nome, j.resultados, j.erros, j.pontosSite, j.pontosCorretos, j.diferenca] }));
  tabela(ws, cols, linhas, rodape, { zebra: true, barraDif: 5 });
}

const ESTADO: Record<string, string> = { ok: "Sem problema", erro: "Com erro", divergencia: "Inscritos diferentes da API", vazio: "Sem resultados", aguardando: "Aguardando regra" };
function torneios(wb: ExcelJS.Workbook, r: Resp, rodape: string) {
  const ws = wb.addWorksheet("Torneios");
  const cols: Col[] = [
    { h: "Torneio", t: "texto" }, { h: "Situação", t: "situacao" }, { h: "Inscritos na API", t: "int" }, { h: "Inscritos usados na conta", t: "int" },
    { h: "Premiados", t: "int" }, { h: "Resultados", t: "int" }, { h: "Corretos", t: "int" }, { h: "Corretos com inscritos do site", t: "int" },
    { h: "Erros", t: "int" }, { h: "Revisar", t: "int" }, { h: "Aguardando regra", t: "int" }, { h: "Pontos em discordância", t: "ponto" },
  ];
  const porT = new Map<string, { ok: number; site: number; erro: number; revisar: number; ag: number; pts: number }>();
  for (const l of r.linhas) {
    const v = porT.get(l.torneioId) ?? { ok: 0, site: 0, erro: 0, revisar: 0, ag: 0, pts: 0 };
    if (l.situacao === "CORRETO") v.ok++;
    else if (l.situacao === "CORRETO_SITE") v.site++;
    else if (l.situacao === "ERRO") v.erro++;
    else if (l.situacao === "PENDENTE_REGRA") v.ag++;
    else v.revisar++;
    if (l.situacao === "ERRO" || l.situacao === "SUSPEITO") v.pts += Math.abs(l.registradoCent - l.esperadoCent);
    porT.set(l.torneioId, v);
  }
  const CLASSE: Record<string, string> = { ok: "ok", erro: "erro", divergencia: "revisar", vazio: "aguarda", aguardando: "aguarda" };
  const linhas: Linha[] = r.painel.torneios.map((t) => {
    const v = porT.get(t.id) ?? { ok: 0, site: 0, erro: 0, revisar: 0, ag: 0, pts: 0 };
    return {
      classe: CLASSE[t.estado],
      v: [t.nome, ESTADO[t.estado], t.inscritosApi, t.achado ? t.achado.fieldSite : t.inscritosUsados, t.premiados, t.resultados, v.ok, v.site, v.erro, v.revisar, v.ag, v.pts / 100],
    };
  });
  tabela(ws, cols, linhas, rodape, { semCor: false, barraDif: 11 });
}

function aguardando(wb: ExcelJS.Workbook, r: Resp, rodape: string) {
  const ws = wb.addWorksheet("Aguardando regra");
  const cols: Col[] = [
    { h: "Motivo", t: "longo" }, { h: "O que está pendente", t: "longo" }, { h: "Decisão que resolve", t: "longo" },
    { h: "Jogador", t: "texto" }, { h: "Torneio", t: "texto" }, { h: "Posição", t: "pos" }, { h: "Pontos no site", t: "ponto" },
  ];
  const linhas: Linha[] = [];
  for (const g of r.painel.aguardandoGrupos) {
    linhas.push({ banner: g.titulo, v: [g.titulo, `${n(g.total)} resultados. ${g.pendente} Decisão que resolve: ${g.decisao}`] });
    for (const it of g.itens)
      for (const i of it.indices) {
        const l = r.linhas[i];
        linhas.push({ classe: "aguarda", v: [g.titulo, it.texto, g.decisao, l.jogador, l.torneio, l.posicao, l.registrado] });
      }
  }
  if (!linhas.length) linhas.push({ v: ["Nenhum resultado aguardando definição de regra.", "", "", "", "", null, null] });
  tabela(ws, cols, linhas, rodape, { zebra: false });
}

function regras(wb: ExcelJS.Workbook, r: Resp, rodape: string) {
  const ws = wb.addWorksheet("Regras");
  ws.views = [{ showGridLines: false }];
  [30, 52, 4, 28, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const t = r.painel.tabelas;
  const titulo = (linha: number, texto: string) => {
    const c = ws.getCell(linha, 1);
    c.value = texto;
    c.font = { name: FONTE, size: 13, bold: true, color: { argb: C.tinta } };
  };
  const cab = (linha: number, col: number, textos: string[]) =>
    textos.forEach((x, k) => {
      const c = ws.getCell(linha, col + k);
      c.value = x;
      c.font = { name: FONTE, size: 10, bold: true, color: { argb: C.branco } };
      c.fill = fill(C.cabecalho);
      c.border = fino;
    });
  titulo(1, "A fórmula");
  ws.mergeCells(2, 1, 2, 5);
  ws.getCell(2, 1).value = "Pontos = base da posição × fator de participantes × fator de buy-in";
  ws.getCell(2, 1).font = { name: FONTE, size: 12, bold: true };
  ws.mergeCells(3, 1, 3, 5);
  ws.getCell(3, 1).value = `O fator de participantes é inscritos ÷ 100 + 0,5. Quem fica fora da premiação recebe a base de 10 pontos: ${t.foraDaPremiacao}.`;
  ws.getCell(3, 1).alignment = { wrapText: true, vertical: "top" };
  ws.getCell(3, 1).font = { name: FONTE, size: 10 };
  ws.getRow(3).height = 32;
  titulo(5, "Base da posição");
  cab(6, 1, ["Posição", "Pontos"]);
  t.bases.forEach((b, i) => {
    const c1 = ws.getCell(7 + i, 1);
    const c2 = ws.getCell(7 + i, 2);
    c1.value = b.posicao;
    c2.value = b.pontos;
    c2.numFmt = FMT.int;
    c2.alignment = { horizontal: "left" };
    [c1, c2].forEach((c) => { c.font = { name: FONTE, size: 10 }; c.border = fino; });
  });
  const colBuy = 4;
  ws.getCell(5, colBuy).value = "Fator de buy-in";
  ws.getCell(5, colBuy).font = { name: FONTE, size: 13, bold: true };
  cab(6, colBuy, ["Buy-in", "Fator"]);
  t.buyIn.forEach((b, i) => {
    const c1 = ws.getCell(7 + i, colBuy);
    const c2 = ws.getCell(7 + i, colBuy + 1);
    c1.value = b.faixa;
    c2.value = b.fator;
    c2.numFmt = FMT.fator;
    [c1, c2].forEach((c) => { c.font = { name: FONTE, size: 10 }; c.border = fino; });
  });
  const inicio = 7 + Math.max(t.bases.length, t.buyIn.length) + 2;
  titulo(inicio, "Regras usadas nesta auditoria");
  r.painel.regrasTexto.forEach((x, i) => {
    const a = ws.getCell(inicio + 1 + i, 1);
    const b = ws.getCell(inicio + 1 + i, 2);
    a.value = x.titulo;
    b.value = x.valor;
    a.font = { name: FONTE, size: 10, color: { argb: C.apoio } };
    b.font = { name: FONTE, size: 10, bold: true };
    a.alignment = { wrapText: true, vertical: "top" };
    b.alignment = { wrapText: true, vertical: "top" };
    [a, b].forEach((c) => (c.border = { bottom: { style: "thin", color: { argb: C.linha } } }));
  });
  impressao(ws, rodape);
}

function todos(wb: ExcelJS.Workbook, r: Resp, rodape: string) {
  const ws = wb.addWorksheet("Todos os cálculos");
  tabela(ws, COLS_CALCULOS, linhasCalculos(r.linhas), rodape, { barraDif: 13 });
}

/** Relatório: painel de auditoria em 8 abas. */
export async function relatorioXlsx(stage: string, dados: DadosSpt, aud: Aud, regrasUsadas: Regras, id: Id) {
  const r = montarResposta(stage, dados, regrasUsadas, aud, id);
  const wb = new ExcelJS.Workbook();
  propriedades(wb);
  const rodape = `Identificador ${id.sha256.slice(0, 8)} · Dados de ${dataBrasilia(r.updatedAt.ranking)}`;
  await resumo(wb, r, rodape, stage);
  erros(wb, r, rodape);
  divergencias(wb, r, rodape);
  jogadores(wb, r, rodape);
  torneios(wb, r, rodape);
  aguardando(wb, r, rodape);
  regras(wb, r, rodape);
  todos(wb, r, rodape);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Exportação: tabela simples com todas as colunas de "Todos os cálculos" e uma aba com etapa, data e identificador. */
export async function exportacaoXlsx(dados: DadosSpt, aud: Aud, id: Id, regrasUsadas: Regras = REGRAS_PADRAO) {
  const r = montarResposta(dados.stage, dados, regrasUsadas, aud, id);
  const wb = new ExcelJS.Workbook();
  propriedades(wb);
  const ws = wb.addWorksheet("Dados");
  ws.addRow(COLS_CALCULOS.map((c) => c.h));
  const linhas = linhasCalculos(r.linhas);
  linhas.forEach((l) => ws.addRow(l.v));
  const w = larguras(COLS_CALCULOS, linhas);
  COLS_CALCULOS.forEach((c, j) => {
    const col = ws.getColumn(j + 1);
    col.width = w[j];
    const fmt = formatoDe(c.t);
    if (fmt) col.numFmt = fmt;
    col.alignment = { horizontal: c.t === "pos" ? "center" : ehNumero(c.t) ? "right" : "left" };
  });
  const cab = ws.getRow(1);
  cab.font = { name: FONTE, bold: true };
  cab.fill = fill("FFEDEAE4");
  cab.alignment = { vertical: "middle", wrapText: true };
  cab.height = 30;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: COLS_CALCULOS.length } };

  const wi = wb.addWorksheet("Identificação");
  const info: [string, string][] = [
    ["Etapa", ETAPAS[dados.stage] ?? dados.stage],
    ["Data dos dados do site", `${dataBrasilia(r.updatedAt.ranking)} (Brasília)`],
    ["Identificador", id.sha256.slice(0, 8)],
    ["Identificador completo", id.sha256],
    ["Resultados", String(r.linhas.length)],
    ["Arquivo gerado em", `${dataBrasilia(new Date())} (Brasília)`],
  ];
  info.forEach(([k, v]) => {
    const row = wi.addRow([k, v]);
    row.getCell(1).font = { name: FONTE, bold: true };
  });
  wi.getColumn(1).width = 28;
  wi.getColumn(2).width = Math.max(...info.map(([, v]) => v.length)) + 3;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
