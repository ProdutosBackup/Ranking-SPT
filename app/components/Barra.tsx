"use client";

import { useEffect, useRef, useState } from "react";
import { ACORDO, BARRA, CANCELADO, TEXTOS_PLANILHA } from "./estrutura";
import { dataBr } from "./formato";
import { MarcaPlanilha } from "./Planilha";
import type { PlanilhaGuardada, Resposta } from "./tipos";

export const ETAPAS = [
  { v: "taua-2026", t: "Etapa 1 — Tauá Resort Atibaia (referência)" },
  { v: "vale-suico-2026", t: "Etapa 2 — Vale Suíço Resort" },
  { v: "bendito-cacao-2026", t: "Etapa 3 — Bendito Cacao Family Resort" },
];

const DISPONIVEL_DEPOIS = "Disponível depois de auditar a etapa.";

type Props = {
  stage: string;
  onEtapa: (v: string) => void;
  carregando: boolean;
  progresso: [number, number] | null;
  onAuditar: () => void;
  onBaixar: (tipo: "relatorio" | "exportacao") => void;
  baixando: string | null;
  d: Resposta | undefined;
  planilha: PlanilhaGuardada | null;
  enviando: boolean;
  removendo: boolean;
  erroEnvio: string | null;
  infoEnvio: string | null;
  onEnviar: (arquivo: File) => void;
  onEnviarParticipantes: (arquivo: File) => void;
  onRemover: () => void;
  lidoFechado: boolean;
  onAbrirLido: () => void;
};

/** Status em uma linha: data dos dados, identificador e o selo de conferência (mais acordos e cancelados, quando há). */
function Confianca({ d, classe }: { d: Resposta; classe: string }) {
  return (
    <div className={`confianca ${classe}`}>
      {d.origem?.tipo === "planilha" ? (
        <span>{TEXTOS_PLANILHA.faixa(d.origem.arquivo ?? "enviada", dataBr(d.updatedAt.ranking))}</span>
      ) : (
        <span>
          Dados do site de <b>{dataBr(d.updatedAt.ranking)}</b> (Brasília)
        </span>
      )}
      <span>
        Identificador <b className="cod">{d.identificador.sha256.slice(0, 8)}</b>
      </span>
      {d.acordos?.aplicados > 0 && <span>{ACORDO.faixa(d.acordos.aplicados)}</span>}
      {d.cancelados?.aplicados > 0 && <span>{CANCELADO.faixa(d.cancelados.aplicados)}</span>}
      <span className="selo">✓ Conta conferida por dois cálculos independentes</span>
    </div>
  );
}

