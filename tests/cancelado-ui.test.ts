// @vitest-environment jsdom
import { createElement as h } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ControleCancelado } from "../app/components/Cancelado";
import { Torneios } from "../app/components/Outras";
import { CANCELADO } from "../app/components/estrutura";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let raiz: Root;
let alvo: HTMLDivElement;
beforeEach(() => {
  alvo = document.createElement("div");
  document.body.appendChild(alvo);
  raiz = createRoot(alvo);
});
afterEach(() => {
  act(() => raiz.unmount());
  alvo.remove();
});
const render = (el: React.ReactElement) => act(() => raiz.render(el));
const clicar = (el: Element) => act(() => (el as HTMLElement).click());
const esc = (el: Element) => act(() => void el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
const caixa = () => alvo.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
const botao = (texto: string) => [...alvo.querySelectorAll("button")].find((b) => b.textContent === texto)!;
const confirmacao = () => alvo.querySelector('[role="group"]');
const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("ControleCancelado: confirmação", () => {
  it("o controle fica visível sem abrir nada e a confirmação só aparece ao clicar", () => {
    render(h(ControleCancelado, { nome: "EV #2 200K PLO 5 K.O", cancelado: false, onMudar: async () => null }));
    expect(caixa().checked).toBe(false);
    expect(caixa().getAttribute("aria-label")).toBe("Torneio cancelado: EV #2 200K PLO 5 K.O");
    expect(alvo.textContent).toContain("Cancelado");
    expect(confirmacao()).toBeNull();
  });

  it("marcar mostra o texto exato com o nome do torneio, com Sim e Não; o foco entra na caixa (em Não)", () => {
    render(h(ControleCancelado, { nome: "EV #2 200K PLO 5 K.O", cancelado: false, onMudar: async () => null }));
    clicar(caixa());
    expect(confirmacao()!.textContent).toContain("Deseja cancelar o torneio (EV #2 200K PLO 5 K.O)?");
    expect(confirmacao()!.textContent).toBe("Deseja cancelar o torneio (EV #2 200K PLO 5 K.O)?SimNão");
    expect(document.activeElement).toBe(botao("Não"));
    expect(caixa().checked).toBe(false); // a marca só muda depois do Sim
  });

  it('"Não" fecha sem alterar nada e devolve o foco ao controle', async () => {
    const onMudar = vi.fn(async () => null);
    render(h(ControleCancelado, { nome: "HORSE", cancelado: false, onMudar }));
    clicar(caixa());
    clicar(botao("Não"));
    await esperar();
    expect(onMudar).not.toHaveBeenCalled();
    expect(confirmacao()).toBeNull();
    expect(caixa().checked).toBe(false);
    expect(document.activeElement).toBe(caixa());
  });

  it("Esc = Não: fecha sem gravar e o foco volta ao controle", async () => {
    const onMudar = vi.fn(async () => null);
    render(h(ControleCancelado, { nome: "HORSE", cancelado: false, onMudar }));
    clicar(caixa());
    esc(botao("Não"));
    await esperar();
    expect(onMudar).not.toHaveBeenCalled();
    expect(confirmacao()).toBeNull();
    expect(document.activeElement).toBe(caixa());
  });

  it('"Sim" grava (cancelar = true) e, quando o servidor confirma, a marca muda e a confirmação fecha', async () => {
    const onMudar = vi.fn(async () => null);
    render(h(ControleCancelado, { nome: "HORSE", cancelado: false, onMudar }));
    clicar(caixa());
    clicar(botao("Sim"));
    await esperar();
    expect(onMudar).toHaveBeenCalledTimes(1);
    expect(onMudar).toHaveBeenCalledWith(true);
    render(h(ControleCancelado, { nome: "HORSE", cancelado: true, onMudar })); // a auditoria voltou com o torneio cancelado
    await esperar();
    expect(caixa().checked).toBe(true);
    expect(confirmacao()).toBeNull();
    expect(document.activeElement).toBe(caixa());
  });

  it("desmarcar também pede confirmação (reativar); Sim grava false", async () => {
    const onMudar = vi.fn(async () => null);
    render(h(ControleCancelado, { nome: "HORSE", cancelado: true, onMudar }));
    expect(caixa().checked).toBe(true);
    clicar(caixa());
    expect(confirmacao()!.textContent).toContain("Deseja reativar o torneio (HORSE)?");
    expect(onMudar).not.toHaveBeenCalled();
    clicar(botao("Sim"));
    await esperar();
    expect(onMudar).toHaveBeenCalledWith(false);
  });

  it("erro do servidor: mensagem clara, a confirmação continua aberta e a marca não muda", async () => {
    const onMudar = vi.fn(async () => "Torneio não encontrado nesta etapa.");
    render(h(ControleCancelado, { nome: "HORSE", cancelado: false, onMudar }));
    clicar(caixa());
    clicar(botao("Sim"));
    await esperar();
    expect(alvo.querySelector('[role="alert"]')!.textContent).toBe("Torneio não encontrado nesta etapa.");
    expect(caixa().checked).toBe(false);
    expect(botao("Sim")).toBeTruthy();
  });

  it("os textos vêm de CANCELADO (estrutura.ts)", () => {
    expect(CANCELADO.cancelar("X")).toBe("Deseja cancelar o torneio (X)?");
    expect(CANCELADO.reativar("X")).toBe("Deseja reativar o torneio (X)?");
    expect([CANCELADO.sim, CANCELADO.nao]).toEqual(["Sim", "Não"]);
  });
});

describe("aba Torneios: um controle por torneio, ao lado do cartão que continua clicável", () => {
  const torneio = (id: string, nome: string, cancelado: boolean) => ({
    id, nome, estado: "ok", inscritos: 10, premiados: 3, resultados: 5, corretos: 5, erros: 0, participacao: 0, comPosicao: 5,
    buyIns: null, reentries: null, acoes: null, acordoTexto: null, chaveCancelamento: id, cancelado,
  });
  const d = { origem: { tipo: "site" }, painel: { torneios: [torneio("a", "EV #1", false), torneio("b", "EV #2", true)] } };

  it("cada torneio tem seu controle; clicar no cartão ainda navega; Sim chama onCancelado com a chave", async () => {
    const navegar = vi.fn();
    const onCancelado = vi.fn(async () => null);
    render(h(Torneios, { d: d as never, navegar, onCancelado }));
    const caixas = alvo.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect([...caixas].map((c) => c.checked)).toEqual([false, true]);
    expect(alvo.querySelectorAll("li")).toHaveLength(2);
    expect(alvo.textContent).toContain(CANCELADO.causa); // o torneio cancelado traz a marca
    clicar(alvo.querySelector("button.linha-erro")!);
    expect(navegar).toHaveBeenCalled();
    clicar(caixas[0]);
    expect(confirmacao()!.textContent).toContain("Deseja cancelar o torneio (EV #1)?");
    clicar(botao("Sim"));
    await esperar();
    expect(onCancelado).toHaveBeenCalledWith("a", true);
    expect(navegar).toHaveBeenCalledTimes(1); // a confirmação não abre o painel
  });
});
