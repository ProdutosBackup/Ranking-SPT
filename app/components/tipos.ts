// Formato da resposta de /api/auditoria. A tela só exibe estes dados; não recalcula nada.
export type Linha = {
  jogador: string;
  torneioId: string;
  torneio: string;
  posicao: number | null;
  prize: number | null;
  /** Planilha: o prêmio não existe, foi deduzido dos pontos; a tela mostra "—". */
  premioInferido: boolean;
  /** Participação de flight: vale 10 pontos fixos (flights e Dia Final sem posição). */
  participacao: boolean;
  /** Conta do acordo, nas posições 1 a N de um torneio com acordo. */
  acordo: { n: number; passos: { posicao: number; conta: string; cent: number }[]; somaCent: number; valorCent: number } | null;
  /** N do acordo do torneio, em todas as linhas dele (também fora das posições 1 a N). */
  acordoN: number | null;
  buyIn: number;
  field: number;
  fieldApi: number;
  premiados: number;
  itm: boolean;
  base: number;
  fatorParticipantes: number;
  fatorBuyIn: number;
  conta: string;
  esperado: number;
  registrado: number;
  diferenca: number;
  rotulo: string;
  classe: string;
  causaCodigo: string | null;
  baseUsada: number | null;
  inverso: { fatorTotal: number; fieldImplicito: number | null; candidatos: { base: number; field: number }[] } | null;
  hipotese: { texto: string; conta: string | null } | null;
  faixaBuyIn: string;
};

export type Achado = { fieldApi: number; fieldSite: number; diferenca: number; linhasExplicadas: number };
export type TorneioPainel = {
  id: string;
  nome: string;
  inscritos: number;
  premiados: number;
  resultados: number;
  corretos: number;
  erros: number;
  aguardando: number;
  /** Resultados com posição e participações de flight (o Dia Final mostra os dois separados). */
  /** N do acordo do torneio, ou null. */
  acordo: number | null;
  comPosicao: number;
  participacao: number;
  /** Da planilha; null quando a fonte não informa (o site não informa). Ações = buy-ins + re-entries. */
  buyIns: number | null;
  reentries: number | null;
  acoes: number | null;
  estado: "ok" | "erro" | "divergencia" | "vazio" | "aguardando";
  achado: Achado | null;
};
export type Grupo = { codigo: string; titulo: string; explicacao: string; pontos: number; indices: number[] };
export type JogadorPainel = { nome: string; id?: string | null; resultados: number; pontosSite: number; pontosCorretos: number; diferenca: number; erros: number };

/** De onde vieram os dados. */
export type Origem = { tipo: "site" } | { tipo: "planilha"; arquivo: string | null; enviadoEm?: string; premiadosInferidos?: boolean; inscritosDiaFinal?: { texto: string } };

/** Estado da planilha guardada (GET /api/planilha). */
export type PlanilhaGuardada = {
  carregada: true;
  arquivo: string;
  enviadoEm: string;
  tamanho: number;
  sha256: string;
  resumo: { torneios: number; jogadores: number; linhas: number; inscritosDiaFinal?: { texto: string } | null };
  avisos: string[];
};

export type Resposta = {
  stage: string;
  /** Quantos torneios da etapa têm acordo. */
  acordos: { aplicados: number };
  origem: Origem;
  updatedAt: { ranking: string; tournaments: string };
  identificador: { sha256: string };
  linhas: Linha[];
  painel: {
    veredito: string;
    numeroEtapa: number | null;
    indicadores: {
      auditados: number;
      corretos: number;
      erros: number;
      pontosEmDiscordancia: number;
      jogadoresAfetados: number;
      aguardando: number;
      arredondamento: number;
      percentualCorretos: number | null;
      divergenciasInscritos: { torneios: number; resultadosExplicados: number };
      composicao: { corretos: number; corretosSite: number; erros: number; aguardando: number; revisar: number };
    };
    avisos: string[];
    grupos: Grupo[];
    divergencias: { torneioId: string; torneio: string; inscritosApi: number; inscritosSite: number; diferenca: number; resultadosExplicados: number; texto: string }[];
    aguardandoGrupos: { codigo: string; titulo: string; pendente: string; decisao: string; total: number; itens: { texto: string; indices: number[] }[] }[];
    jogadores: JogadorPainel[];
    torneios: TorneioPainel[];
    tabelas: { bases: { posicao: string; pontos: number }[]; foraDaPremiacao: string; buyIn: { faixa: string; fator: number }[] };
    regrasTexto: { titulo: string; valor: string }[];
  };
};

export type Guardada = { dados: Resposta; params: string };
export type Bloqueio = { erro: string; detalhes: unknown[] };

export type Opcoes = {
  foraPremiacao: string;
  setForaPremiacao: (v: string) => void;
  apos18: string;
  setApos18: (v: string) => void;
  tolerancia: string;
  setTolerancia: (v: string) => void;
  campo: string;
  setCampo: (v: string) => void;
};

export type Navegar = (alteracoes: Record<string, string | null>, modo?: "push" | "replace") => void;
