"use client";

import { useEffect, useRef } from "react";

/** `desabilitada`: a aba ainda não tem o que mostrar (as abas da auditoria, antes de auditar uma etapa). */
export type Aba = { id: string; rotulo: string; contador?: number; desabilitada?: boolean };

/** Botões segmentados. Setas ← → movem entre as abas habilitadas (o foco acompanha). A rolagem horizontal fica só dentro da barra, com a aba ativa visível. */
export function Abas({ abas, atual, onMudar }: { abas: Aba[]; atual: string; onMudar: (id: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const barra = useRef<HTMLDivElement>(null);
  // Sem aba ativa (antes de auditar): o Tab entra pela primeira aba habilitada.
  const entrada = abas.some((a) => a.id === atual) ? atual : abas.find((a) => !a.desabilitada)?.id;
  const mover = (i: number, passo: number) => {
    let j = i;
    for (let k = 0; k < abas.length; k++) {
      j = (j + passo + abas.length) % abas.length;
      if (!abas[j].desabilitada) break;
    }
    if (j === i || abas[j].desabilitada) return;
    refs.current[j]?.focus();
    onMudar(abas[j].id);
  };
  // A aba ativa fica sempre visível: ajusta só a rolagem da própria barra (nunca a da página).
  useEffect(() => {
    const el = refs.current[abas.findIndex((a) => a.id === atual)];
    const b = barra.current;
    if (!el || !b) return;
    const margem = 8;
    if (el.offsetLeft - margem < b.scrollLeft) b.scrollLeft = Math.max(0, el.offsetLeft - margem);
    else if (el.offsetLeft + el.offsetWidth + margem > b.scrollLeft + b.clientWidth) b.scrollLeft = el.offsetLeft + el.offsetWidth + margem - b.clientWidth;
  }, [atual, abas.length]);
  return (
    <div className="abas" role="tablist" aria-label="Seções da auditoria" ref={barra}>
      {abas.map((a, i) => (
        <button
          key={a.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          id={`aba-${a.id}`}
          aria-selected={atual === a.id}
          aria-disabled={a.desabilitada || undefined}
          aria-controls="conteudo-aba"
          tabIndex={entrada === a.id ? 0 : -1}
          className={`aba ${atual === a.id ? "ativa" : ""}`}
          onClick={() => {
            if (!a.desabilitada) onMudar(a.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); mover(i, 1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); mover(i, -1); }
          }}
        >
          {a.rotulo}
          {a.contador != null && <span className="contador">{a.contador.toLocaleString("pt-BR")}</span>}
        </button>
      ))}
    </div>
  );
}
