// ESTRUTURA TRAVADA DA TELA (aprovada pelo usuário em 19/10/2026). Descrição em docs/interface.md.
// Nomes, ordem, abas, seções, blocos, parâmetros do endereço e atalhos NÃO podem mudar sem autorização explícita
// do usuário na conversa. Os componentes importam estas constantes; tests/interface.test.ts compara com os valores exatos.

/** Abas, na ordem. `comContador`: a aba mostra o contador ao lado do nome. "Consolidado" é a última aba (até 06/11/2026 era um botão da barra); as outras 7 são da auditoria. */
export const ABAS = [
  { id: "auditoria", rotulo: "Auditoria", comContador: false },
  { id: "resumo", rotulo: "Resumo", comContador: false },
  { id: "erros", rotulo: "Erros", comContador: true },
  { id: "divergencias", rotulo: "Divergências de inscritos", comContador: true },
  { id: "jogadores", rotulo: "Jogadores", comContador: true },
  { id: "torneios", rotulo: "Torneios", comContador: true },
  { id: "aguardando", rotulo: "Aguardando regra", comContador: true },
  { id: "regras", rotulo: "Regras", comContador: false },
  { id: "consolidado", rotulo: "Consolidado", comContador: false },
] as const;
/** Id da aba Auditoria: a primeira e a padrão (Resumo e Erros numa tela só: causas, casos e, ao clicar num caso, o painel lateral de sempre). */
export const ABA_AUDITORIA = "auditoria";
/**
 * Textos da aba Auditoria (06/11/2026; v2 no modelo do Resumo): frase de abertura, cartões de indicador e "Como ficaram os N resultados" como no Resumo,
 * "Principais causas (hipóteses)" em cartões e "Casos" num bloco com colunas alinhadas. Causa, torneio e ordem ficam em estado local da aba, sem parâmetros no endereço.
 */
export const AUDITORIA = {
  antes: "Escolha a etapa e toque em “Auditar etapa”.",
  carregando: "Carregando a auditoria…",
  semErros: "Não há erros nesta etapa.",
  erros: "Erros",
  pontos: "Pontos em discordância",
  jogadores: "Jogadores afetados",
  corretos: "Resultados corretos (entre os conferidos)",
  todasAsCausas: "Todas as causas",
  casos: "Casos",
  colunas: ["Jogador", "Torneio · posição", "Site", "Correto", "Diferença"] as const,
  verTodas: (total: number) => `Ver todas as causas (${total.toLocaleString("pt-BR")})`,
  verMenos: "Mostrar só as 4 maiores",
  comoFicaram: (total: number) => `Como ficaram os ${total.toLocaleString("pt-BR")} resultados`,
  causas: "Causas",
  todas: "Todas",
  causa: "Causa",
  torneio: "Torneio",
  ordenar: "Ordenar",
  ordens: [["diferenca", "Maior diferença"], ["jogador", "Jogador"], ["torneio", "Torneio"]] as const,
  limpar: "Limpar filtros",
  filtros: "Filtros",
  filtrosAtivos: "Filtros ativos",
  semResultado: "Nenhum resultado com os filtros escolhidos.",
  nenhumTorneio: "Nenhum torneio encontrado.",
  buscarTorneio: "Buscar torneio",
  todosTorneios: "Todos",
  pontosEmDiscordancia: "pontos em discordância",
  clique: "Clique em um resultado para ver a conta passo a passo. As causas são hipóteses.",
};
/** Id da aba Consolidado: ela abre a visão do ranking acumulado (parâmetro `visao`), não o parâmetro `aba`. */
export const ABA_CONSOLIDADO = "consolidado";

/**
 * Itens da barra superior fixa, na ordem (reorganizada em 06/11/2026): linha de ação com a logo e o título, o seletor Etapa, o botão laranja "Auditar etapa"
 * e o botão secundário "Mais"; "Mais" abre um menu com Enviar planilha, Baixar relatório e Exportar dados; depois, a faixa de confiança em uma linha.
 * O Consolidado deixou a barra e virou a última aba (ABAS).
 */
export const BARRA = {
  etapa: "Etapa",
  auditar: "Auditar etapa",
  mais: "Mais",
  enviar: "Enviar planilha",
  baixar: "Baixar relatório",
  exportar: "Exportar dados",
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
/** Mensagem depois de guardar a planilha das Etapas 1 e 2 (só de ações): quantas abas foram lidas, quantas casaram e os nomes sem casamento (até 5). */
export const TEXTOS_ACOES = {
  guardada: (etapa: number, abas: number, casadas: number) => `Planilha da ${etapa}ª Etapa guardada: ${abas} abas lidas, ${casadas} casadas`,
  semCasamento: (nomes: string[]) => `Sem casamento: ${nomes.slice(0, 5).join("; ")}${nomes.length > 5 ? ` e mais ${nomes.length - 5}` : ""}`,
} as const;
/** Textos que mudam quando a origem dos dados é uma planilha. */
export const TEXTOS_PLANILHA = {
  faixa: (arquivo: string, data: string) => `Dados da planilha ${arquivo}, enviada em ${data} (Brasília)`,
  mudou: "A planilha foi trocada ou removida depois desta auditoria. Audite de novo.",
} as const;

import { ACORDO } from "../../lib/acordo";
import { CANCELADO } from "../../lib/cancelado";
import { ACOES, PARTICIPACAO } from "../../lib/participacao";
/**
 * Participação de flight e ações por torneio (itens acrescentados com autorização do usuário em 21/10/2026): nome e explicação da
 * categoria, bloco da aba Regras, campos separados do Dia Final, colunas da aba Torneios e texto da aba "Aguardando regra" vazia.
 */
export { ACOES, ACORDO, PARTICIPACAO };
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
