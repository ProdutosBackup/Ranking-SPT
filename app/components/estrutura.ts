// ESTRUTURA TRAVADA DA TELA (aprovada pelo usuário em 19/10/2026). Descrição em docs/interface.md.
// Nomes, ordem, abas, seções, blocos, parâmetros do endereço e atalhos NÃO podem mudar sem autorização explícita
// do usuário na conversa. Os componentes importam estas constantes; tests/interface.test.ts compara com os valores exatos.

/** Abas, na ordem. `comContador`: a aba mostra o contador ao lado do nome. */
export const ABAS = [
  { id: "resumo", rotulo: "Resumo", comContador: false },
  { id: "erros", rotulo: "Erros", comContador: true },
  { id: "divergencias", rotulo: "Divergências de inscritos", comContador: true },
  { id: "jogadores", rotulo: "Jogadores", comContador: true },
  { id: "torneios", rotulo: "Torneios", comContador: true },
  { id: "aguardando", rotulo: "Aguardando regra", comContador: true },
  { id: "regras", rotulo: "Regras", comContador: false },
] as const;

/** Itens da barra superior fixa, na ordem. */
export const BARRA = {
  etapa: "Etapa",
  auditar: "Auditar etapa",
  enviar: "Enviar planilha",
  baixar: "Baixar relatório",
  exportar: "Exportar dados",
  consolidado: "Consolidado",
  confianca: "Faixa de confiança",
} as const;
export const BARRA_ITENS = Object.values(BARRA);

/**
 * Envio de planilha (itens acrescentados com autorização do usuário em 21/10/2026): o botão "Enviar planilha" fica em BARRA,
 * ao lado de "Auditar etapa"; aqui estão a marca com o X, a confirmação, o bloco de resumo e os textos de origem.
 */
export const PLANILHA = {
  marca: "Planilha carregada",
  remover: "Remover planilha",
  confirmar: "Remover a planilha para todos?",
  sim: "Sim",
  nao: "Não",
  lido: "O que foi lido",
  premiadosPorLista: "Premiados da lista informada pelo responsável",
} as const;
export const PLANILHA_ITENS = Object.values(PLANILHA);
/** Textos que mudam quando a origem dos dados é uma planilha. */
export const TEXTOS_PLANILHA = {
  faixa: (arquivo: string, data: string) => `Dados da planilha ${arquivo}, enviada em ${data} (Brasília)`,
  mudou: "A planilha foi trocada ou removida depois desta auditoria. Audite de novo.",
} as const;

import { ACORDO } from "../../lib/acordo";
import { CANCELADO } from "../../lib/cancelado";
import { ACOES, CAMPO, PARTICIPACAO } from "../../lib/participacao";
/**
 * Participação de flight e ações por torneio (itens acrescentados com autorização do usuário em 21/10/2026): nome e explicação da
 * categoria, bloco da aba Regras, campos separados do Dia Final, colunas da aba Torneios e texto da aba "Aguardando regra" vazia.
 */
export { ACOES, ACORDO, CAMPO, PARTICIPACAO };
/**
 * Torneio cancelado (item acrescentado com autorização do usuário em 05/11/2026): o controle "Cancelado" de cada torneio na aba Torneios,
 * a confirmação ("Deseja cancelar o torneio (NOME)?" / "Deseja reativar o torneio (NOME)?", Sim / Não), o motivo na linha e a faixa de confiança.
 */
export { CANCELADO };

/** Seções da aba Resumo, na ordem. */
export const SECOES_RESUMO = [
  { id: "veredito", nome: "Veredito" },
  { id: "indicadores", nome: "Indicadores" },
  { id: "composicao", nome: "Composição" },
  { id: "causas", nome: "Principais causas" },
  { id: "torneios", nome: "Torneios com problema" },
] as const;

