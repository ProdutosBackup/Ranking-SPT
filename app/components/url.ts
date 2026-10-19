"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Estado da tela no endereço (?aba=erros&causa=...). Lê o endereço depois de montar (evita diferença com o HTML
 * pré-renderizado) e acompanha o botão voltar. `push` cria uma entrada no histórico; `replace` só troca a atual.
 */
export function useUrl() {
  const [q, setQ] = useState(() => new URLSearchParams());
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const ler = () => setQ(new URLSearchParams(window.location.search));
    ler();
    setPronto(true);
    window.addEventListener("popstate", ler);
    return () => window.removeEventListener("popstate", ler);
  }, []);

  const navegar = useCallback((alteracoes: Record<string, string | null>, modo: "push" | "replace" = "push") => {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(alteracoes)) {
      if (v == null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    const url = window.location.pathname + (s ? `?${s}` : "");
    if (modo === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    setQ(p);
  }, []);

  return { q, pronto, navegar };
}
