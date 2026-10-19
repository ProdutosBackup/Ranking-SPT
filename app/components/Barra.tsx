"use client";

import { BARRA } from "./estrutura";
import { dataBr } from "./formato";
import type { Resposta } from "./tipos";

export const ETAPAS = [
  { v: "taua-2026", t: "Etapa 1 — Tauá Resort Atibaia (referência)" },
  { v: "vale-suico-2026", t: "Etapa 2 — Vale Suíço Resort" },
  { v: "bendito-cacao-2026", t: "Etapa 3 — Bendito Cacao Family Resort" },
];

const DISPONIVEL_DEPOIS = "Disponível depois de auditar a etapa.";

type Props = {
  stage: string;
  onEtapa: (v: string) => void;
  satelites: boolean;
  onSatelites: (v: boolean) => void;
  carregando: boolean;
  progresso: [number, number] | null;
  onAuditar: () => void;
  onBaixar: (tipo: "relatorio" | "exportacao") => void;
  baixando: string | null;
  d: Resposta | undefined;
};

function Confianca({ d, classe }: { d: Resposta; classe: string }) {
  return (
    <div className={`confianca ${classe}`}>
      <span>
        Dados do site de <b>{dataBr(d.updatedAt.ranking)}</b> (Brasília)
      </span>
      <span>
        Identificador <b className="cod">{d.identificador.sha256.slice(0, 8)}</b>
      </span>
      <span className="selo">✓ Conta conferida por dois cálculos independentes</span>
    </div>
  );
}

export function Barra(p: Props) {
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
          <fieldset className="campo">
            <legend>{BARRA.satelites}</legend>
            <div className="opcoes">
              <label className="opcao">
                <input type="radio" name="sat" checked={p.satelites} onChange={() => p.onSatelites(true)} />
                <span>Sim</span>
              </label>
              <label className="opcao">
                <input type="radio" name="sat" checked={!p.satelites} onChange={() => p.onSatelites(false)} />
                <span>Não</span>
              </label>
            </div>
          </fieldset>
          <button className="btn" type="submit" disabled={p.carregando}>
            {p.carregando ? "Auditando…" : BARRA.auditar}
          </button>
          <button className="btn sec" type="button" disabled={!p.d || p.baixando !== null} title={p.d ? undefined : DISPONIVEL_DEPOIS} onClick={() => p.onBaixar("relatorio")}>
            {p.baixando === "relatorio" ? "Gerando…" : BARRA.baixar}
          </button>
          <button className="btn sec" type="button" disabled={!p.d || p.baixando !== null} title={p.d ? undefined : DISPONIVEL_DEPOIS} onClick={() => p.onBaixar("exportacao")}>
            {p.baixando === "exportacao" ? "Gerando…" : BARRA.exportar}
          </button>
        </form>
        {p.d && <Confianca d={p.d} classe="na-barra" />}
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
