// Main Event como um torneio só [CONFIRMADO 05/11/2026, responsável do ranking e usuário]: cada jogador pontua uma vez, no primeiro flight que jogou.
// "O player premia ao longo dos flights e não no dia final. O dia final é somente uma continuação dos flights." Quem jogou flight e chegou ao Dia Final
// leva a pontuação do Dia Final para o primeiro flight, e a linha do Dia Final vale 0. Quem só tem o Dia Final (Etapas 2 e 3) segue com ele.
// Participantes = soma das entradas (players) dos flights da etapa, igual para todas as linhas do Main Event.
// Textos usados pela tela e pelos arquivos Excel; a tela os importa por app/components/estrutura.ts.
export const PARTICIPACAO = {
  rotulo: "Participação de flight",
  explicacao: "Vale 10 × fatores, com o campo igual à soma das entradas dos flights. O jogador pontua uma vez só no Main Event.",
  causa: "Participação de flight com pontos diferentes de 10 × fatores",
  bloco: "Participação nos flights",
  regra:
    "O Main Event é um torneio só e cada jogador pontua uma vez. A pontuação fica no primeiro flight que o jogador jogou (1A, 1C, 1D, 1E) e os outros flights valem 0. Quem chegou ao Dia Final leva para esse flight a pontuação do Dia Final (com posição, a base da posição × fatores; sem posição, 10 × fatores), e a linha do Dia Final dele vale 0, porque o Dia Final é continuação dos flights. Quem não jogou flight (Etapas 2 e 3) pontua no Dia Final. Quem só jogou flights vale 10 × fatores no primeiro flight. O campo, igual para todas as linhas do Main Event, é a soma das entradas dos flights; o buy-in do flight é R$ 1.000 e o do Dia Final é R$ 0 (fator 1,0 nos dois).",
  fonte: "Fonte: decisão do responsável do ranking, confirmada em 05/11/2026.",
  hipotese: "Hipótese (inferida, não confirmada): quem aparece sem posição no Dia Final jogou só os flights.",
  comPosicao: "Com posição",
  vazioAguardando: "Nenhum resultado aguardando regra.",
  // Linhas de flight que valem 0 (o jogador já pontua em outra linha do Main Event)
  flightComFinal: "Flight de jogador que chegou ao Dia Final: a pontuação do Main Event vale no flight",
  finalCedido: "Dia Final de jogador que jogou flight: a pontuação do jogador vale no flight dele",
  zeroMaisDeUm: "Jogou mais de um flight: vale só o primeiro",
  contaZeroFlight: "0: a pontuação do Main Event vale no flight",
  contaZeroMaisDeUm: "0: já pontuou em outro flight (pontua uma vez só)",
  campo: (soma: number, partes: number[]) => `campo: soma dos flights ${soma} = ${partes.join("+")}`,
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
