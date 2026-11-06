import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ABA_AUDITORIA, ABAS, ACOES, AUDITORIA, ACORDO, ATALHOS, BARRA_ITENS, CANCELADO, CONSOLIDADO, PARTICIPACAO, CONSOLIDADO_ITENS, CONTA_BLOCOS_ORDEM, ENDERECO, ENDERECO_EXTRA, PAINEL_BLOCOS_ORDEM, PLANILHA_ITENS, SECOES_RESUMO, TEXTOS_ACOES, TEXTOS_PLANILHA,
} from "../app/components/estrutura";

// Estrutura aprovada pelo usuário em 19/10/2026 (docs/interface.md). Mudar qualquer item abaixo exige autorização explícita.
const TRAVADA = "Estrutura da tela travada: alteração exige autorização do usuário.";

describe("estrutura da tela travada", () => {
  it("abas: nomes e ordem", () => {
    expect(
      ABAS.map((a) => a.rotulo),
      TRAVADA,
    ).toEqual(["Auditoria", "Resumo", "Erros", "Divergências de inscritos", "Jogadores", "Torneios", "Aguardando regra", "Regras", "Consolidado"]);
    expect(ABAS.map((a) => a.id), TRAVADA).toEqual(["auditoria", "resumo", "erros", "divergencias", "jogadores", "torneios", "aguardando", "regras", "consolidado"]);
    expect(ABAS.filter((a) => a.comContador).map((a) => a.id), TRAVADA).toEqual(["erros", "divergencias", "jogadores", "torneios", "aguardando"]);
  });

  // Aba Auditoria (06/11/2026): causas à esquerda, casos à direita; clicar num caso abre o painel lateral.
  it("aba Auditoria: textos e menus", () => {
    expect([AUDITORIA.antes, AUDITORIA.semErros, AUDITORIA.comoFicaram(1234), AUDITORIA.limpar, AUDITORIA.clique], TRAVADA).toEqual([
      "Escolha a etapa e toque em “Auditar etapa”.", "Não há erros nesta etapa.", "Como ficaram os 1.234 resultados", "Limpar filtros",
      "Clique em um resultado para ver a conta passo a passo. As causas são hipóteses.",
    ]);
    expect([AUDITORIA.todas, AUDITORIA.causa, AUDITORIA.torneio, AUDITORIA.ordenar, ...AUDITORIA.ordens.map((o) => o[1])], TRAVADA).toEqual(["Todas", "Causa", "Torneio", "Ordenar", "Maior diferença", "Jogador", "Torneio"]);
    expect(ABA_AUDITORIA, TRAVADA).toBe(ABAS[0].id);
    // v2 (no modelo do Resumo): cartões de causa, bloco de casos com colunas alinhadas e a versão curta das causas no celular
    expect([AUDITORIA.todasAsCausas, AUDITORIA.casos, ...AUDITORIA.colunas, AUDITORIA.verTodas(7), AUDITORIA.verMenos], TRAVADA).toEqual([
      "Todas as causas", "Casos", "Jogador", "Torneio · posição", "Site", "Correto", "Diferença", "Ver todas as causas (7)", "Mostrar só as 4 maiores",
    ]);
  });

  it("barra superior: itens e ordem", () => {
    expect(BARRA_ITENS, TRAVADA).toEqual(["Etapa", "Auditar etapa", "Mais", "Enviar planilha", "Baixar relatório", "Exportar dados", "Faixa de confiança"]);
  });

  // Itens acrescentados com autorização do usuário em 21/10/2026 (envio de planilha).
  it("envio de planilha: marca, confirmação, bloco de resumo e textos de origem", () => {
    expect(PLANILHA_ITENS, TRAVADA).toEqual([
      "Planilha carregada", "Remover planilha", "Remover a planilha para todos?", "Sim", "Não", "O que foi lido", "Premiados da lista informada pelo responsável",
    ]);
    expect(TEXTOS_PLANILHA.faixa("a.xlsx", "21/10/2026 14:00"), TRAVADA).toBe("Dados da planilha a.xlsx, enviada em 21/10/2026 14:00 (Brasília)");
    expect(TEXTOS_PLANILHA.mudou, TRAVADA).toBe("A planilha foi trocada ou removida depois desta auditoria. Audite de novo.");
  });

  // Planilha de ações das Etapas 1 e 2 (a marca e a remoção são as mesmas, por etapa; só a mensagem de envio é nova).
  it("planilha de ações: mensagem de envio com abas lidas, casadas e nomes sem casamento (até 5)", () => {
    expect(TEXTOS_ACOES.guardada(2, 9, 8), TRAVADA).toBe("Planilha da 2ª Etapa guardada: 9 abas lidas, 8 casadas");
    expect(TEXTOS_ACOES.semCasamento(["a", "b"]), TRAVADA).toBe("Sem casamento: a; b");
    expect(TEXTOS_ACOES.semCasamento(["a", "b", "c", "d", "e", "f", "g"]), TRAVADA).toBe("Sem casamento: a; b; c; d; e e mais 2");
  });

  // Itens acrescentados com autorização do usuário em 21/10/2026 (Consolidado).
  it("consolidado: seletor de etapa, busca, saída, texto sem dados e colunas fixas da tabela", () => {
    expect(CONSOLIDADO_ITENS, TRAVADA).toEqual([
      "Etapa", "Buscar jogador", "Voltar à auditoria", "Sem dados nesta etapa", "Posição", "Jogador", "Pontos",
      "Ranking como estava", "Novas regras · Só entradas", "Novas regras · Total de ações",
      "Fator", "1,0", "0,9", "Visão", "Acumulado", "Por etapa", "Etapa mostrada", "SPT1", "SPT2", "SPT3", "Dados insuficientes",
    ]);
    expect([CONSOLIDADO.contador(214), CONSOLIDADO.motivoEtapa(1, "reentradas não disponíveis: falta o Excel da etapa", 3), CONSOLIDADO.motivoEtapa(3, "x", 1)], TRAVADA).toEqual([
      "214 com dados insuficientes", "Etapa 1: reentradas não disponíveis: falta o Excel da etapa (3 linhas)", "Etapa 3: x (1 linha)",
    ]);
    expect([CONSOLIDADO.faixa("1,0", "Acumulado"), CONSOLIDADO.faixa("0,9", "Etapa 2")], TRAVADA).toEqual(["Fator 1,0 · Acumulado", "Fator 0,9 · Etapa 2"]);
  });

  // Itens acrescentados com autorização do usuário em 21/10/2026 (participação de flight e ações por torneio).
  it("participação de flight: nome, explicação, bloco da aba Regras, linhas que valem 0 e texto vazio", () => {
    expect(
      [PARTICIPACAO.rotulo, PARTICIPACAO.explicacao, PARTICIPACAO.bloco, PARTICIPACAO.regra, PARTICIPACAO.fonte, PARTICIPACAO.comPosicao, PARTICIPACAO.vazioAguardando],
      TRAVADA,
    ).toEqual([
      "Participação de flight",
      "Vale 10 × fatores, com o campo do Main Event (na Etapa 1, 334 buy-ins; nas outras, a soma das entradas dos flights). Flight não tem premiação; só o primeiro flight do jogador pontua.",
      "Participação nos flights",
      "Cada linha do Main Event é avaliada por si. Flight não tem premiação: o primeiro flight que o jogador jogou (1A, 1C, 1D, 1E) vale 10 × fatores e os outros flights valem 0. A linha do Dia Final vale pela própria posição: com posição que premia, a base da posição × fatores; sem posição, 10 × fatores. Quem jogou flight e chegou ao Dia Final pontua nas duas linhas. O campo, igual para todas as linhas do Main Event, é 334 buy-ins na Etapa 1 (informado pelo usuário em 06/11/2026) e a soma das entradas dos flights nas outras etapas; o buy-in do flight é R$ 1.000 e o do Dia Final é R$ 0 (fator 1,0 nos dois).",
      "Fonte: decisão do usuário em 06/11/2026, que substitui a de 05/11/2026 (pontuação do Dia Final no flight).",
      "Com posição",
      "Nenhum resultado aguardando regra.",
    ]);
    // Main Event avaliado por linha (06/11/2026): texto das linhas de flight que valem 0 (as duas causas da regra de 05/11 foram removidas).
    expect([PARTICIPACAO.zeroMaisDeUm, PARTICIPACAO.campo(331, [96, 50, 64, 67, 54])], TRAVADA).toEqual([
      "Jogou mais de um flight: vale só o primeiro",
      "campo: soma dos flights 331 = 96+50+64+67+54",
    ]);
  });

  it("aba Torneios: colunas de buy-ins, re-entries e ações", () => {
    expect([ACOES.buyIns, ACOES.reentries, ACOES.acoes, ACOES.naoInformado], TRAVADA).toEqual(["Buy-ins", "Re-entries", "Ações", "não informado pelo site"]);
  });

  // Itens acrescentados com autorização do usuário em 21/10/2026 (acordo); pergunta, cartão e textos refeitos com nova autorização na mesma data.
  it("acordo: cartão do painel, pergunta, resumo, remoção, aviso, conta, marcação nas telas e texto da faixa de confiança", () => {
    expect([ACORDO.rotulo, ACORDO.caixa, ACORDO.pergunta, ACORDO.aplicar, ACORDO.remover, ACORDO.confirmar, ACORDO.confirmarSim, ACORDO.confirmarNao], TRAVADA).toEqual([
      "Acordo", "Houve acordo neste torneio", "Pontuam como qual colocação?", "Aplicar", "Remover acordo", "Remover o acordo deste torneio para todos?", "Remover", "Cancelar",
    ]);
    expect([ACORDO.dica(63), ACORDO.resumo(4), ACORDO.aviso(4), ACORDO.conta(4), ACORDO.marca(4), ACORDO.torneio(4), ACORDO.faixa(2), ACORDO.causa(4, "2.286"), ACORDO.marcaAuto(1, 4), ACORDO.torneioAuto(1, 4), ACORDO.causaAuto(1, 4), ACORDO.discorda(4, ACORDO.semAuto)], TRAVADA).toEqual([
      "De 2 a 63 (premiados do torneio)",
      "Acordo: os 4 primeiros pontuam como 4º colocado",
      "Este torneio tem acordo: os 4 primeiros pontuam como 4º colocado",
      "Acordo: pontua como 4º colocado",
      "Os 4 primeiros, como 4º colocado (informado)",
      "Acordo: os 4 primeiros, como 4º colocado (informado)",
      "Acordos aplicados: 2 torneio(s)",
      "Acordo: os 4 primeiros pontuam como 4º colocado, 2.286 cada",
      "Posições 1 a 4, como 4º colocado (detectado automaticamente)",
      "Acordo: posições 1 a 4, como 4º colocado (detectado automaticamente)",
      "acordo entre as posições 1 a 4; deveria pontuar como a posição 4",
      "O acordo informado (os 4 primeiros) é diferente do detectado automaticamente: nenhum acordo detectado",
    ]);
  });

  // Item acrescentado com autorização do usuário em 05/11/2026 (torneio cancelado).
  it("torneio cancelado: controle na aba Torneios, confirmação com Sim e Não, motivo e faixa de confiança", () => {
    expect([CANCELADO.rotulo, CANCELADO.controle("EV #2"), CANCELADO.cancelar("EV #2"), CANCELADO.reativar("EV #2"), CANCELADO.sim, CANCELADO.nao, CANCELADO.causa, CANCELADO.faixa(2)], TRAVADA).toEqual([
      "Cancelado", "Torneio cancelado: EV #2", "Deseja cancelar o torneio (EV #2)?", "Deseja reativar o torneio (EV #2)?", "Sim", "Não", "Torneio cancelado (marcado pelo usuário)", "Torneios cancelados: 2",
    ]);
    // o controle fica ao lado do cartão do torneio (não dentro do botão que abre o painel) e não mexe no painel lateral nem na aba Jogadores
    const outras = readFileSync("app/components/Outras.tsx", "utf8");
    expect(outras).toMatch(/<\/button>\s*<ControleCancelado/);
  });

  it("painel: o cartão Acordo fica no corpo, logo abaixo de Conta correta; o rodapé tem só Anterior, Próximo e Revisado", () => {
    const detalhe = readFileSync("app/components/Detalhe.tsx", "utf8");
    const cartao = detalhe.search(/\{cartaoAcordo\}\s/);
    expect(cartao, TRAVADA).toBeGreaterThan(detalhe.indexOf("PAINEL_BLOCOS.conta"));
    expect(cartao, TRAVADA).toBeLessThan(detalhe.indexOf("PAINEL_BLOCOS.registrado"));
    const painel = readFileSync("app/components/Painel.tsx", "utf8");
    const rodape = painel.slice(painel.indexOf('<footer className="painel-rodape">'), painel.indexOf("</footer>"));
    expect(rodape.match(/<button/g), TRAVADA).toHaveLength(3);
    expect(rodape, TRAVADA).not.toContain("<Acordo");
  });

  it("aba Resumo: seções e ordem", () => {
    expect(SECOES_RESUMO.map((s) => s.nome), TRAVADA).toEqual(["Veredito", "Indicadores", "Composição", "Principais causas", "Torneios com problema"]);
  });

  it("painel lateral: blocos e ordem", () => {
    expect(PAINEL_BLOCOS_ORDEM, TRAVADA).toEqual(["Resultado", "Conta correta", "Registrado no site", "Hipótese da causa"]);
  });

  it("conta: três blocos e o resultado", () => {
    expect(CONTA_BLOCOS_ORDEM, TRAVADA).toEqual(["Base da posição", "Fator de participantes", "Fator de buy-in", "Pontos corretos"]);
  });

  it("endereço: parâmetros", () => {
    expect({ ...ENDERECO }, TRAVADA).toEqual({ etapa: "etapa", aba: "aba", causa: "causa", torneio: "torneio", busca: "busca", ordem: "ordem", item: "ver" });
    expect({ ...ENDERECO_EXTRA }, TRAVADA).toEqual({ soErro: "soerro", visao: "visao", fator: "fator", modo: "modo", spt: "spt" });
  });

  it("atalhos de teclado do painel", () => {
    expect(
      Object.values(ATALHOS).map((a) => [a.simbolo, a.tecla]),
      TRAVADA,
    ).toEqual([["←", "ArrowLeft"], ["→", "ArrowRight"], ["Esc", "Escape"]]);
  });

  it("os componentes continuam importando a estrutura (sem nomes duplicados à mão)", () => {
    for (const arq of ["page.tsx", "components/Barra.tsx", "components/Erros.tsx", "components/Outras.tsx", "components/Painel.tsx", "components/Planilha.tsx", "components/Consolidado.tsx", "components/Acordo.tsx", "components/Resumo.tsx", "components/Detalhe.tsx"])
      expect(readFileSync(`app/${arq}`, "utf8"), `${TRAVADA} (${arq} deve importar app/components/estrutura.ts)`).toMatch(/from "(\.\/|\.\/components\/)estrutura"/);
    const page = readFileSync("app/page.tsx", "utf8");
    for (const nome of ["Divergências de inscritos", "Aguardando regra"]) expect(page, `${TRAVADA} ("${nome}" deve vir de estrutura.ts)`).not.toContain(`"${nome}"`);
  });
});