export function Barra(p: Props) {
  const seletor = useRef<HTMLInputElement>(null);
  const seletorParticipantes = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const envoltorio = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const itens = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];

  // Ao abrir, o foco vai para o primeiro item; clicar fora fecha.
  useEffect(() => {
    if (!aberto) return;
    itens()[0]?.focus();
    const fora = (e: PointerEvent) => {
      if (!envoltorio.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  const fechar = (voltarFoco: boolean) => {
    setAberto(false);
    if (voltarFoco) botao.current?.focus();
  };
  const teclaMenu = (e: React.KeyboardEvent) => {
    const lista = itens();
    const i = lista.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault(); // só fecha o menu: o Esc não sai do Consolidado
      fechar(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      lista[(i + 1) % lista.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      lista[(i - 1 + lista.length) % lista.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      lista[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      lista[lista.length - 1]?.focus();
    } else if (e.key === "Tab") setAberto(false);
  };

  const semDados = !p.d || p.baixando !== null;
  const ocupado = p.enviando ? "Enviando…" : p.baixando ? "Gerando…" : null;
  const texto = !p.carregando
    ? null
    : !p.progresso
      ? "Conectando ao site do SPT…"
      : p.progresso[0] < p.progresso[1]
        ? `Lendo jogadores: ${p.progresso[0]} de ${p.progresso[1]}`
        : "Conferindo as contas…";
  return (
    <>
      <div className="barra-topo">
        <div className="linha-acao">
          <div className="marca">
            <img className="logo" src="/logo-spt-transparente-560.png" alt="Suprema Poker Tour" width={560} height={195} decoding="async" fetchPriority="high" />
            <h1>Auditoria do Ranking</h1>
          </div>
          <form
            className="controles"
            onSubmit={(e) => {
              e.preventDefault();
              p.onAuditar();
            }}
          >
            <div className="campo etapa">
              <label htmlFor="etapa">{BARRA.etapa}</label>
              <select id="etapa" value={p.stage} onChange={(e) => p.onEtapa(e.target.value)}>
                {ETAPAS.map((e) => (
                  <option key={e.v} value={e.v}>
                    {e.t}
                  </option>
                ))}
              </select>
            </div>
            <button className="b-btn b-principal" type="submit" disabled={p.carregando}>
              {p.carregando ? "Auditando…" : BARRA.auditar}
            </button>
            <div className="mais-envoltorio" ref={envoltorio}>
              <button
                ref={botao}
                id="btn-mais"
                className="b-btn b-sec"
                type="button"
                aria-haspopup="menu"
                aria-expanded={aberto}
                aria-controls="menu-mais"
                aria-busy={ocupado != null}
                onClick={() => setAberto((x) => !x)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" && !aberto) {
                    e.preventDefault();
                    setAberto(true);
                  }
                }}
              >
                {ocupado ?? BARRA.mais}
              </button>
              {aberto && (
                <div ref={menu} id="menu-mais" className="menu-mais" role="menu" aria-labelledby="btn-mais" onKeyDown={teclaMenu}>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    aria-disabled={p.enviando}
                    onClick={() => {
                      if (p.enviando) return;
                      fechar(false);
                      seletor.current?.click();
                    }}
                  >
                    {p.enviando ? "Enviando…" : BARRA.enviar}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    aria-disabled={p.enviando}
                    onClick={() => {
                      if (p.enviando) return;
                      fechar(false);
                      seletorParticipantes.current?.click();
                    }}
                  >
                    {BARRA.enviarParticipantes}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    aria-disabled={semDados}
                    title={p.d ? undefined : DISPONIVEL_DEPOIS}
                    onClick={() => {
                      if (semDados) return;
                      fechar(true);
                      p.onBaixar("relatorio");
                    }}
                  >
                    {p.baixando === "relatorio" ? "Gerando…" : BARRA.baixar}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    aria-disabled={semDados}
                    title={p.d ? undefined : DISPONIVEL_DEPOIS}
                    onClick={() => {
                      if (semDados) return;
                      fechar(true);
                      p.onBaixar("exportacao");
                    }}
                  >
                    {p.baixando === "exportacao" ? "Gerando…" : BARRA.exportar}
                  </button>
                </div>
              )}
            </div>
            <input
              ref={seletor}
              type="file"
              hidden
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = ""; // permite escolher o mesmo arquivo de novo
                if (f) p.onEnviar(f);
              }}
            />
            <input
              ref={seletorParticipantes}
              type="file"
              hidden
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = ""; // permite escolher o mesmo arquivo de novo
                if (f) p.onEnviarParticipantes(f);
              }}
            />
          </form>
        </div>
        {p.erroEnvio && (
          <p className="erro-envio" role="alert">
            {p.erroEnvio}
          </p>
        )}
        {p.infoEnvio && (
          <p className="info-envio" role="status">
            {p.infoEnvio}
          </p>
        )}
        {p.d && <Confianca d={p.d} classe="na-barra" />}
        {p.planilha && (
          <MarcaPlanilha p={p.planilha} removendo={p.removendo} onRemover={p.onRemover} podeAbrirLido={p.lidoFechado && p.d?.origem?.tipo === "planilha"} onAbrirLido={p.onAbrirLido} />
        )}
        {texto && (
          <div className="progresso" role="status" aria-live="polite">
            {texto}
            <div className="trilho">
              <div style={{ transform: `scaleX(${p.progresso ? p.progresso[0] / p.progresso[1] : 0.03})` }} />
            </div>
          </div>
        )}
      </div>
      {p.d && <Confianca d={p.d} classe="abaixo-da-barra" />}
    </>
  );
}
