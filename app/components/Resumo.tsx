"use client";

import { ENDERECO, ENDERECO_EXTRA, SECOES_RESUMO } from "./estrutura";
import { n } from "./formato";
import type { Navegar, Resposta } from "./tipos";

export function Resumo({ d, navegar }: { d: Resposta; navegar: Navegar }) {
  const { indicadores: ind, grupos, torneios, veredito } = d.painel;
  const c = ind.composicao;
  const total = ind.auditados;
  const partes = [
    { id: "corretos", rotulo: "Corretos", qtd: c.corretos },
    { id: "site", rotulo: "Corretos com inscritos do site", qtd: c.corretosSite },
    { id: "erros", rotulo: "Erros", qtd: c.erros },
    { id: "revisar", rotulo: "Revisar", qtd: c.revisar },
    { id: "aguardando", rotulo: "Aguardando regra", qtd: c.aguardando },
  ];
  const comProblema = torneios.filter((t) => t.erros > 0 || t.achado);

  const cartoes = [
    { rotulo: "Erros", valor: n(ind.erros), aba: "erros", destaque: ind.erros > 0 },
    { rotulo: "Pontos em discordância", valor: n(ind.pontosEmDiscordancia), aba: "erros" },
    { rotulo: "Jogadores afetados", valor: n(ind.jogadoresAfetados), aba: "jogadores", extra: { [ENDERECO_EXTRA.soErro]: "1" } },
    { rotulo: "Divergências de inscritos", valor: n(ind.divergenciasInscritos.torneios), aba: "divergencias" },
    { rotulo: "Aguardando regra", valor: n(ind.aguardando), aba: "aguardando" },
    { rotulo: "Resultados corretos (entre os conferidos)", valor: ind.percentualCorretos == null ? "—" : `${n(ind.percentualCorretos, 1)}%`, aba: "erros" },
  ];

  return (
    <div className="resumo">
      <p data-secao={SECOES_RESUMO[0].id} className={`veredito ${ind.erros > 0 ? "com-erro" : "sem-erro"}`}>{veredito}</p>

      <div data-secao={SECOES_RESUMO[1].id} className="cartoes">
        {cartoes.map((k) => (
          <button
            key={k.rotulo}
            type="button"
            className={`cartao ${k.destaque ? "destaque" : ""}`}
            onClick={() => navegar({ [ENDERECO.aba]: k.aba, [ENDERECO.causa]: null, [ENDERECO.torneio]: null, ...(k.extra ?? {}) })}
          >
            <b>{k.valor}</b>
            <span>{k.rotulo}</span>
          </button>
        ))}
      </div>

      <section data-secao={SECOES_RESUMO[2].id} aria-labelledby="t-comp">
        <h2 id="t-comp">Como ficaram os {n(total)} resultados</h2>
        <div className="composicao" role="img" aria-label={partes.map((p) => `${p.rotulo}: ${n(p.qtd)}`).join("; ")}>
          {partes.filter((p) => p.qtd > 0).map((p) => (
            <div key={p.id} className={`seg ${p.id}`} style={{ flexGrow: p.qtd }} title={`${p.rotulo}: ${n(p.qtd)}`} />
          ))}
        </div>
        <ul className="legenda">
          {partes.map((p) => (
            <li key={p.id}>
              <span className={`amostra ${p.id}`} aria-hidden="true" />
              {p.rotulo}: <b>{n(p.qtd)}</b>
            </li>
          ))}
        </ul>
      </section>

      {grupos.length > 0 && (
        <section data-secao={SECOES_RESUMO[3].id} aria-labelledby="t-causas">
          <h2 id="t-causas">{SECOES_RESUMO[3].nome} (hipóteses)</h2>
          <ul className="lista-cartoes">
            {grupos.map((g) => (
              <li key={g.codigo}>
                <button type="button" className="item-clicavel" onClick={() => navegar({ [ENDERECO.aba]: "erros", [ENDERECO.causa]: g.codigo, [ENDERECO.torneio]: null })}>
                  <span className="titulo">{g.titulo}</span>
                  <span className="meta">
                    {n(g.indices.length)} {g.indices.length === 1 ? "caso" : "casos"} · {n(g.pontos)} pontos em discordância
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {comProblema.length > 0 && (
        <section data-secao={SECOES_RESUMO[4].id} aria-labelledby="t-prob">
          <h2 id="t-prob">{SECOES_RESUMO[4].nome}</h2>
          <ul className="lista-cartoes">
            {comProblema.map((t) => (
              <li key={t.id}>
                <button type="button" className="item-clicavel" onClick={() => navegar({ [ENDERECO.item]: `t:${t.id}` })}>
                  <span className="titulo">{t.nome}</span>
                  <span className="meta">
                    {t.erros > 0 && `${n(t.erros)} ${t.erros === 1 ? "erro" : "erros"}`}
                    {t.erros > 0 && t.achado && " · "}
                    {t.achado && `inscritos: API ${n(t.achado.fieldApi)}, site ${n(t.achado.fieldSite)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
