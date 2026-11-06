"use client";

// Peças que o Resumo e a Auditoria usam iguais: os cartões de indicador e a lista "Como ficaram os N resultados".
import { n } from "./formato";
import type { Resposta } from "./tipos";

export type CartaoIndicador = { rotulo: string; valor: string; destaque?: boolean; extra?: string; onClick?: () => void };

/** Cartões de indicador. Com `onClick` o cartão é um botão (hover e foco visíveis); sem, só informa. */
export function CartoesIndicador({ cartoes, secao, classe }: { cartoes: CartaoIndicador[]; secao?: string; classe?: string }) {
  return (
    <div data-secao={secao} className={classe ? `cartoes ${classe}` : "cartoes"}>
      {cartoes.map((k) =>
        k.onClick ? (
          <button key={k.rotulo} type="button" className={`cartao ${k.destaque ? "destaque" : ""}`} onClick={k.onClick}>
            <b>{k.valor}</b>
            <span>{k.rotulo}</span>
          </button>
        ) : (
          <div key={k.rotulo} className={`cartao estatico ${k.destaque ? "destaque" : ""}`}>
            <b>{k.valor}</b>
            <span>{k.rotulo}</span>
          </div>
        ),
      )}
    </div>
  );
}

/** Porcentagem só para exibição, com os maiores restos, em décimos, para as partes somarem 100,0%. */
export function percentuais(qtds: number[], total: number): number[] {
  const decimos = qtds.map((q) => (total > 0 ? (q * 1000) / total : 0));
  const pctD = decimos.map(Math.floor);
  let falta = (total > 0 ? 1000 : 0) - pctD.reduce((a, b) => a + b, 0);
  [...decimos.keys()].sort((i, j) => decimos[j] - pctD[j] - (decimos[i] - pctD[i])).forEach((i) => { if (falta-- > 0) pctD[i]++; });
  return pctD.map((x) => x / 10);
}
export const pc = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "Como ficaram os N resultados": corretos, corretos com inscritos do site, erros, revisar e aguardando regra, com barra, quantidade e porcentagem. */
export function ListaDistribuicao({ d, secao }: { d: Resposta; secao?: string }) {
  const { indicadores: ind } = d.painel;
  const c = ind.composicao;
  const total = ind.auditados;
  const partes = [
    { id: "corretos", rotulo: "Corretos", qtd: c.corretos },
    { id: "site", rotulo: "Corretos com inscritos do site", qtd: c.corretosSite },
    { id: "erros", rotulo: "Erros", qtd: c.erros },
    { id: "revisar", rotulo: "Revisar", qtd: c.revisar },
    { id: "aguardando", rotulo: "Aguardando regra", qtd: c.aguardando },
  ];
  const pct = percentuais(partes.map((p) => p.qtd), total);
  return (
    <section data-secao={secao} aria-labelledby="t-comp">
      <h2 id="t-comp">Como ficaram os {n(total)} resultados</h2>
      <ul className="situacoes">
        {partes.map((p, i) => (
          <li key={p.id} className={`${p.id}${p.qtd === 0 ? " zero" : ""}`}>
            <span className="vh">{`${p.rotulo}: ${n(p.qtd)}, ${pc(pct[i])}%`}</span>
            <span className="amostra" aria-hidden="true" />
            <span aria-hidden="true">{p.rotulo}</span>
            <span className="barra" aria-hidden="true">
              <span style={{ transform: `scaleX(${total > 0 ? p.qtd / total : 0})` }} />
            </span>
            <b className="qtd" aria-hidden="true">{n(p.qtd)}</b>
            <span className="pct" aria-hidden="true">{pc(pct[i])}%</span>
          </li>
        ))}
      </ul>
      <p className="muted small">Porcentagens sobre os {n(total)} resultados da etapa.</p>
      <p className="muted small">Satélites, Ladies e All in or Fold não pontuam</p>
    </section>
  );
}
