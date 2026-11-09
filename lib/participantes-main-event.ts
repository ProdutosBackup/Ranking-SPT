import ExcelJS from "exceljs";
import { celula, chave, limpar, LIMITE_BYTES, MSG_GRANDE, MSG_NAO_XLSX } from "./planilha";

/**
 * Planilha de participantes do Main Event (extraída do Stack Plus): uma aba por etapa ("1a Etapa", "2a Etapa", "3a Etapa"),
 * uma linha por jogador. Este módulo só lê e totaliza; nada aqui alimenta o motor, a rota ou o armazenamento.
 */
export type TotaisEtapa = { entradas: number; jogadores: number };
export type ParticipantesMainEvent = { 1: TotaisEtapa; 2: TotaisEtapa; 3: TotaisEtapa };
export type LeituraParticipantes = { ok: true; etapas: ParticipantesMainEvent } | { ok: false; erros: string[] };

const ETAPAS = [1, 2, 3] as const;
const CABECALHO = ["Jogador", "Dias jogados", "Entradas", "Foi ao Dia Final", "Posição no Dia Final"];
const COL_NOME = 1;
const COL_ENTRADAS = 3;
/** Mesmo limite de linhas lidas por aba, para uma planilha errada não prender o servidor. */
const MAX_LINHAS = 20000;

/** Acha a aba da etapa ("1a Etapa", "1ª Etapa", "1º Etapa"), sem diferenciar maiúsculas, acentos e espaços. */
const abaDaEtapa = (wb: ExcelJS.Workbook, n: number) => wb.worksheets.find((ws) => new RegExp(`^${n}\\s*[aªº°]?\\s*etapa$`).test(chave(ws.name)));

export async function lerParticipantesMainEvent(bytes: Uint8Array): Promise<LeituraParticipantes> {
  if (bytes.byteLength > LIMITE_BYTES) return { ok: false, erros: [MSG_GRANDE] };
  if (bytes.byteLength < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { ok: false, erros: [MSG_NAO_XLSX] };
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  } catch {
    return { ok: false, erros: [MSG_NAO_XLSX] };
  }

  const erros: string[] = [];
  const etapas = {} as ParticipantesMainEvent;
  for (const n of ETAPAS) {
    const ws = abaDaEtapa(wb, n);
    if (!ws) {
      erros.push(`A planilha não tem a aba "${n}a Etapa".`);
      continue;
    }
    const cab = CABECALHO.map((_, i) => chave(celula(ws, 1, i + 1)));
    if (CABECALHO.some((h, i) => cab[i] !== chave(h))) {
      erros.push(`A aba "${limpar(ws.name)}" tem o cabeçalho diferente do esperado. Esperado, nas colunas A a E: ${CABECALHO.join(", ")}.`);
      continue;
    }
    let entradas = 0;
    let jogadores = 0;
    const vistos = new Set<string>();
    const ate = Math.min(ws.rowCount, MAX_LINHAS + 1);
    for (let r = 2; r <= ate; r++) {
      const nome = limpar(celula(ws, r, COL_NOME));
      if (!nome) continue;
      const k = chave(nome);
      if (vistos.has(k)) erros.push(`Aba "${limpar(ws.name)}", linha ${r}: jogador repetido na mesma aba.`);
      vistos.add(k);
      const bruto = celula(ws, r, COL_ENTRADAS);
      let n_ = 0;
      if (bruto == null || (typeof bruto === "string" && bruto.trim() === "")) n_ = 0;
      else if (typeof bruto !== "number" || !Number.isFinite(bruto)) erros.push(`Aba "${limpar(ws.name)}", linha ${r}: Entradas precisa ser um número, e veio texto.`);
      else if (bruto < 0 || !Number.isInteger(bruto)) erros.push(`Aba "${limpar(ws.name)}", linha ${r}: Entradas precisa ser um número inteiro, zero ou maior.`);
      else n_ = bruto;
      entradas += n_;
      jogadores++;
    }
    etapas[n] = { entradas, jogadores };
  }
  return erros.length ? { ok: false, erros } : { ok: true, etapas };
}
