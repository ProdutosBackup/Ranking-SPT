"use client";

import { Comparativo } from "./Detalhe";
import { ENDERECO } from "./estrutura";
import { chaveLinha, n } from "./formato";
import { Paginada } from "./Paginada";
import type { Navegar, Resposta } from "./tipos";

type Ordem = "diferenca" | "jogador" | "torneio";

/** Índices (em `d.linhas`) dos erros, já filtrados e ordenados conforme o endereço. */
export function filtrarErros(d: Resposta, q: URLSearchParams): number[] {
  const causa = q.get(ENDERECO.causa);
  const torneio = q.get(ENDERECO.torneio);
  const ordem = (q.get(ENDERECO.ordem) as Ordem) || "diferenca";
  const base = d.painel.grupos.filter((g) => !causa || g.codigo === causa).flatMap((g) => g.indices);
  const idx = base.filter((i) => !torneio || d.linhas[i].torneioId === torneio);
  const L = d.linhas;
  return idx.sort((a, b) =>
    ordem === "jogador"
      ? L[a].jogador.localeCompare(L[b].jogador, "pt-BR")
      : ordem === "torneio"
        ? L[a].torneio.localeCompare(L[b].torneio, "pt-BR") || Math.abs(L[b].diferenca) - Math.abs(L[a].diferenca)
        : Math.abs(L[b].diferenca) - Math.abs(L[a].diferenca),
  );
}

export function Erros({ d, q, navegar, revisados }: { d: Resposta; q: URLSearchParams; navegar: Navegar; revisados: Set<string> }) {
  const causa = q.get(ENDERECO.causa);
  const torneio = q.get(ENDERECO.torneio);
  const ordem = (q.get(ENDERECO.ordem) as Ordem) || "diferenca";
  const lista = filtrarErros(d, q);
  const torneiosComErro = d.painel.torneios.filter((t) => t.erros > 0);
  const total = d.painel.grupos.reduce((a, g) => a + g.indices.length, 0);
  const f = (alt: Record<string, string | null>) => navegar(alt, "replace");

  if (total === 0) return <div className="aviso">Nenhum erro encontrado nesta etapa.</div>;

  return (
    <div>
      <p className="muted small">Clique em um resultado para ver a conta passo a passo. As causas são hipóteses.</p>

      <div className="filtros" role="group" aria-label="Filtrar por causa">
        <span className="rotulo-filtro">Causa</span>
        <button type="button" className={`chip ${!causa ? "ativo" : ""}`} aria-pressed={!causa} onClick={() => f({ [ENDERECO.causa]: null })}>
          Todas ({n(total)})
        </button>
        {d.painel.grupos.map((g) => (
          <button key={g.codigo} type="button" className={`chip ${causa === g.codigo ? "ativo" : ""}`} aria-pressed={causa === g.codigo} onClick={() => f({ [ENDERECO.causa]: g.codigo })}>
            {g.titulo} ({n(g.indices.length)})
          </button>
        ))}
      </div>
      <div className="filtros" role="group" aria-label="Filtrar por torneio">
        <span className="rotulo-filtro">Torneio</span>
        <button type="button" className={`chip ${!torneio ? "ativo" : ""}`} aria-pressed={!torneio} onClick={() => f({ [ENDERECO.torneio]: null })}>
          Todos
        </button>
        {torneiosComErro.map((t) => (
          <button key={t.id} type="button" className={`chip ${torneio === t.id ? "ativo" : ""}`} aria-pressed={torneio === t.id} onClick={() => f({ [ENDERECO.torneio]: t.id })}>
            {t.nome} ({n(t.erros)})
          </button>
        ))}
      </div>
      <div className="filtros" role="group" aria-label="Ordenar">
        <span className="rotulo-filtro">Ordenar por</span>
        {(
          [
            ["diferenca", "Maior diferença"],
            ["jogador", "Jogador"],
            ["torneio", "Torneio"],
          ] as [Ordem, string][]
        ).map(([o, r]) => (
          <button key={o} type="button" className={`chip ${ordem === o ? "ativo" : ""}`} aria-pressed={ordem === o} onClick={() => f({ [ENDERECO.ordem]: o === "diferenca" ? null : o })}>
            {r}
          </button>
        ))}
      </div>

      <p className="contagem-lista" aria-live="polite">
        {n(lista.length)} {lista.length === 1 ? "resultado" : "resultados"}
      </p>
      <ul className="linhas" key={`${causa}|${torneio}|${ordem}`}>
        <Paginada
          itens={lista}
          render={(i) => {
            const l = d.linhas[i];
            const k = chaveLinha(l);
            return (
              <li key={k}>
                <button type="button" className="linha-erro" onClick={() => navegar({ [ENDERECO.item]: `l:${k}` })}>
                  <span className="quem">
                    <b>{l.jogador}</b>
                    {revisados.has(k) && <span className="revisado">✓ revisado</span>}
                  </span>
                  <span className="onde">
                    {l.torneio} · {l.posicao == null ? "sem posição" : `${n(l.posicao)}º`}
                  </span>
                  <Comparativo l={l} />
                </button>
              </li>
            );
          }}
        />
      </ul>
    </div>
  );
}
