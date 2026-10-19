"use client";

import { useRef } from "react";

export type Aba = { id: string; rotulo: string; contador?: number };

/** Botões segmentados. Setas ← → movem entre as abas (o foco acompanha). */
export function Abas({ abas, atual, onMudar }: { abas: Aba[]; atual: string; onMudar: (id: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const mover = (i: number, passo: number) => {
    const j = (i + passo + abas.length) % abas.length;
    refs.current[j]?.focus();
    onMudar(abas[j].id);
  };
  return (
    <div className="abas" role="tablist" aria-label="Seções da auditoria">
      {abas.map((a, i) => (
        <button
          key={a.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          id={`aba-${a.id}`}
          aria-selected={atual === a.id}
          aria-controls="conteudo-aba"
          tabIndex={atual === a.id ? 0 : -1}
          className={`aba ${atual === a.id ? "ativa" : ""}`}
          onClick={() => onMudar(a.id)}
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
