"use client";

import { Detalhe, Comparativo } from "./Detalhe";
import { ENDERECO, ENDERECO_EXTRA } from "./estrutura";
import { chaveLinha, classeDif, n, nSinal, semAcento } from "./formato";
import { Paginada } from "./Paginada";
import type { Navegar, Opcoes, Resposta } from "./tipos";

/* ---------- Divergências de inscritos ---------- */
export function Divergencias({ d, navegar }: { d: Resposta; navegar: Navegar }) {
  const lista = d.painel.divergencias;
  if (!lista.length) return <div className="aviso">Nenhuma divergência de inscritos nesta etapa.</div>;
  return (
    <div>
      <p className="muted small">
        Nestes torneios um único número de inscritos reproduz todos os resultados, mas é diferente do informado pela API. É uma inconsistência entre a API e o site; não prova que o site esteja certo. Esses resultados não contam como erro.
      </p>
      <ul className="cartoes-grade">
        {lista.map((x) => (
          <li key={x.torneioId}>
            <button type="button" className="cartao-torneio" onClick={() => navegar({ [ENDERECO.item]: `t:${x.torneioId}` })}>
              <span className="titulo">{x.torneio}</span>
              <span className="duplo">
                <span>
                  <span className="rot">Inscritos na API</span>
                  <b>{n(x.inscritosApi)}</b>
                </span>
                <span>
                  <span className="rot">Usados pelo site</span>
                  <b>{n(x.inscritosSite)}</b>
                </span>
                <span>
                  <span className="rot">Diferença</span>
                  <b className="pos">{nSinal(x.diferenca)}</b>
                </span>
              </span>
              <span className="meta">{n(x.resultadosExplicados)} resultados explicados</span>
              <span className="muted small">Isso não prova que o site esteja certo.</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Jogadores ---------- */
export function Jogadores({ d, q, navegar }: { d: Resposta; q: URLSearchParams; navegar: Navegar }) {
  const busca = q.get(ENDERECO.busca) ?? "";
  const soErro = q.get(ENDERECO_EXTRA.soErro) === "1";
  const t = semAcento(busca.trim());
  const lista = d.painel.jogadores.filter((j) => (!soErro || j.erros > 0) && (!t || semAcento(j.nome).includes(t)));
  return (
    <div>
      <div className="busca">
        <label htmlFor="busca">Buscar jogador</label>
        <input id="busca" type="search" value={busca} autoComplete="off" onChange={(e) => navegar({ [ENDERECO.busca]: e.target.value || null }, "replace")} />
        <button type="button" className={`chip ${soErro ? "ativo" : ""}`} aria-pressed={soErro} onClick={() => navegar({ [ENDERECO_EXTRA.soErro]: soErro ? null : "1" }, "replace")}>
          Só com erro
        </button>
      </div>
      <p className="contagem-lista" aria-live="polite">
        {n(lista.length)} {lista.length === 1 ? "jogador" : "jogadores"}
      </p>
      {lista.length === 0 && <p className="muted">Nenhum jogador encontrado.</p>}
      <ul className="linhas" key={`${busca}|${soErro}`}>
        <Paginada
          itens={lista}
          render={(j) => (
            <li key={j.nome}>
              <button type="button" className="linha-erro" onClick={() => navegar({ [ENDERECO.item]: `j:${j.nome}` })}>
                <span className="quem">
                  <b>{j.nome}</b>
                </span>
                <span className="onde">
                  {n(j.resultados)} {j.resultados === 1 ? "resultado" : "resultados"}
                  {j.erros > 0 && ` · ${n(j.erros)} ${j.erros === 1 ? "erro" : "erros"}`}
                </span>
                <span className="comparativo">
                  Site <b>{n(j.pontosSite)}</b> → Correto <b>{n(j.pontosCorretos)}</b>
                  {j.diferenca !== 0 && <span className={`dif ${classeDif(j.diferenca)}`}>{nSinal(j.diferenca)}</span>}
                </span>
              </button>
            </li>
          )}
        />
      </ul>
    </div>
  );
}

/* ---------- Torneios ---------- */
const ESTADO: Record<string, { icone: string; texto: string }> = {
  ok: { icone: "✓", texto: "Sem problema" },
  erro: { icone: "✕", texto: "Com erro" },
  divergencia: { icone: "≠", texto: "Inscritos diferentes da API" },
  vazio: { icone: "–", texto: "Sem resultados" },
  aguardando: { icone: "…", texto: "Aguardando regra" },
};

export function Torneios({ d, navegar }: { d: Resposta; navegar: Navegar }) {
  const lista = [...d.painel.torneios].sort((a, b) => Number(a.estado === "vazio") - Number(b.estado === "vazio"));
  return (
    <ul className="linhas">
      {lista.map((t) => {
        const e = ESTADO[t.estado];
        return (
          <li key={t.id}>
            <button type="button" className="linha-erro torneio" onClick={() => navegar({ [ENDERECO.item]: `t:${t.id}` })}>
              <span className={`icone ${t.estado}`} aria-hidden="true">
                {e.icone}
              </span>
              <span className="quem">
                <b>{t.nome}</b>
                <span className="muted small"> {e.texto}</span>
              </span>
              <span className="onde">
                {t.resultados === 0
                  ? "nenhum resultado no site"
                  : `${n(t.inscritos)} inscritos · ${n(t.premiados)} premiados · ${n(t.resultados)} resultados · ${n(t.corretos)} corretos${t.erros ? ` · ${n(t.erros)} ${t.erros === 1 ? "erro" : "erros"}` : ""}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Aguardando regra ---------- */
export function Aguardando({ d }: { d: Resposta }) {
  const grupos = d.painel.aguardandoGrupos;
  if (!grupos.length) return <div className="aviso">Nenhum resultado aguardando definição de regra.</div>;
  return (
    <div>
      {grupos.map((g) => (
        <section className="grupo" key={g.codigo}>
          <header>
            <h3>{g.titulo}</h3>
            <span className="contagem neutro">{n(g.total)} resultados</span>
          </header>
          <p>{g.pendente}</p>
          <p>
            <b>Decisão que resolve:</b> {g.decisao}
          </p>
          <details>
            <summary>Ver os resultados</summary>
            {g.itens.map((it) => (
              <details key={it.texto} className="interno">
                <summary>{it.texto}</summary>
                <ul className="linhas simples">
                  <Paginada
                    itens={it.indices}
                    render={(i) => {
                      const l = d.linhas[i];
                      return (
                        <li key={i} className="linha-simples">
                          <b>{l.jogador}</b>
                          <span className="muted">
                            {l.posicao == null ? "sem posição" : `${n(l.posicao)}º`} · {n(l.registrado)} pontos no site
                          </span>
                        </li>
                      );
                    }}
                  />
                </ul>
              </details>
            ))}
          </details>
        </section>
      ))}
    </div>
  );
}

/* ---------- Regras ---------- */
export function Regras({ d, opcoes }: { d: Resposta; opcoes: Opcoes }) {
  const t = d.painel.tabelas;
  return (
    <div className="regras-aba">
      <section>
        <h2>A fórmula</h2>
        <p className="formula-grande">
          Pontos = <b>base da posição</b> × <b>fator de participantes</b> × <b>fator de buy-in</b>
        </p>
        <p className="muted">
          O fator de participantes é inscritos ÷ 100 + 0,5. Quem fica fora da premiação recebe a base de 10 pontos: {t.foraDaPremiacao}.
        </p>
      </section>
      <div className="duas-colunas">
        <section>
          <h3>Base da posição</h3>
          <table className="tab-simples">
            <thead>
              <tr>
                <th>Posição</th>
                <th className="num">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {t.bases.map((b) => (
                <tr key={b.posicao}>
                  <td>{b.posicao}</td>
                  <td className="num">{n(b.pontos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3>Fator de buy-in</h3>
          <table className="tab-simples">
            <thead>
              <tr>
                <th>Buy-in</th>
                <th className="num">Fator</th>
              </tr>
            </thead>
            <tbody>
              {t.buyIn.map((b) => (
                <tr key={b.faixa}>
                  <td>{b.faixa}</td>
                  <td className="num">{n(b.fator)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <section>
        <h2>Regras usadas nesta auditoria</h2>
        <dl className="regras">
          {d.painel.regrasTexto.map((r) => (
            <div key={r.titulo}>
              <dt>{r.titulo}</dt>
              <dd>{r.valor}</dd>
            </div>
          ))}
        </dl>
      </section>
      <details>
        <summary>Opções avançadas</summary>
        <p className="muted small">Mudam a forma de conferir. Clique em “Auditar etapa” de novo para aplicar.</p>
        <div className="adv">
          <div className="campo">
            <label htmlFor="fora">Quem fica fora da premiação</label>
            <select id="fora" value={opcoes.foraPremiacao} onChange={(e) => opcoes.setForaPremiacao(e.target.value)}>
              <option value="base10xFatores">10 pontos × os fatores (regulamento)</option>
              <option value="10fixos">10 pontos fixos (calculadora do site)</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="apos18">Premiados depois do 18º lugar</label>
            <select id="apos18" value={opcoes.apos18} onChange={(e) => opcoes.setApos18(e.target.value)}>
              <option value="base100TodosItm">100 pontos de base para todos</option>
              <option value="base10">10 pontos de base</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="tol">Diferença aceita como arredondamento (pontos)</label>
            <input id="tol" type="text" inputMode="decimal" size={6} value={opcoes.tolerancia} onChange={(e) => opcoes.setTolerancia(e.target.value)} />
          </div>
        </div>
      </details>
    </div>
  );
}

/* usados pelo painel lateral */
export function LinhaExpandivel({ l }: { l: Resposta["linhas"][number] }) {
  return (
    <details className="expandivel" key={chaveLinha(l)}>
      <summary className={`sum-linha ${l.classe}`}>
        <span className="quem">
          <b>{l.torneio}</b> · {l.posicao == null ? "sem posição" : `${n(l.posicao)}º`}
        </span>
        <Comparativo l={l} />
        <span className={`etiqueta ${l.classe}`}>{l.rotulo}</span>
      </summary>
      <Detalhe l={l} />
    </details>
  );
}
