import { armazenamento, MSG_SEM_ARMAZENAMENTO, sha256, type Registro } from "./armazenamento-planilha";
import { ErroExtracao } from "./api-spt";
import type { ParticipantesMainEvent, TotaisEtapa } from "./participantes-main-event";

/**
 * Totais da planilha de participantes do Main Event, guardados para todos (sem login) no armazenamento da planilha (Vercel Blob ou
 * .planilha-local). Só os totais por etapa são guardados: nem o arquivo nem nenhum nome de jogador (o repositório é público).
 * Um espaço só, para as três etapas, com slug próprio; os espaços das etapas (taua-2026 etc.) e a rota /api/planilha não são afetados.
 */
export const ESPACO_PARTICIPANTES = "main-event-participantes";

/** O JSON guardado. */
export type TotaisGuardados = { versao: 1; enviadoEm: string; etapas: ParticipantesMainEvent };
/** O que a leitura devolve: os totais e a chave de identificação (sha256 do JSON guardado, para a chave de cache). */
export type LeituraTotais = { totais: ParticipantesMainEvent; enviadoEm: string; chave: string };

const ehTotal = (t: unknown): t is TotaisEtapa => {
  const x = t as TotaisEtapa;
  return !!x && Number.isInteger(x.entradas) && x.entradas >= 0 && Number.isInteger(x.jogadores) && x.jogadores >= 0;
};

/** Guarda os totais (só números). Devolve a chave de identificação. Sem armazenamento disponível, lança MSG_SEM_ARMAZENAMENTO. */
export async function salvarParticipantes(etapas: ParticipantesMainEvent, agora = new Date()): Promise<LeituraTotais> {
  const limpos: ParticipantesMainEvent = {
    1: { entradas: etapas[1].entradas, jogadores: etapas[1].jogadores },
    2: { entradas: etapas[2].entradas, jogadores: etapas[2].jogadores },
    3: { entradas: etapas[3].entradas, jogadores: etapas[3].jogadores },
  };
  const guardado: TotaisGuardados = { versao: 1, enviadoEm: agora.toISOString(), etapas: limpos };
  const bytes = new TextEncoder().encode(JSON.stringify(guardado));
  const chave = sha256(bytes);
  // O Registro é o do armazenamento da planilha; aqui ele só confirma o envio e traz o sha256 que `ler` confere.
  const registro: Registro = { arquivo: "totais-participantes-main-event", enviadoEm: guardado.enviadoEm, tamanho: bytes.byteLength, sha256: chave, inscritosDiaFinal: null, resumo: {} as Registro["resumo"], avisos: [] };
  await armazenamento().salvar(bytes, registro, ESPACO_PARTICIPANTES);
  return { totais: limpos, enviadoEm: guardado.enviadoEm, chave };
}

/** Os totais guardados, ou null se não houver (ou se o armazenamento não estiver configurado neste ambiente). */
export async function lerParticipantes(): Promise<LeituraTotais | null> {
  try {
    const g = await armazenamento().ler(ESPACO_PARTICIPANTES);
    if (!g) return null;
    const j = JSON.parse(new TextDecoder().decode(g.bytes)) as TotaisGuardados;
    if (j?.versao !== 1 || !ehTotal(j.etapas?.[1]) || !ehTotal(j.etapas?.[2]) || !ehTotal(j.etapas?.[3])) return null;
    return { totais: j.etapas, enviadoEm: j.enviadoEm, chave: g.registro.sha256 };
  } catch (e) {
    if ((e as Error).message === MSG_SEM_ARMAZENAMENTO) return null;
    throw new ErroExtracao("Não foi possível ler os totais guardados. Tente novamente em instantes.");
  }
}

/** Remove os totais guardados. Sem armazenamento disponível, lança MSG_SEM_ARMAZENAMENTO. */
export async function removerParticipantes(): Promise<{ havia: boolean }> {
  const havia = (await lerParticipantes()) != null;
  await armazenamento().remover(ESPACO_PARTICIPANTES);
  return { havia };
}

export { MSG_SEM_ARMAZENAMENTO };
