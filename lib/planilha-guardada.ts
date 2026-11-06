import ExcelJS from "exceljs";
import { ErroExtracao, type Torneio } from "./api-spt";
import { armazenamento, ETAPA_PLANILHA, MSG_SEM_ARMAZENAMENTO, sha256, type Registro } from "./armazenamento-planilha";
import { TORNEIOS_COM_BOUNTY_ETAPA3 } from "./bounty-etapa3";
import { chaveTorneio } from "./premiados-etapa3";
import { lerPlanilha, LIMITE_BYTES, MSG_GRANDE, MSG_NAO_XLSX, type DadosPlanilha } from "./planilha";

const NUMERO_ETAPA = 3;
const API = "https://supremapokertour.com/api/spt";

/** De onde vieram os inscritos do Dia Final usados na auditoria. */
export type FonteInscritos = { fonte: "flights" | "informado" | "planilha"; valor: number; texto: string };
export type OrigemPlanilha = DadosPlanilha["origem"] & { enviadoEm: string; inscritosDiaFinal: FonteInscritos };
export type DadosGuardados = DadosPlanilha & { origem: OrigemPlanilha };

export type ResultadoEnvio = { ok: true; registro: Registro } | { ok: false; erros: string[]; avisos: string[] };

/** Números de etapa achados nos títulos: A1 da aba Consolidado e A1 da aba do Dia Final ("3a Etapa"). */
async function numerosDeEtapa(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  const textos = wb.worksheets
    .filter((w) => /^consolidado$/i.test(w.name.trim()) || /dia final/i.test(w.name))
    .map((w) => {
      const v = w.getCell("A1").value as unknown;
      return typeof v === "string" ? v : v && typeof v === "object" && "richText" in v ? (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("") : "";
    });
  return textos.flatMap((t) => [...t.matchAll(/(\d+)\s*[aªº°]?\s*etapa/gi)].map((m) => Number(m[1])));
}

export async function enviarPlanilha(bytes: Uint8Array, arquivo: string, inscritosDiaFinal: number | null): Promise<ResultadoEnvio> {
  const lida = await lerPlanilha(bytes, { stage: ETAPA_PLANILHA, arquivo });
  if (!lida.ok) return lida;
  const avisos = [...lida.avisos];
  const numeros = await numerosDeEtapa(bytes);
  const outro = numeros.find((n) => n !== NUMERO_ETAPA);
  if (outro != null)
    return { ok: false, avisos, erros: [`Esta planilha é da ${outro}ª Etapa. Só a Etapa ${NUMERO_ETAPA} aceita planilha; as outras etapas continuam lidas do site.`] };
  if (!numeros.length) avisos.push(`Não encontrei o número da etapa nos títulos da planilha; considerei a Etapa ${NUMERO_ETAPA}.`);

  const registro: Registro = { arquivo, enviadoEm: new Date().toISOString(), tamanho: bytes.byteLength, sha256: sha256(bytes), inscritosDiaFinal, resumo: { ...lida.resumo, avisos: avisos.length }, avisos };
  await armazenamento().salvar(bytes, registro);
  return { ok: true, registro };
}

/** Torneios que o site lista para a etapa, com o bounty (vazio se não houver ou se o site não responder). Duas tentativas. */
export async function torneiosDoSite(): Promise<Torneio[]> {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(`${API}/tournaments?stage=${encodeURIComponent(ETAPA_PLANILHA)}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!r.ok) continue;
      const lista = ((await r.json()) as { tournaments?: Torneio[] }).tournaments;
      if (!Array.isArray(lista)) continue;
      return lista.filter((t) => t && typeof t.name === "string");
    } catch {
      // tenta de novo; sem resposta, cai para o valor informado ou o da planilha
    }
  }
  return [];
}

/** Torneios FLIGHT da lista do site, só com os campos usados. */
export const flightsDe = (lista: Torneio[]): Torneio[] =>
  lista
    .filter((t) => t.role === "FLIGHT" && typeof t.players === "number")
    .map((t) => ({ id: t.id, name: t.name, buyIn: t.buyIn, players: t.players, role: t.role, flightLabel: t.flightLabel ?? null, status: t.status }));

/**
 * Bounty (tipo e valor) de um torneio da planilha, buscado por nome entre os torneios do site (sem maiúsculas, acentos, hífen, barra e ´).
 * Só devolve se houver correspondência e o site informar um bounty válido (tipo diferente de NONE e valor numérico); senão null: o bounty
 * não foi obtido e a auditoria deixa as linhas aguardando, sem usar o buy-in base.
 */
export function bountyDoSite(nome: string, lista: Torneio[]): { bountyType: string; bountyAmount: number } | null {
  const achados = lista
    .filter((t) => chaveTorneio(t.name) === chaveTorneio(nome) && t.role !== "FLIGHT" && t.bountyType != null && t.bountyType !== "NONE" && typeof t.bountyAmount === "number")
    .map((t) => ({ bountyType: t.bountyType as string, bountyAmount: t.bountyAmount as number }));
  if (!achados.length || achados.some((a) => a.bountyType !== achados[0].bountyType || a.bountyAmount !== achados[0].bountyAmount)) return null;
  return achados[0];
}

/**
 * Transforma os bytes guardados nos dados do motor. Inscritos do Dia Final, nesta ordem:
 * soma dos flights que o site lista; senão o valor informado no envio; senão o da planilha.
 */
export async function dadosDaPlanilha(bytes: Uint8Array, registro: Registro): Promise<DadosGuardados> {
  const lida = await lerPlanilha(bytes, { stage: ETAPA_PLANILHA, arquivo: registro.arquivo, enviadoEm: new Date(registro.enviadoEm) });
  if (!lida.ok) throw new ErroExtracao(`A planilha guardada não pôde ser lida: ${lida.erros.join(" ")}`);
  const doSite = await torneiosDoSite(); // uma só leitura: flights e bounty
  // Bounty dos torneios K.O e Mystery (a planilha traz só o buy-in base): da API, por nome. Sem resposta ou sem correspondência, fica sem bounty.
  const comBounty = new Set(TORNEIOS_COM_BOUNTY_ETAPA3.map(chaveTorneio));
  const torneios = lida.dados.torneios.map((t) => {
    const b = comBounty.has(chaveTorneio(t.name)) ? bountyDoSite(t.name, doSite) : null;
    return b ? { ...t, ...b } : t;
  });
  const final = torneios.findIndex((t) => t.role === "FINAL");

  let inscritos: FonteInscritos;
  const flights = final >= 0 ? flightsDe(doSite) : [];
  const soma = flights.reduce((a, t) => a + t.players, 0);
  if (flights.length && soma > 0) {
    torneios.push(...flights); // o motor soma os FLIGHT para o field do FINAL
    inscritos = { fonte: "flights", valor: soma, texto: `${soma} inscritos (soma dos ${flights.length} torneios do primeiro dia, informados pelo site)` };
  } else if (final >= 0 && registro.inscritosDiaFinal != null) {
    torneios[final] = { ...torneios[final], players: registro.inscritosDiaFinal };
    inscritos = { fonte: "informado", valor: registro.inscritosDiaFinal, texto: `${registro.inscritosDiaFinal} inscritos (informado no envio da planilha)` };
  } else {
    const v = final >= 0 ? torneios[final].players : 0;
    inscritos = { fonte: "planilha", valor: v, texto: `${v} inscritos (valor da planilha)` };
  }
  return { ...lida.dados, torneios, origem: { ...lida.dados.origem, enviadoEm: registro.enviadoEm, inscritosDiaFinal: inscritos } };
}

export { LIMITE_BYTES, MSG_GRANDE, MSG_NAO_XLSX };

/** Registro da planilha guardada, ou null se não houver (ou se o armazenamento não estiver configurado neste ambiente). */
export async function lerRegistro(): Promise<Registro | null> {
  try {
    return await armazenamento().estado();
  } catch (e) {
    if ((e as Error).message === MSG_SEM_ARMAZENAMENTO) return null;
    throw new ErroExtracao("Não foi possível ler a planilha guardada. Tente novamente em instantes.");
  }
}
