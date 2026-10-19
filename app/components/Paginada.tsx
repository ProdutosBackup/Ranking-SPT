"use client";

import type { ReactNode } from "react";
import { useState } from "react";

/** Mostra 50 itens e um botão "Mostrar mais". Use `key` para reiniciar quando o filtro mudar. */
export function Paginada<T>({ itens, render, passo = 50 }: { itens: T[]; render: (item: T, i: number) => ReactNode; passo?: number }) {
  const [qtd, setQtd] = useState(passo);
  return (
    <>
      {itens.slice(0, qtd).map(render)}
      {itens.length > qtd && (
        <button className="btn sec mais" type="button" onClick={() => setQtd((q) => q + passo)}>
          Mostrar mais ({(itens.length - qtd).toLocaleString("pt-BR")} restantes)
        </button>
      )}
    </>
  );
}
