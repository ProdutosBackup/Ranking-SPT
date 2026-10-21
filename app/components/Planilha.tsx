"use client";

import { useEffect, useRef, useState } from "react";
import { PLANILHA } from "./estrutura";
import { dataBr, n } from "./formato";
import type { PlanilhaGuardada, Resposta } from "./tipos";

/** Marca "Planilha carregada" com o botão X (pede confirmação antes de remover para todos). */
export function MarcaPlanilha({
  p,
  removendo,
  onRemover,
  podeAbrirLido,
  onAbrirLido,
}: {
  p: PlanilhaGuardada;
  removendo: boolean;
  onRemover: () => void;
  podeAbrirLido: boolean;
  onAbrirLido: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const xRef = useRef<HTMLButtonElement>(null);
  const vindoDaConfirmacao = useRef(false);
  // Ao desistir, o foco volta para o X (ele só reaparece depois da renderização).
  useEffect(() => {
    if (!confirmando && vindoDaConfirmacao.current) xRef.current?.focus();
    vindoDaConfirmacao.current = confirmando;
  }, [confirmando]);

  return (
    <div className="marca-planilha" role="group" aria-label={PLANILHA.marca}>
      <span className="marca-texto">
        {PLANILHA.marca}: <b>{p.arquivo}</b> · enviada em {dataBr(p.enviadoEm)} (Brasília)
      </span>
      {podeAbrirLido && (
        <button type="button" className="texto-btn" onClick={onAbrirLido}>
          {PLANILHA.lido}
        </button>
      )}
      {confirmando ? (
        <span className="confirmar-remocao" role="group" aria-label={PLANILHA.confirmar}>
          <span>{PLANILHA.confirmar}</span>
          <button
            type="button"
            className="btn sec"
            onClick={() => {
              setConfirmando(false);
              onRemover();
            }}
          >
            {PLANILHA.sim}
          </button>
          <button type="button" className="btn sec" autoFocus onClick={() => setConfirmando(false)}>
            {PLANILHA.nao}
          </button>
        </span>
      ) : (
        <button ref={xRef} type="button" className="x-planilha" aria-label={PLANILHA.remover} title={PLANILHA.remover} disabled={removendo} onClick={() => setConfirmando(true)}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** Bloco compacto "O que foi lido", acima das abas. Os avisos ficam recolhidos, com a contagem. */
export function BlocoLido({ p, d, onFechar }: { p: PlanilhaGuardada; d: Resposta; onFechar: () => void }) {
  const inscritos = d.origem.tipo === "planilha" ? d.origem.inscritosDiaFinal?.texto : null;
  return (
    <section className="aviso lido" aria-labelledby="t-lido">
      <div className="lido-topo">
        <h3 id="t-lido">{PLANILHA.lido}</h3>
        <button type="button" className="texto-btn" onClick={onFechar}>
          Fechar
        </button>
      </div>
      <ul className="lido-lista">
        <li>
          {n(p.resumo.torneios)} torneios · {n(p.resumo.jogadores)} jogadores · {n(p.resumo.linhas)} resultados
        </li>
        {inscritos && <li>Inscritos do Dia Final: {inscritos}</li>}
        <li>{PLANILHA.premiadosInferidos}</li>
      </ul>
      {p.avisos.length > 0 ? (
        <details>
          <summary>Avisos ({n(p.avisos.length)})</summary>
          <ul className="lido-avisos">
            {p.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="muted small">Nenhum aviso.</p>
      )}
    </section>
  );
}
