"use client";

// Padrão de página: Lista / Índice (ranking com busca). Este arquivo só exibe; a soma está em lib/consolidado.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import { avisoAguardando, chaveNome, type Consolidado as Dados } from "../../lib/consolidado";
import { montarColuna, type Fator, type Motivo, type Visao } from "./colunas";
import { CONSOLIDADO, ENDERECO_EXTRA } from "./estrutura";
import type { Navegar } from "./tipos";
import { n } from "./formato";

export type EtapaOpcao = { numero: number; rotulo: string; estado: "ok" | "sem-dados" | "verificando" };

const LOTE = 100;
const pontos = (cent: number | null) => (cent == null ? "—" : n(cent / 100, 2));

/** "Dados insuficientes" com o motivo: no title (mouse), em aria-describedby (leitor de tela) e visível ao focar pelo teclado. */
function MarcaInsuficiente({ id, motivos }: { id: string; motivos: Motivo[] }) {
  const linhas = motivos.map((m) => CONSOLIDADO.motivoEtapa(m.etapa, m.motivo, m.linhas));
  return (
    <>
      <span className="insuf-marca" tabIndex={0} title={linhas.join("\n") || undefined} aria-describedby={id}>
        {CONSOLIDADO.insuficiente}
      </span>
      <span className="insuf-dica" id={id}>
        {linhas.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </span>
    </>
  );
}

export function Consolidado({
  ate,
  etapas,
  onAte,
  dados,
  carregando,
  erro,
  regra,
  onSair,
  q,
  navegar,
}: {
  ate: number;
  etapas: EtapaOpcao[];
  onAte: (numero: number) => void;
  dados: Dados | null;
  carregando: string | null;
  erro: string | null;
  regra: string | null;
  onSair: () => void;
  q: URLSearchParams;
  navegar: Navegar;
}) {
  const [busca, setBusca] = useState("");
  const [mostrar, setMostrar] = useState(LOTE);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []); // ao abrir, o foco vai para o título da visão

  // Faixa e título de coluna acompanham a rolagem só quando barra + faixa + título ocupam no máximo metade da altura da janela.
  const raiz = useRef<HTMLElement>(null);
  const comDados = dados != null;
  useEffect(() => {
    const el = raiz.current;
    const barra = document.querySelector<HTMLElement>(".barra-topo");
    if (!el || !comDados) return;
    const medir = () => {
      const h = (e: Element | null) => (e as HTMLElement | null)?.offsetHeight ?? 0;
      const [b, f, c] = [h(barra), h(el.querySelector(".cons-faixa")), h(el.querySelector(".cons-cab"))];
      el.style.setProperty("--h-barra", `${b}px`);
      el.style.setProperty("--h-faixa", `${f}px`);
      el.dataset.fixo = b + f + c <= window.innerHeight / 2 ? "sim" : "nao";
    };
    medir();
    const ro = new ResizeObserver(medir);
    for (const e of [barra, el, el.querySelector(".cons-faixa"), el.querySelector(".cons-cab")]) if (e) ro.observe(e);
    window.addEventListener("resize", medir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [comDados]);

  const termo = chaveNome(busca);
  // Seletores da visão: ficam só no endereço e escolhem entre dados já lidos; trocar qualquer um não faz requisição.
  const fator: Fator = q.get(ENDERECO_EXTRA.fator) === "0,9" ? "0,9" : "1,0";
  const modo = q.get(ENDERECO_EXTRA.modo) === "etapa" ? "etapa" : "acumulado";
  const lidas = dados?.etapas ?? [];
  const pedida = lidas.indexOf(Number(q.get(ENDERECO_EXTRA.spt)));
  const indice = pedida >= 0 ? pedida : Math.max(lidas.length - 1, 0);
  const colunas = useMemo(() => {
    if (!dados) return [];
    const v: Visao = modo === "etapa" ? { tipo: "etapa", indice, numero: lidas[indice] } : { tipo: "acumulado" };
    return (["estava", "entradas", "acoes"] as const).map((c) => montarColuna(dados.jogadores, c, fator, v));
  }, [dados, fator, modo, indice]);
  const maisRestantes = Math.max(0, ...colunas.map((itens) => (termo ? itens.filter((i) => chaveNome(i.nome).includes(termo)) : itens).length - mostrar));
  const trocar = (alt: Record<string, string | null>) => navegar(alt, "replace");
  const totalAguardando = dados?.aguardando.reduce((a, x) => a + x.n, 0) ?? 0;

  return (
    <section className="consolidado" aria-labelledby="t-cons" ref={raiz}>
      <div className="cons-topo">
        <h2 id="t-cons" ref={titulo} tabIndex={-1}>
          Consolidado
        </h2>
        <button type="button" className="btn sec" onClick={onSair} aria-keyshortcuts="Escape">
          {CONSOLIDADO.sair}
        </button>
      </div>
      <p className="muted">Três rankings lado a lado: os pontos publicados e os pontos das novas regras (só entradas e total de ações), somando as etapas da Etapa 1 até a etapa escolhida.</p>

      <div className="cons-controles">
        <div className="campo etapa">
          <label htmlFor="cons-etapa">{CONSOLIDADO.etapa}</label>
          <select id="cons-etapa" value={ate} onChange={(e) => onAte(Number(e.target.value))}>
            {etapas.map((e) => (
              <option key={e.numero} value={e.numero} disabled={e.estado !== "ok"}>
                {e.estado === "sem-dados" ? `${e.rotulo} — ${CONSOLIDADO.semDados}` : e.estado === "verificando" ? `${e.rotulo} — verificando…` : e.rotulo}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="campo">
          <legend>{CONSOLIDADO.fator}</legend>
          <div className="opcoes">
            {CONSOLIDADO.fatores.map((f) => (
              <label className="opcao" key={f}>
                <input type="radio" name="cons-fator" checked={fator === f} onChange={() => trocar({ [ENDERECO_EXTRA.fator]: f === "1,0" ? null : f })} />
                <span>{f}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="campo">
          <legend>{CONSOLIDADO.modo}</legend>
          <div className="opcoes">
            {CONSOLIDADO.modos.map((m, i) => (
              <label className="opcao" key={m}>
                <input type="radio" name="cons-modo" checked={(i === 1) === (modo === "etapa")} onChange={() => trocar({ [ENDERECO_EXTRA.modo]: i === 1 ? "etapa" : null })} />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {modo === "etapa" && (
          <fieldset className="campo">
            <legend>{CONSOLIDADO.etapaVisao}</legend>
            <div className="opcoes">
              {CONSOLIDADO.etapasVisao.map((r, i) => (
                <label className="opcao" key={r}>
                  <input type="radio" name="cons-spt" disabled={!lidas.includes(i + 1)} checked={lidas[indice] === i + 1} onChange={() => trocar({ [ENDERECO_EXTRA.spt]: String(i + 1) })} />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="campo busca">
          <label htmlFor="cons-busca">{CONSOLIDADO.busca}</label>
          <input
            id="cons-busca"
            type="search"
            value={busca}
            autoComplete="off"
            onChange={(e) => {
              setBusca(e.target.value);
              setMostrar(LOTE);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && busca) {
                e.preventDefault(); // o primeiro Esc só limpa a busca; o seguinte sai da visão
                setBusca("");
              }
            }}
          />
        </div>
      </div>

      {erro && (
        <div className="aviso bloqueio" role="alert">
          <b>Não foi possível montar o consolidado.</b> {erro}
        </div>
      )}
      {carregando && (
        <p className="muted" role="status" aria-live="polite">
          {carregando}
        </p>
      )}

      {dados && totalAguardando > 0 && (
        <div className="aviso atencao" role="status">
          <p className="aviso-fixo">{avisoAguardando(totalAguardando)}</p>
          <details>
            <summary>Por etapa</summary>
            <ul className="lido-avisos">
              {dados.aguardando.map((a) => (
                <li key={a.etapa}>
                  Etapa {a.etapa}: {n(a.n)} {a.n === 1 ? "resultado" : "resultados"}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
      {dados && dados.avisos.length > 0 && (
        <details className="cons-avisos">
          <summary>Avisos ({n(dados.avisos.length)})</summary>
          <ul className="lido-avisos">
            {dados.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      {dados && (
        <>
          <p className="cons-faixa" role="status" aria-live="polite">
            {CONSOLIDADO.faixa(fator, modo === "etapa" ? `Etapa ${dados.etapas[indice]}` : CONSOLIDADO.modos[0])}
          </p>
          <div className="cons-colunas">
            {colunas.map((itens, c) => {
              const semDados = c === 2 ? itens.filter((i) => i.cent == null).length : 0; // conta todos, não só as linhas desenhadas
              const visiveis = termo ? itens.filter((i) => chaveNome(i.nome).includes(termo)) : itens;
              return (
                <section className="cons-col" key={c} aria-labelledby={`cons-col-${c}`}>
                  <div className="cons-cab">
                    <h3 id={`cons-col-${c}`}>{CONSOLIDADO.titulos[c]}</h3>
                    <p className="contagem-lista" role="status">
                      {termo ? `${n(visiveis.length)} de ${n(itens.length)} jogadores` : `${n(itens.length)} jogadores`}
                      {c === 2 && semDados > 0 && <b className="cons-insuf-total"> · {CONSOLIDADO.contador(semDados)}</b>}
                    </p>
                  </div>
                  <table className="tabela-col">
                    <thead>
                      <tr>
                        <th scope="col" className="num">{CONSOLIDADO.colunas[0]}</th>
                        <th scope="col">{CONSOLIDADO.colunas[1]}</th>
                        <th scope="col" className="num">{CONSOLIDADO.colunas[2]}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.slice(0, mostrar).map((i) => (
                        <tr key={i.chave}>
                          <td className="num" title={i.empate ? "Empate" : undefined}>
                            {i.pos}
                            {i.empate && <span aria-label=" (empate)">=</span>}
                          </td>
                          <th scope="row">{i.nome}</th>
                          {i.cent == null ? (
                            <td className="num insuf">
                              <MarcaInsuficiente id={`insuf-${c}-${i.chave}`} motivos={i.motivos} />
                            </td>
                          ) : (
                            <td className="num forte">{pontos(i.cent)}</td>
                          )}
                        </tr>
                      ))}
                      {visiveis.length === 0 && (
                        <tr>
                          <td colSpan={3} className="vazio">
                            {termo ? `Nenhum jogador encontrado para “${busca}”.` : "Nenhum jogador nesta etapa."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              );
            })}
          </div>
          {maisRestantes > 0 && (
            <button type="button" className="btn sec mais" onClick={() => setMostrar((m) => m + LOTE)}>
              Mostrar mais {n(Math.min(LOTE, maisRestantes))}
            </button>
          )}
          <p className="muted small">
            {regra ? `Pontos corretos calculados com esta regra para quem fica fora da premiação: ${regra}. ` : ""}"Ranking como estava" soma todos os pontos publicados, inclusive os aguardando regra; nas novas regras esses resultados ficam fora da soma, sem pontos inventados. Em caso de empate em pontos, vale quem tem mais
            primeiros lugares (regulamento); como o site não informa mesas finais nem buy-ins investidos, quem continua empatado divide a posição (=).
          </p>
        </>
      )}
    </section>
  );
}
