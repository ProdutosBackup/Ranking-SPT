// Formato da resposta de /api/auditoria. A tela só exibe estes dados; não recalcula nada.
export type Linha = {
  jogador: string;
  torneioId: string;
  torneio: string;
  posicao: number | null;
  /** Posição que deu a pontuação (no primeiro flight de quem chegou ao Dia Final, a do Dia Final). O Consolidado conta o 1º lugar por ela. */
  posicaoPontua: number | null;
  prize: number | null;
  /** Planilha: o prêmio não existe, foi deduzido dos pontos; a tela mostra "—". */
  semPremio: boolean;
  /** Participação de flight: vale 10 × fatores (flights e Dia Final sem posição). */
  participacao: boolean;
  /** K do acordo, nas posições 1 a K de um torneio com acordo (pontuam como o Kº colocado). */
  acordo: number | null;
  /** K do acordo do torneio, em todas as linhas dele (também fora das posições 1 a K). */
  acordoK: number | null;
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
  /** Pontos publicados em centésimos e o esperado nos 4 cenários A a D (null = dados insuficientes), vindos do motor. */
  registradoCent: number;
  cenarios: Partial<Record<"A" | "B" | "C" | "D", number | null>>;
  cenariosMotivo: string | null;
  diferenca: number;
  rotulo: string;
  classe: string;
  causaCodigo: string | null;
  baseUsada: number | null;
  inverso: { fatorTotal: number; fieldImplicito: number | null; candidatos: { base: number; field: number }[] } | null;
  hipotese: { texto: string; conta: string | null } | null;
  faixaBuyIn: string;
  /** Só nas linhas de torneios com bounty (K.O ou Mystery) em que o bounty foi somado ao buy-in para escolher o fator. */
  buyInParaFator: string | null;
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
  /** K do acordo do torneio, ou null. */
  acordo: number | null;
  /** Chave do torneio nos cancelamentos e se o usuário o marcou como cancelado (esperado 0 em todas as linhas). */
  chaveCancelamento: string;
  cancelado: boolean;
  /** Texto do acordo do torneio (o K marcado na mão); null se não há. */
  acordoTexto: string | null;
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
export type Origem = { tipo: "site" } | { tipo: "planilha"; arquivo: string | null; enviadoEm?: string; premiadosPorLista?: boolean; inscritosDiaFinal?: { texto: string } };

/** Estado da planilha guardada (GET /api/planilha). */
export type PlanilhaGuardada = {
  carregada: true;
  arquivo: string;
  enviadoEm: string;
  tamanho: number;
  sha256: string;
  resumo: { torneios: number; jogadores: number; linhas: number; inscritosDiaFinal?: { texto: string } | null };
  avisos: string[];
  /** Etapas 1 e 2 (planilha só de ações): o que casou com os torneios do site. */
  acoes?: { abas: number; casadas: number; abasSemTorneio: string[]; torneiosSemAba: string[]; ambiguos: string[] } | null;
};

export type Resposta = {
  stage: string;
  /** Quantos torneios da etapa têm acordo. */
  acordos: { aplicados: number };
  /** Quantos torneios da etapa o usuário marcou como cancelados. */
  cancelados: { aplicados: number };
  origem: Origem;
  updatedAt: { ranking: string; tournaments: string };
  identificador: { sha256: string; sha256Dados: string };
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
  tolerancia: string;
  setTolerancia: (v: string) => void;
};

export type Navegar = (alteracoes: Record<string, string | null>, modo?: "push" | "replace") => void;
