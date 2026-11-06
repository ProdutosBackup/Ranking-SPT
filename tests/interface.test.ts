import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ABAS, ACOES, ACORDO, ATALHOS, BARRA_ITENS, CAMPO, CANCELADO, CONSOLIDADO, PARTICIPACAO, CONSOLIDADO_ITENS, CONTA_BLOCOS_ORDEM, ENDERECO, ENDERECO_EXTRA, PAINEL_BLOCOS_ORDEM, PLANILHA_ITENS, SECOES_RESUMO, TEXTOS_PLANILHA,
} from "../app/components/estrutura";

// Estrutura aprovada pelo usuário em 19/10/2026 (docs/interface.md). Mudar qualquer item abaixo exige autorização explícita.
const TRAVADA = "Estrutura da tela travada: alteração exige autorização do usuário.";

describe("estrutura da tela travada", () => {
  it("abas: nomes e ordem", () => {
    expect(
      ABAS.map((a) => a.rotulo),
      TRAVADA,
    ).toEqual(["Resumo", "Erros", "Divergências de inscritos", "Jogadores", "Torneios", "Aguardando regra", "Regras"]);
    expect(ABAS.map((a) => a.id), TRAVADA).toEqual(["resumo", "erros", "divergencias", "jogadores", "torneios", "aguardando", "regras"]);
    expect(ABAS.filter((a) => a.comContador).map((a) => a.id), TRAVADA).toEqual(["erros", "divergencias", "jogadores", "torneios", "aguardando"]);
  });

  it("barra superior: itens e ordem", () => {
    expect(BARRA_ITENS, TRAVADA).toEqual(["Etapa", "Auditar etapa", "Enviar planilha", "Baixar relatório", "Exportar dados", "Consolidado", "Faixa de confiança"]);
  });

  // Itens acrescentados com autorização do usuário em 21/10/2026 (envio de planilha).
  it("envio de planilha: marca, confirmação, bloco de resumo e textos de origem", () => {
    expect(PLANILHA_ITENS, TRAVADA).toEqual([
      "Planilha carregada", "Remover planilha", "Remover a planilha para todos?", "Sim", "Não", "O que foi lido", "Premiados da lista informada pelo responsável",
    ]);
    expect(TEXTOS_PLANILHA.faixa("a.xlsx", "21/10/2026 14:00"), TRAVADA).toBe("Dados da planilha a.xlsx, enviada em 21/10/2026 14:00 (Brasília)");
    expect(TEXTOS_PLANILHA.mudou, TRAVADA).toBe("A planilha foi trocada ou removida depois desta auditoria. Audite de novo.");
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
      "Vale 10 × fatores, com o campo igual à soma das entradas dos flights. O jogador pontua uma vez só no Main Event.",
      "Participação nos flights",
      "O Main Event é um torneio só e cada jogador pontua uma vez. A pontuação fica no primeiro flight que o jogador jogou (1A, 1C, 1D, 1E) e os outros flights valem 0. Quem chegou ao Dia Final leva para esse flight a pontuação do Dia Final (com posição, a base da posição × fatores; sem posição, 10 × fatores), e a linha do Dia Final dele vale 0, porque o Dia Final é continuação dos flights. Quem não jogou flight (Etapas 2 e 3) pontua no Dia Final. Quem só jogou flights vale 10 × fatores no primeiro flight. O campo, igual para todas as linhas do Main Event, é a soma das entradas dos flights; o buy-in do flight é R$ 1.000 e o do Dia Final é R$ 0 (fator 1,0 nos dois).",
      "Fonte: decisão do responsável do ranking, confirmada em 05/11/2026.",
      "Com posição",
      "Nenhum resultado aguardando regra.",
    ]);
    // Main Event como um torneio só (05/11/2026): textos das linhas de flight que valem 0.
    expect([PARTICIPACAO.flightComFinal, PARTICIPACAO.finalCedido, PARTICIPACAO.zeroMaisDeUm, PARTICIPACAO.campo(331, [96, 50, 64, 67, 54])], TRAVADA).toEqual([
      "Flight de jogador que chegou ao Dia Final: a pontuação do Main Event vale no flight",
      "Dia Final de jogador que jogou flight: a pontuação do jogador vale no flight dele",
      "Jogou mais de um flight: vale só o primeiro",
      "campo: soma dos flights 331 = 96+50+64+67+54",
    ]);
  });

  it("opção de regra: campo do torneio (inscritos por padrão, ou ações)", () => {
    expect([CAMPO.rotulo, CAMPO.inscritos, CAMPO.acoes], TRAVADA).toEqual(["Campo do torneio", "Inscritos (só buy-ins)", "Ações (buy-ins + re-entries)"]);
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
