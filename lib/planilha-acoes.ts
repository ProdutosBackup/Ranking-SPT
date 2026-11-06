import ExcelJS from "exceljs";
import type { DadosSpt, Torneio } from "./api-spt";
import { ehDiaFinal, ehFlight } from "./auditoria";
import { chaveTorneio } from "./premiados-etapa3";
import { celula, chave, limpar, lerBloco, LIMITE_BYTES, MSG_GRANDE, MSG_NAO_XLSX } from "./planilha";

/**
 * Planilhas das Etapas 1 e 2: só alimentam os buy-ins e re-entries de cada torneio (cenários C e D).
 * Resultados e pontos continuam vindo do site; premiados e conferência do Consolidado não se aplicam aqui.
 */
export type AbaAcoes = { nome: string; titulo: string; buyIns: number | null; reentries: number | null };
export type LeituraAcoes = { ok: true; etapa: number | null; abas: AbaAcoes[] } | { ok: false; erros: string[] };

export const MOTIVO_SEM_BLOCO = "planilha da etapa sem Buy In/Reentry para este torneio";

const textoA1 = (ws: ExcelJS.Worksheet) => {
  const v = celula(ws, 1, 1);
  return typeof v === "string" ? limpar(v) : "";
};

/** Abre o .xlsx (ou devolve a mensagem de erro). */
async function abrir(bytes: Uint8Array): Promise<ExcelJS.Workbook | string> {
  if (bytes.byteLength > LIMITE_BYTES) return MSG_GRANDE;
  if (bytes.byteLength < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return MSG_NAO_XLSX;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  } catch {
    return MSG_NAO_XLSX;
  }
  return wb;
}

/** Números de etapa achados nos títulos: A1 da aba Consolidado e A1 da aba do Dia Final ("3a Etapa"). */
export function numerosDeEtapa(wb: ExcelJS.Workbook): number[] {
  const textos = wb.worksheets.filter((w) => /^consolidado$/i.test(w.name.trim()) || /dia final/i.test(w.name)).map(textoA1);
  return textos.flatMap((t) => [...t.matchAll(/(\d+)\s*[aªº°]?\s*etapa/gi)].map((m) => Number(m[1])));
}

/** Lê o número da etapa e o bloco Buy In / Rebuy de cada aba de torneio (todas menos "Consolidado"). */
export async function lerAcoes(bytes: Uint8Array): Promise<LeituraAcoes> {
  const wb = await abrir(bytes);
  if (typeof wb === "string") return { ok: false, erros: [wb] };
  const numeros = numerosDeEtapa(wb);
  const etapa = numeros.length && numeros.every((n) => n === numeros[0]) ? numeros[0] : null;
  const abas = wb.worksheets
    .filter((ws) => chave(ws.name) !== "consolidado")
    .map((ws) => ({ nome: limpar(ws.name), titulo: textoA1(ws), ...lerBloco(ws) }));
  if (!abas.length) return { ok: false, erros: ["A planilha não tem nenhuma aba de torneio."] };
  return { ok: true, etapa, abas };
}

/** Número de etapa da planilha (null se os títulos não dizem, ou se divergem entre si). */
export async function etapaDaPlanilha(bytes: Uint8Array): Promise<number | null> {
  const r = await lerAcoes(bytes);
  return r.ok ? r.etapa : null;
}

// ---------- casamento aba × torneio ----------
const norm = (s: string) => chaveTorneio(s);
/** Nome da aba (cortado em 31 caracteres pelo Excel) bate com o nome do torneio. */
const bate = (aba: string, torneio: string) => {
  const a = norm(aba);
  const t = norm(torneio);
  if (!a || !t) return false;
  return a === t || (limpar(aba).length >= 31 && t.startsWith(a));
};
const casaAba = (a: AbaAcoes, t: Torneio) => bate(a.nome, t.name) || bate(a.titulo, t.name);

export type Casamento = {
  /** id do torneio → aba */
  casados: Map<string, AbaAcoes>;
  abasSemTorneio: string[];
  torneiosSemAba: string[];
  /** Ambiguidade: a aba serve a mais de um torneio, ou o torneio a mais de uma aba. Não casam. */
  ambiguos: string[];
};

/** Só os torneios que podem ter bloco: Main Event (flights e Dia Final) fica de fora, é calculado à parte. */
export const comAcoes = (t: Torneio) => !ehFlight(t) && !ehDiaFinal(t);

export function casar(abas: AbaAcoes[], torneios: Torneio[]): Casamento {
  const alvo = torneios.filter(comAcoes);
  const casados = new Map<string, AbaAcoes>();
  const ambiguos: string[] = [];
  for (const t of alvo) {
    const as = abas.filter((a) => casaAba(a, t));
    if (as.length > 1) ambiguos.push(t.name);
    else if (as.length === 1) {
      const ts = alvo.filter((x) => casaAba(as[0], x));
      if (ts.length > 1) ambiguos.push(as[0].nome);
      else casados.set(t.id, as[0]);
    }
  }
  const abasCasadas = new Set([...casados.values()].map((a) => a.nome));
  return {
    casados,
    abasSemTorneio: abas.filter((a) => !abasCasadas.has(a.nome) && !ambiguos.includes(a.nome) && !ehAbaMainEvent(a, torneios)).map((a) => a.nome),
    torneiosSemAba: alvo.filter((t) => !casados.has(t.id) && !ambiguos.includes(t.name)).map((t) => t.name),
    ambiguos: [...new Set(ambiguos)],
  };
}

/** Aba de flight ou Dia Final: não alimenta nada (o Main Event não muda), então não conta como "sem torneio". */
const ehAbaMainEvent = (a: AbaAcoes, torneios: Torneio[]) => torneios.filter((t) => !comAcoes(t)).some((t) => casaAba(a, t));

/**
 * Devolve os dados com buyIns/reentries nos torneios casados. Torneio com resultados que ficou sem aba ou sem bloco
 * ganha `acoesMotivo` (C e D ficam "Dados insuficientes" com este motivo). Não altera o objeto recebido (a leitura da API é compartilhada).
 */
export function mesclarAcoes<T extends DadosSpt>(dados: T, leitura: Extract<LeituraAcoes, { ok: true }>): { dados: T; casamento: Casamento } {
  const casamento = casar(leitura.abas, dados.torneios);
  const torneios = dados.torneios.map((t) => {
    if (!comAcoes(t)) return t;
    const aba = casamento.casados.get(t.id);
    if (aba && (aba.buyIns != null || aba.reentries != null)) return { ...t, buyIns: aba.buyIns, reentries: aba.reentries, ...(aba.buyIns == null || aba.reentries == null ? { acoesMotivo: MOTIVO_SEM_BLOCO } : {}) };
    return { ...t, acoesMotivo: MOTIVO_SEM_BLOCO };
  });
  return { dados: { ...dados, torneios }, casamento };
}
