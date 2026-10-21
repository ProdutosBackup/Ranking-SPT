// Participação nos flights (decisão do usuário em 21/10/2026, confirmada com o responsável do ranking):
// os flights geram só 10 pontos de participação, fixos. Quem aparece sem posição no Dia Final é tratado do mesmo jeito.
// Textos usados pela tela e pelos arquivos Excel; a tela os importa por app/components/estrutura.ts.
export const PARTICIPACAO = {
  rotulo: "Participação de flight",
  explicacao: "10 pontos fixos, sem fatores nem tabela de posição. Vale também para quem aparece sem posição no Dia Final.",
  causa: "Participação de flight com pontos diferentes de 10",
  conta: "Participação de flight: 10 pontos fixos",
  bloco: "Participação nos flights",
  regra: "Os flights geram apenas 10 pontos de participação, fixos. Quem aparece sem posição no Dia Final é tratado do mesmo jeito: não é resultado do Dia Final.",
  fonte: "Fonte: confirmado com o responsável do ranking em 21/10/2026.",
  hipotese: "Hipótese (inferida, não confirmada): quem aparece sem posição no Dia Final jogou só os flights.",
  comPosicao: "Com posição",
  vazioAguardando: "Nenhum resultado aguardando regra.",
} as const;

/** Colunas de ações por torneio (Parte B). `—` quando a fonte não informa. */
export const ACOES = {
  buyIns: "Buy-ins",
  reentries: "Re-entries",
  acoes: "Ações",
  naoInformado: "não informado pelo site",
  diferente: "Buy-ins diferente de Inscritos",
} as const;
