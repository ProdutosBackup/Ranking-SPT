import ExcelJS from "exceljs";
import type { DadosSpt, Jogador, Resultado, Torneio } from "./api-spt";
import { centDe } from "./calculo";

/** Dados vindos de planilha: o mesmo formato da API, mais a origem. `premiadosInferidos`: o `prize` de cada linha vale 1 se os pontos diferem de 10, senão null (a planilha não traz prêmio). */
export type DadosPlanilha = DadosSpt & { origem: { tipo: "planilha"; arquivo: string | null; premiadosInferidos: true } };

export type ResumoPlanilha = {
  torneios: number;
  jogadores: number;
  linhas: number;
  avisos: number;
  somaPontos: number;
  porTipo: { FINAL: number; STANDALONE: number };
  semColocacaoPorAba: Record<string, number>;
  consolidadoConferido: boolean;
};

export type ResultadoPlanilha =
  | { ok: true; dados: DadosPlanilha; avisos: string[]; resumo: ResumoPlanilha }
  | { ok: false; erros: string[]; avisos: string[] };

export const LIMITE_BYTES = 4 * 1024 * 1024;
export const MSG_NAO_XLSX = "O arquivo não é uma planilha .xlsx válida.";
export const MSG_GRANDE = "O arquivo tem mais de 4 MB. Envie uma planilha menor.";
export const MSG_SEM_TORNEIOS = "A planilha não tem nenhuma aba de torneio.";

type Opcoes = { stage?: string; arquivo?: string; enviadoEm?: Date };