/** Blocos do painel lateral, na ordem. */
export const PAINEL_BLOCOS = {
  resultado: "Resultado",
  conta: "Conta correta",
  registrado: "Registrado no site",
  hipotese: "Hipótese da causa",
} as const;
export const PAINEL_BLOCOS_ORDEM = Object.values(PAINEL_BLOCOS);

/** Os três blocos da conta e o resultado, na ordem (Base × Participantes × Buy-in = Pontos corretos). */
export const CONTA_BLOCOS = {
  base: "Base da posição",
  participantes: "Fator de participantes",
  buyIn: "Fator de buy-in",
  resultado: "Pontos corretos",
} as const;
export const CONTA_BLOCOS_ORDEM = Object.values(CONTA_BLOCOS);

/** Parâmetros do endereço (?aba=erros&causa=...). `item` é o item aberto no painel lateral. */
export const ENDERECO = {
  etapa: "etapa",
  aba: "aba",
  causa: "causa",
  torneio: "torneio",
  busca: "busca",
  ordem: "ordem",
  item: "ver",
} as const;
/** Parâmetro que já existia além dos acima (filtro "só com erro"). O antigo `sat` (satélites) foi removido em 21/10/2026 e é ignorado. */
export const ENDERECO_EXTRA = { soErro: "soerro", visao: "visao", fator: "fator", modo: "modo", spt: "spt" } as const;

/**
 * Consolidado (itens acrescentados com autorização do usuário em 21/10/2026): o botão "Consolidado" fica em BARRA, separado das abas;
 * aqui estão o valor do parâmetro de endereço (?visao=consolidado&etapa=...), o seletor de etapa e a tabela do ranking acumulado.
 */
export const CONSOLIDADO = {
  visao: "consolidado",
  etapa: "Etapa",
  busca: "Buscar jogador",
  sair: "Voltar à auditoria",
  semDados: "Sem dados nesta etapa",
  colunas: ["Posição", "Jogador", "Pontos"],
  /** Três rankings lado a lado (autorizado em 06/11/2026), com seletor de fator, Acumulado / Por etapa e faixa fixa do que está na tela. */
  titulos: ["Ranking como estava", "Novas regras · Só entradas", "Novas regras · Total de ações"],
  fator: "Fator",
  fatores: ["1,0", "0,9"],
  modo: "Visão",
  modos: ["Acumulado", "Por etapa"],
  etapaVisao: "Etapa mostrada",
  etapasVisao: ["SPT1", "SPT2", "SPT3"],
  insuficiente: "Dados insuficientes",
  /** Cabeçalho da coluna 3: quantos jogadores do cenário exibido têm dados insuficientes (todos, não só as linhas já desenhadas). */
  contador: (n: number) => `${n.toLocaleString("pt-BR")} com dados insuficientes`,
  /** Motivo ao passar o mouse sobre a marca; o texto do motivo vem do consolidado. */
  motivoEtapa: (etapa: number, motivo: string, linhas: number) => `Etapa ${etapa}: ${motivo} (${linhas} ${linhas === 1 ? "linha" : "linhas"})`,
  faixa: (fator: string, modo: string) => `Fator ${fator} · ${modo}`,
} as const;
export const CONSOLIDADO_ITENS = [
  CONSOLIDADO.etapa, CONSOLIDADO.busca, CONSOLIDADO.sair, CONSOLIDADO.semDados, ...CONSOLIDADO.colunas,
  ...CONSOLIDADO.titulos, CONSOLIDADO.fator, ...CONSOLIDADO.fatores, CONSOLIDADO.modo, ...CONSOLIDADO.modos, CONSOLIDADO.etapaVisao, ...CONSOLIDADO.etapasVisao, CONSOLIDADO.insuficiente,
];

/** Atalhos de teclado do painel lateral. */
export const ATALHOS = {
  anterior: { tecla: "ArrowLeft", simbolo: "←" },
  proximo: { tecla: "ArrowRight", simbolo: "→" },
  fechar: { tecla: "Escape", simbolo: "Esc" },
} as const;
