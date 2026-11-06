import { chaveTorneio } from "./premiados-etapa3";

// Torneio cancelado (decisão do usuário em 05/11/2026): textos e funções puras, usados pela tela (app/components/estrutura.ts), pelo motor e pela rota.
// O armazenamento fica em lib/cancelados.ts (usa o sistema de arquivos e o Vercel Blob, então a tela não pode importá-lo).

/** Textos do cancelamento, usados pela tela e pelos arquivos Excel (a tela os importa por app/components/estrutura.ts). */
export const CANCELADO = {
  rotulo: "Cancelado",
  /** Nome acessível do controle de cada torneio. */
  controle: (nome: string) => `Torneio cancelado: ${nome}`,
  cancelar: (nome: string) => `Deseja cancelar o torneio (${nome})?`,
  reativar: (nome: string) => `Deseja reativar o torneio (${nome})?`,
  sim: "Sim",
  nao: "Não",
  salvando: "Salvando…",
  /** Motivo mostrado na linha (e na conta) de um torneio cancelado pelo usuário. */
  causa: "Torneio cancelado (marcado pelo usuário)",
  explicacao: "Torneio cancelado não pontua: o esperado é 0, mas este resultado tem pontos registrados.",
  titulo: "Torneio cancelado com pontos registrados",
  faixa: (qtd: number) => `Torneios cancelados: ${qtd}`,
  erroGravar: "Não foi possível salvar o cancelamento. Tente novamente.",
} as const;

export type Cancelado = { etapa: string; chave: string; nome: string; atualizadoEm: string };
/** Todos os cancelamentos, por chave `etapa|chave` (a chave do torneio é estável entre leituras). */
export type Cancelados = Record<string, Cancelado>;

export const chaveRegistro = (etapa: string, chave: string) => `${etapa}|${chave}`;
export const MSG_SEM_ARMAZENAMENTO_CANCELADOS = "O armazenamento dos cancelamentos não está configurado neste ambiente (falta o Vercel Blob).";
export const MSG_CANCELADO_DADOS = "Informe a etapa e o torneio.";
export const MSG_CANCELADO_NAO_ACHADO = "Torneio não encontrado nesta etapa.";

/**
 * Chave do torneio nos cancelamentos. Na Etapa 3 (planilha) o torneio não tem ID do site: vale o nome normalizado (sem maiúsculas, acentos,
 * hífen, barra e ´), para o cancelamento continuar valendo se a planilha for reenviada. Nas etapas do site, o ID do torneio.
 */
export const chaveCancelamento = (t: { id: string; name: string }, daPlanilha: boolean) => (daPlanilha ? `nome:${chaveTorneio(t.name)}` : t.id);

/** Validação do corpo da rota: `etapa` e `chave` textos não vazios. Devolve a mensagem de erro, ou null. */
export function validarCancelamento(b: { etapa?: unknown; chave?: unknown } | null): string | null {
  if (!b || typeof b.etapa !== "string" || !b.etapa.trim() || typeof b.chave !== "string" || !b.chave.trim()) return MSG_CANCELADO_DADOS;
  return null;
}

/** Chaves dos torneios cancelados de uma etapa, em ordem estável. */
export const canceladosDaEtapa = (todos: Cancelados, etapa: string): string[] =>
  Object.values(todos)
    .filter((c) => c.etapa === etapa)
    .map((c) => c.chave)
    .sort();

/** Assinatura estável dos cancelamentos de uma etapa; vazia se não houver. Entra no identificador e na chave do cache. */
export const assinaturaCancelados = (chaves: string[]) => [...chaves].sort().join("|");

/** Só os registros bem formados. */
export const soValidos = (todos: Cancelados): Cancelados =>
  Object.fromEntries(Object.entries(todos).filter(([, c]) => c && typeof c.etapa === "string" && typeof c.chave === "string" && c.chave !== ""));