// ---------- utilidades ----------
const limpar = (s: unknown) => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
/** Chave de comparação de rótulos e nomes: sem acento, sem maiúsculas, espaços únicos. */
const chave = (s: unknown) => limpar(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const SEM_COLOCACAO = new Set(["—", "–", "-"]);
const nf = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Valor da célula: o resultado de fórmulas, o texto de texto rico e de links; nunca a fórmula. */
function valor(c: ExcelJS.Cell): unknown {
  const v = c.value as unknown;
  if (v == null || typeof v !== "object" || v instanceof Date) return v ?? null;
  const o = v as Record<string, unknown>;
  if ("result" in o) return o.result ?? null;
  if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
  if ("text" in o) return o.text;
  return null;
}
const celula = (ws: ExcelJS.Worksheet, r: number, c: number) => valor(ws.getCell(r, c));

/** Primeira célula (linha, coluna) cujo texto normalizado é igual ao rótulo, nas linhas [de, ate]. */
function achar(ws: ExcelJS.Worksheet, rotulo: string, de = 1, ate = ws.rowCount): { r: number; c: number } | null {
  const k = chave(rotulo);
  for (let r = de; r <= Math.min(ate, ws.rowCount); r++) {
    const linha = ws.getRow(r);
    for (let c = 1; c <= Math.max(linha.cellCount, linha.actualCellCount); c++) {
      const v = celula(ws, r, c);
      if (typeof v === "string" && chave(v) === k) return { r, c };
    }
  }
  return null;
}

type Linha = { posicao: number | null; nome: string; id: string; pontos: number };
type Aba = {
  nome: string;
  buyIn: number;
  inscritos: number;
  linhas: Linha[];
  semColocacao: number;
  totalDaAba: number | null;
};

const ROTULOS_ABA = ["Buy-in (R$)", "Inscritos", "Modelo de ranking", "Fator do torneio"];

// ---------- leitura ----------
export async function lerPlanilha(bytes: Uint8Array, opcoes: Opcoes = {}): Promise<ResultadoPlanilha> {
  const avisos: string[] = [];
  const falhar = (erros: string[]): ResultadoPlanilha => ({ ok: false, erros, avisos });

  if (bytes.byteLength > LIMITE_BYTES) return falhar([MSG_GRANDE]);
  if (bytes.byteLength < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return falhar([MSG_NAO_XLSX]);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  } catch {
    return falhar([MSG_NAO_XLSX]);
  }

  const erros: string[] = [];
  const abas: Aba[] = [];
  let consolidada: ExcelJS.Worksheet | null = null;

  for (const ws of wb.worksheets) {
    const nome = limpar(ws.name);
    if (chave(nome) === "consolidado") {
      consolidada = ws;
      continue;
    }
    // Aba de torneio: tem algum rótulo do cabeçalho do torneio ou a linha de colunas.
    const ancora = achar(ws, "Posição");
    const cab = ancora && achar(ws, "Jogador", ancora.r, ancora.r)?.r === ancora.r ? ancora.r : null;
    const rotulos = ROTULOS_ABA.some((x) => achar(ws, x, 1, cab ?? ws.rowCount));
    if (!ancora && !rotulos && !achar(ws, "Jogador")) {
      avisos.push(`A aba "${nome}" não parece um torneio e foi ignorada.`);
      continue;
    }
    if (cab == null) {
      erros.push(`Na aba "${nome}" não encontrei a linha de colunas com "Posição" e "Jogador".`);
      continue;
    }

    const aba = lerAba(ws, nome, cab, erros, avisos);
    if (aba) abas.push(aba);
  }

  if (!abas.length && !erros.length) erros.push(MSG_SEM_TORNEIOS);

  // Mesmo ID com nomes diferentes: bloqueia. Mesmo nome com IDs diferentes: mantém as duas pessoas.
  const nomeDoId = new Map<string, string>();
  const idsDoNome = new Map<string, Set<string>>();
  for (const a of abas)
    for (const l of a.linhas) {
      const antes = nomeDoId.get(l.id);
      if (antes == null) nomeDoId.set(l.id, l.nome);
      else if (antes !== l.nome) {
        const m = `O mesmo ID (${l.id}) aparece com nomes diferentes: "${antes}" e "${l.nome}" (aba "${a.nome}").`;
        if (!erros.includes(m)) erros.push(m);
      }
      const k = chave(l.nome);
      (idsDoNome.get(k) ?? idsDoNome.set(k, new Set()).get(k)!).add(l.id);
    }
  if (erros.length) return falhar(erros);

  const homonimos = [...idsDoNome].filter(([, s]) => s.size > 1);
  const exibido = (l: { nome: string; id: string }) => (idsDoNome.get(chave(l.nome))!.size > 1 ? `${l.nome} (${l.id.slice(0, 4)})` : l.nome);
  for (const [, ids] of homonimos) {
    const nome = nomeDoId.get([...ids][0])!;
    avisos.push(`O nome "${nome}" aparece com ${ids.size} IDs diferentes; mantive as ${ids.size} pessoas, com o início do ID ao lado do nome.`);
  }

  // Estruturas do motor.
  const torneios: Torneio[] = abas.map((a) => ({
    id: `planilha:${chave(a.nome)}`,
    name: a.nome,
    buyIn: a.buyIn,
    players: a.inscritos,
    role: /dia final/i.test(a.nome) ? "FINAL" : "STANDALONE",
    flightLabel: null,
    status: "FINISHED",
  }));
  const porId = new Map<string, Jogador>();
  abas.forEach((a, i) => {
    for (const l of a.linhas) {
      const j = porId.get(l.id) ?? porId.set(l.id, { name: exibido(l), rank: 0, rankingPoints: 0, resultados: [] }).get(l.id)!;
      const r: Resultado = {
        tournamentId: torneios[i].id,
        tournamentName: a.nome,
        position: l.posicao,
        points: l.pontos,
        prize: l.pontos !== 10 ? 1 : null,
      };
      j.resultados.push(r);
      j.rankingPoints = (centDe(j.rankingPoints) + centDe(l.pontos)) / 100;
    }
  });
  const jogadores = [...porId.values()].sort((x, y) => y.rankingPoints - x.rankingPoints || x.name.localeCompare(y.name, "pt-BR"));
  jogadores.forEach((j, i) => (j.rank = i > 0 && j.rankingPoints === jogadores[i - 1].rankingPoints ? jogadores[i - 1].rank : i + 1));

  const consolidadoConferido = conferirConsolidada(consolidada, abas, porId, nomeDoId, avisos);

  const enviadoEm = (opcoes.enviadoEm ?? new Date()).toISOString();
  const dados: DadosPlanilha = {
    stage: opcoes.stage ?? "planilha",
    updatedAt: { ranking: enviadoEm, tournaments: enviadoEm },
    torneios,
    jogadores,
    origem: { tipo: "planilha", arquivo: opcoes.arquivo ?? null, premiadosInferidos: true },
  };
  const somaCent = abas.reduce((s, a) => s + a.linhas.reduce((t, l) => t + centDe(l.pontos), 0), 0);
  const resumo: ResumoPlanilha = {
    torneios: torneios.length,
    jogadores: jogadores.length,
    linhas: abas.reduce((s, a) => s + a.linhas.length, 0),
    avisos: avisos.length,
    somaPontos: somaCent / 100,
    porTipo: {
      FINAL: torneios.filter((t) => t.role === "FINAL").length,
      STANDALONE: torneios.filter((t) => t.role === "STANDALONE").length,
    },
    semColocacaoPorAba: Object.fromEntries(abas.map((a) => [a.nome, a.semColocacao])),
    consolidadoConferido,
  };
  return { ok: true, dados, avisos, resumo };
}

function lerAba(ws: ExcelJS.Worksheet, nome: string, cab: number, erros: string[], avisos: string[]): Aba | null {
  const antes = erros.length;
  const erro = (m: string) => erros.push(`Aba "${nome}": ${m}`);
  const aviso = (m: string) => avisos.push(`Aba "${nome}": ${m}`);

  // Colunas pelo texto do cabeçalho.
  const col = (rotulo: string) => achar(ws, rotulo, cab, cab)?.c ?? null;
  const cPos = col("Posição"), cNome = col("Jogador"), cPts = col("Pontos"), cId = col("ID jogador");
  for (const [c, r] of [[cPts, "Pontos"], [cId, "ID jogador"]] as const) if (c == null) erro(`não encontrei a coluna "${r}".`);

  const numero = (rotulo: string) => {
    const a = achar(ws, rotulo, 1, cab - 1);
    return a ? celula(ws, a.r, a.c + 1) : undefined;
  };
  const buyIn = numero("Buy-in (R$)");
  if (typeof buyIn !== "number" || !Number.isFinite(buyIn) || buyIn < 0) erro(`o torneio não tem buy-in numérico (campo "Buy-in (R$)").`);
  const inscritos = numero("Inscritos");
  if (typeof inscritos !== "number" || !Number.isInteger(inscritos) || inscritos < 0) erro(`o torneio não tem número de inscritos (campo "Inscritos").`);
  if (cPts == null || cId == null || cPos == null || cNome == null) return null;

  const linhas: Linha[] = [];
  const ids = new Set<string>();
  let r = cab + 1;
  let semColocacao = 0;
  for (; r <= ws.rowCount; r++) {
    const [p, n, pts, id] = [celula(ws, r, cPos), celula(ws, r, cNome), celula(ws, r, cPts), celula(ws, r, cId)];
    if ([p, n, pts, id].every((x) => x == null || limpar(x) === "")) break;
    if (typeof p === "string" && chave(p).startsWith("total de pontos")) break;
    const onde = `linha ${r}`;
    const nomeLimpo = limpar(n);
    const idLimpo = limpar(id);
    if (!nomeLimpo || !idLimpo) {
      erro(`${onde} sem jogador ou sem ID.`);
      continue;
    }
    let posicao: number | null = null;
    if (typeof p === "number") {
      if (!Number.isInteger(p) || p < 1) erro(`${onde} (${nomeLimpo}): posição inválida (${p}).`);
      else posicao = p;
    } else if (typeof p === "string" && SEM_COLOCACAO.has(limpar(p))) semColocacao++;
    else erro(`${onde} (${nomeLimpo}): posição inválida ("${limpar(p)}"). Use um número ou "—".`);
    if (typeof pts !== "number" || !Number.isFinite(pts) || pts < 0) {
      erro(`${onde} (${nomeLimpo}): pontos não numéricos ou negativos ("${limpar(pts)}").`);
      continue;
    }
    if (ids.has(idLimpo)) erro(`${onde} (${nomeLimpo}): o ID ${idLimpo} aparece mais de uma vez na aba.`);
    ids.add(idLimpo);
    linhas.push({ posicao, nome: nomeLimpo, id: idLimpo, pontos: pts });
  }

  // Total da aba: o número à direita do rótulo, abaixo dos dados.
  let totalDaAba: number | null = null;
  const t = achar(ws, "Total de pontos distribuídos", r);
  if (t) for (let c = t.c + 1; c <= t.c + 3 && totalDaAba == null; c++) {
    const v = celula(ws, t.r, c);
    if (typeof v === "number") totalDaAba = v;
  }

  if (erros.length > antes) return null;

  // Avisos.
  const pos = linhas.map((l) => l.posicao).filter((x): x is number => x != null);
  const vistas = new Set<number>();
  const repetidas = new Set<number>();
  for (const x of pos) (vistas.has(x) ? repetidas : vistas).add(x);
  if (repetidas.size) aviso(`posição repetida: ${[...repetidas].sort((a, b) => a - b).join(", ")}.`);
  if (pos.length) {
    const maior = Math.max(...pos);
    const falta = [...Array(maior).keys()].map((i) => i + 1).filter((x) => !vistas.has(x));
    if (falta.length) aviso(`faltam posições entre 1 e ${maior} (${falta.length} no total; há ${pos.length} linhas com posição).`);
  }
  const bi = achar(ws, "BUY IN");
  const lateral = bi ? celula(ws, bi.r + 1, bi.c) : undefined;
  if (typeof lateral === "number" && lateral !== inscritos) aviso(`"Inscritos" (${inscritos}) é diferente dos buy-ins do bloco lateral (${lateral}).`);
  const soma = linhas.reduce((s, l) => s + centDe(l.pontos), 0);
  if (totalDaAba != null && centDe(totalDaAba) !== soma) aviso(`a soma dos pontos (${nf(soma / 100)}) é diferente do total da aba (${nf(totalDaAba)}).`);

  return { nome, buyIn: buyIn as number, inscritos: inscritos as number, linhas, semColocacao, totalDaAba };
}

/** Confere total geral e total por jogador com a aba Consolidado (só avisos). Devolve se a conferência foi possível. */
function conferirConsolidada(
  ws: ExcelJS.Worksheet | null,
  abas: Aba[],
  porId: Map<string, Jogador>,
  nomeDoId: Map<string, string>,
  avisos: string[],
): boolean {
  if (!ws) return false;
  const cab = achar(ws, "ID jogador");
  const tot = cab && achar(ws, "Total", cab.r, cab.r);
  const nome = cab && achar(ws, "Jogador", cab.r, cab.r);
  if (!cab || !tot || !nome) {
    avisos.push('A aba "Consolidado" não tem as colunas "Jogador", "ID jogador" e "Total"; não foi usada para conferir.');
    return false;
  }
  const doConsolidado = new Map<string, number>();
  let totalGeral: number | null = null;
  for (let r = cab.r + 1; r <= ws.rowCount; r++) {
    const [n, id, t] = [celula(ws, r, nome.c), celula(ws, r, cab.c), celula(ws, r, tot.c)];
    if (typeof t !== "number") continue;
    if (typeof id === "string" && limpar(id)) doConsolidado.set(limpar(id), t);
    else if (chave(n) === "total") totalGeral = t;
  }
  const somaAbas = abas.reduce((s, a) => s + a.linhas.reduce((u, l) => u + centDe(l.pontos), 0), 0);
  if (totalGeral != null && centDe(totalGeral) !== somaAbas)
    avisos.push(`A soma dos pontos das abas (${nf(somaAbas / 100)}) é diferente do total da aba "Consolidado" (${nf(totalGeral)}).`);
  const difs: string[] = [];
  for (const [id, j] of porId) {
    const c = doConsolidado.get(id);
    const nomeJ = nomeDoId.get(id) ?? j.name;
    if (c == null) difs.push(`${nomeJ} (não está na Consolidado)`);
    else if (centDe(c) !== centDe(j.rankingPoints)) difs.push(`${nomeJ} (abas ${nf(j.rankingPoints)}, Consolidado ${nf(c)})`);
  }
  for (const id of doConsolidado.keys()) if (!porId.has(id)) difs.push(`ID ${id} (só está na Consolidado)`);
  if (difs.length)
    avisos.push(`O total de ${difs.length} jogador(es) não bate com a aba "Consolidado": ${difs.slice(0, 5).join("; ")}${difs.length > 5 ? "; …" : ""}.`);
  return true;
}
