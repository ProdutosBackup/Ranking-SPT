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
  satelites: "Satélites contam pontos?",
  auditar: "Auditar etapa",
  baixar: "Baixar relatório",
  exportar: "Exportar dados",
  confianca: "Faixa de confiança",
} as const;
export const BARRA_ITENS = Object.values(BARRA);

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
/** Parâmetros que já existiam além dos acima (satélites e filtro "só com erro"). */
export const ENDERECO_EXTRA = { satelites: "sat", soErro: "soerro" } as const;

/** Atalhos de teclado do painel lateral. */
export const ATALHOS = {
  anterior: { tecla: "ArrowLeft", simbolo: "←" },
  proximo: { tecla: "ArrowRight", simbolo: "→" },
  fechar: { tecla: "Escape", simbolo: "Esc" },
} as const;
