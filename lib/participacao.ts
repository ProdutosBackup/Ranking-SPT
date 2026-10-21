// Participação nos flights (decisão do responsável do ranking, confirmada em 21/10/2026, que substitui a de "10 pontos fixos"):
// pontos = 10 × fator de participantes × fator de buy-in, com o campo do flight = AÇÕES (buy-ins + re-entries).
// Sem as ações do flight, a linha aguarda regra. Dia Final sem posição também aguarda (não se sabe em qual flight jogou).
// Textos usados pela tela e pelos arquivos Excel; a tela os importa por app/components/estrutura.ts.
export const PARTICIPACAO = {
  rotulo: "Participação de flight",
  explicacao: "Vale 10 × fatores com o campo em ações (buy-ins + re-entries). Sem as ações do flight, ou sem posição no Dia Final, aguarda regra.",
  causa: "Participação de flight com pontos diferentes de 10 × fatores (campo em ações)",
  bloco: "Participação nos flights",
  regra:
    "Os flights pagam 10 × fator de participantes × fator de buy-in, com o campo do flight igual às ações (buy-ins + re-entries). Exemplo: 126 ações e buy-in R$ 1.000 dão 10 × 1,76 × 1 = 17,6. Quando as ações do flight não são conhecidas, o resultado aguarda regra.",
  fonte: "Fonte: decisão do responsável do ranking, confirmada em 21/10/2026. O site contou só buy-ins na Etapa 2; segundo a decisão, o campo correto é ações.",
  hipotese: "Hipótese (inferida, não confirmada): quem aparece sem posição no Dia Final jogou só os flights.",
  comPosicao: "Com posição",
  vazioAguardando: "Nenhum resultado aguardando regra.",
  // Motivos da aba "Aguardando regra"
  motivoFlight: "faltam as ações deste flight",
  motivoDiaFinal: "não se sabe em qual flight o jogador jogou, então o multiplicador não pode ser calculado; o site pagou 10",
  tituloFlight: "Flights sem as ações",
  pendenteFlight: "O site não informa as ações (buy-ins + re-entries) de cada flight, e sem elas não dá para calcular 10 × fatores.",
  decisaoFlight: "Informar as ações de cada flight.",
  tituloDiaFinal: "Dia Final sem posição registrada",
  pendenteDiaFinal: "Não se sabe em qual flight o jogador jogou, então o multiplicador não pode ser calculado; o site pagou 10 pontos.",
  decisaoDiaFinal: "Informar em qual flight cada jogador jogou.",
} as const;

/** Opção de regra "campo do torneio" (padrão: inscritos, que são só os buy-ins). */
export const CAMPO = {
  rotulo: "Campo do torneio",
  inscritos: "Inscritos (só buy-ins)",
  acoes: "Ações (buy-ins + re-entries)",
  semAcoes: "sem ações informadas: usa os inscritos",
} as const;

/** Colunas de ações por torneio. `—` quando a fonte não informa. */
export const ACOES = {
  buyIns: "Buy-ins",
  reentries: "Re-entries",
  acoes: "Ações",
  naoInformado: "não informado pelo site",
  diferente: "Buy-ins diferente de Inscritos",
} as const;
