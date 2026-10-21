"use client";

// Padrão de página: Lista / Índice (ranking com busca). Este arquivo só exibe; a soma está em lib/consolidado.ts.
import { useEffect, useRef, useState } from "react";
import { avisoAguardando, chaveNome, type Consolidado as Dados } from "../../lib/consolidado";
import { CONSOLIDADO } from "./estrutura";
import { n } from "./formato";

export type EtapaOpcao = { numero: number; rotulo: string; estado: "ok" | "sem-dados" | "verificando" };

const LOTE = 100;
const pontos = (cent: number | null) => (cent == null ? "—" : n(cent / 100, 2));

export function Consolidado({
  ate,
  etapas,
  onAte,
  dados,
  carregando,
  erro,
  regra,
  onSair,
}: {
  ate: number;
  etapas: EtapaOpcao[];
  onAte: (numero: number) => void;
  dados: Dados | null;
  carregando: string | null;
  erro: string | null;
  regra: string | null;
  onSair: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [mostrar, setMostrar] = useState(LOTE);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []); // ao abrir, o foco vai para o título da visão

  const termo = chaveNome(busca);
  const todos = dados?.jogadores ?? [];
  const lista = termo ? todos.filter((j) => chaveNome(j.nome).includes(termo)) : todos;
  const totalAguardando = dados?.aguardando.reduce((a, x) => a + x.n, 0) ?? 0;

  return (
    <section className="consolidado" aria-labelledby="t-cons">
      <div className="cons-topo">
        <h2 id="t-cons" ref={titulo} tabIndex={-1}>
          Consolidado
        </h2>
        <button type="button" className="btn sec" onClick={onSair} aria-keyshortcuts="Escape">
          {CONSOLIDADO.sair}
        </button>
      </div>
      <p className="muted">Ranking correto acumulado: a soma dos pontos corretos da Etapa 1 até a etapa escolhida.</p>

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
          <p className="contagem-lista" role="status">
            {termo ? `${n(lista.length)} de ${n(todos.length)} jogadores` : `${n(todos.length)} jogadores`}
          </p>
          <div className="quadro-rolagem" tabIndex={0} role="region" aria-label={`Ranking correto acumulado até a Etapa ${ate}`}>
            <table className="tabela-cons">
              <thead>
                <tr>
                  <th scope="col" className="num">
                    {CONSOLIDADO.colunas[0]}
                  </th>
                  <th scope="col">{CONSOLIDADO.colunas[1]}</th>
                  <th scope="col" className="num">
                    {CONSOLIDADO.colunas[2]}
                  </th>
                  {dados.etapas.map((e) => (
                    <th scope="col" className="num" key={e}>
                      Etapa {e}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.slice(0, mostrar).map((j) => (
                  <tr key={`${j.id ?? j.nome}`}>
                    <td className="num" title={j.empate ? "Empate em pontos e em primeiros lugares" : undefined}>
                      {j.posicao}
                      {j.empate && <span aria-label=" (empate)">=</span>}
                    </td>
                    <th scope="row">{j.nome}</th>
                    <td className="num forte">{pontos(j.totalCent)}</td>
                    {j.porEtapa.map((p, i) => (
                      <td className="num" key={i}>
                        {pontos(p)}
                      </td>
                    ))}
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={3 + dados.etapas.length} className="vazio">
                      Nenhum jogador encontrado para “{busca}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {lista.length > mostrar && (
            <button type="button" className="btn sec mais" onClick={() => setMostrar((m) => m + LOTE)}>
              Mostrar mais {n(Math.min(LOTE, lista.length - mostrar))}
            </button>
          )}
          <p className="muted small">
            {regra ? `Pontos corretos calculados com esta regra para quem fica fora da premiação: ${regra}. ` : ""}Resultados aguardando regra ficam fora da soma, sem pontos inventados. Em caso de empate em pontos, vale quem tem mais
            primeiros lugares (regulamento); como o site não informa mesas finais nem buy-ins investidos, quem continua empatado divide a posição (=).
          </p>
        </>
      )}
    </section>
  );
}
