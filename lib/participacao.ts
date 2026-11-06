// Main Event avaliado por linha [usuário, 06/11/2026: "Dias classificatórios não tem premiação." "Se ele está em posição que premia = Ele irá ter a
// pontuação DA POSIÇÃO DELE, agora se ele NÃO PONTUOU em nada ele entra na regra do cálculo que já usamos da conta correta"]. Substitui a regra de
// 05/11/2026 (a pontuação do Dia Final ia para o primeiro flight e o Dia Final valia 0). O primeiro flight do jogador vale 10 × fatores, os outros
// flights valem 0, e a linha do Dia Final é avaliada pela própria posição. Nenhuma pontuação passa de uma linha para outra.
// Participantes: igual para todas as linhas do Main Event. Etapa 1: 334 buy-ins, informado pelo usuário em 06/11/2026 (CAMPO_MAIN_EVENT em regras.ts);
// nas outras etapas, a soma das entradas (players) dos flights.
// Textos usados pela tela e pelos arquivos Excel; a tela os importa por app/components/estrutura.ts.
export const PARTICIPACAO = {
  rotulo: "Participação de flight",
  explicacao: "Vale 10 × fatores, com o campo do Main Event (na Etapa 1, 334 buy-ins; nas outras, a soma das entradas dos flights). Flight não tem premiação; só o primeiro flight do jogador pontua.",
  causa: "Participação de flight com pontos diferentes de 10 × fatores",
  bloco: "Participação nos flights",
  regra:
    "Cada linha do Main Event é avaliada por si. Flight não tem premiação: o primeiro flight que o jogador jogou (1A, 1C, 1D, 1E) vale 10 × fatores e os outros flights valem 0. A linha do Dia Final vale pela própria posição: com posição que premia, a base da posição × fatores; sem posição, 10 × fatores. Quem jogou flight e chegou ao Dia Final pontua nas duas linhas. O campo, igual para todas as linhas do Main Event, é 334 buy-ins na Etapa 1 (informado pelo usuário em 06/11/2026) e a soma das entradas dos flights nas outras etapas; o buy-in do flight é R$ 1.000 e o do Dia Final é R$ 0 (fator 1,0 nos dois).",
  fonte: "Fonte: decisão do usuário em 06/11/2026, que substitui a de 05/11/2026 (pontuação do Dia Final no flight).",
  hipotese: "Hipótese (inferida, não confirmada): quem aparece sem posição no Dia Final jogou só os flights.",
  comPosicao: "Com posição",
  vazioAguardando: "Nenhum resultado aguardando regra.",
  // Linhas de flight que valem 0 (o jogador já pontuou em outro flight)
  zeroMaisDeUm: "Jogou mais de um flight: vale só o primeiro",
  contaZeroMaisDeUm: "0: já pontuou em outro flight (pontua uma vez só)",
  campo: (soma: number, partes: number[]) => `campo: soma dos flights ${soma} = ${partes.join("+")}`,
  campoInformado: (n: number) => `campo: ${n} buy-ins do Main Event (informado pelo usuário em 06/11/2026)`,
} as const;

/** Colunas de ações por torneio. `—` quando a fonte não informa. */
export const ACOES = {
  buyIns: "Buy-ins",
  reentries: "Re-entries",
  acoes: "Ações",
  naoInformado: "não informado pelo site",
  diferente: "Buy-ins diferente de Inscritos",
} as const;
