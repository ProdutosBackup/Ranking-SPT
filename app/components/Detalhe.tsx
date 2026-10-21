"use client";

import { CONTA_BLOCOS, PAINEL_BLOCOS } from "./estrutura";
import { classeDif, n, nSinal, nomePosicao, reais } from "./formato";
import type { Linha } from "./tipos";

/** Comparativo "Site 2.286 → Correto 3.810" com a diferença em destaque. */
export function Comparativo({ l }: { l: Linha }) {
  if (l.classe === "aguarda") {
    return (
      <span className="comparativo">
        Site <b>{n(l.registrado)}</b>
      </span>
    );
  }
  return (
    <span className="comparativo">
      Site <b>{n(l.registrado)}</b> → Correto <b>{n(l.esperado)}</b>
      {l.diferenca !== 0 && <span className={`dif ${classeDif(l.diferenca)}`}>{nSinal(l.diferenca)}</span>}
    </span>
  );
}

/** Os blocos da conta de uma linha: resultado, conta correta, registrado no site e hipótese da causa. */
export function Detalhe({ l }: { l: Linha }) {
  const fixos = !l.conta.includes("×");
  const aguarda = l.classe === "aguarda";
  return (
    <div className="detalhe">
      <section className="bloco">
        <h4>{PAINEL_BLOCOS.resultado}</h4>
        <dl className="dados">
          <dt>Jogador</dt>
          <dd>{l.jogador}</dd>
          <dt>Torneio</dt>
          <dd>{l.torneio}</dd>
          <dt>Posição</dt>
          <dd>{l.posicao == null ? "sem posição" : `${n(l.posicao)}º`}</dd>
          <dt>Prêmio</dt>
          <dd>{l.premioInferido ? "—" : l.prize ? reais(l.prize) : "sem prêmio"}</dd>
          <dt>Inscritos</dt>
          <dd>
            {n(l.field)}
            {l.fieldApi !== l.field && <span className="muted"> (a API informa {n(l.fieldApi)})</span>}
          </dd>
          <dt>Buy-in</dt>
          <dd>{reais(l.buyIn)}</dd>
        </dl>
      </section>

      {aguarda ? (
        <section className="bloco">
          <h4>{PAINEL_BLOCOS.conta}</h4>
          <p className="muted">{l.rotulo}: ainda não há regra definida para calcular este resultado.</p>
        </section>
      ) : (
        <section className="bloco">
          <h4>{PAINEL_BLOCOS.conta}</h4>
          {fixos ? (
            <p className="resultado-conta">10 pontos fixos = {n(l.esperado)}</p>
          ) : (
            <div className="conta-blocos">
              <div className="fator">
                <span className="rot">{CONTA_BLOCOS.base}</span>
                <b>{n(l.base)}</b>
                <span className="muted">{l.itm ? nomePosicao(l.posicao) : "fora da premiação"}</span>
              </div>
              <span className="op" aria-hidden="true">×</span>
              <div className="fator">
                <span className="rot">{CONTA_BLOCOS.participantes}</span>
                <b>{n(l.fatorParticipantes, 4)}</b>
                <span className="muted">{n(l.field)} ÷ 100 + 0,5</span>
              </div>
              <span className="op" aria-hidden="true">×</span>
              <div className="fator">
                <span className="rot">{CONTA_BLOCOS.buyIn}</span>
                <b>{n(l.fatorBuyIn, 4)}</b>
                <span className="muted">buy-in {l.faixaBuyIn}</span>
              </div>
              <span className="op" aria-hidden="true">=</span>
              <div className="fator total">
                <span className="rot">{CONTA_BLOCOS.resultado}</span>
                <b>{n(l.esperado)}</b>
              </div>
            </div>
          )}
          <p className="formula-texto">
            {fixos ? "" : `${n(l.base)} × ${n(l.fatorParticipantes, 4)} × ${n(l.fatorBuyIn, 4)} = ${n(l.esperado)}`}
          </p>
        </section>
      )}

      <section className="bloco">
        <h4>{PAINEL_BLOCOS.registrado}</h4>
        <p className="valor-site">
          <b>{n(l.registrado)}</b> pontos
        </p>
        {!aguarda && (
          <p>
            Diferença em relação ao correto: <span className={`dif ${classeDif(l.diferenca)}`}>{l.diferenca === 0 ? "nenhuma" : nSinal(l.diferenca)}</span>
          </p>
        )}
      </section>

      {l.hipotese && (
        <section className="bloco hipotese">
          <h4>{PAINEL_BLOCOS.hipotese}</h4>
          <p>{l.hipotese.texto}.</p>
          {l.hipotese.conta && (
            <p>
              Conta que reproduz o valor do site: <code>{l.hipotese.conta}</code>
            </p>
          )}
          <p className="muted small">É uma hipótese, não uma conclusão: a causa real só o site pode confirmar.</p>
          {l.inverso && (
            <details>
              <summary>Cálculo inverso</summary>
              <ul>
                <li>
                  Pontos registrados ÷ base ({n(l.base)}) = fator total de <b>{n(l.inverso.fatorTotal, 4)}</b>.
                </li>
                <li>
                  {l.inverso.fieldImplicito != null
                    ? `Com esse fator e o fator de buy-in, o valor corresponde a ${n(l.inverso.fieldImplicito)} inscritos.`
                    : "Nenhum número inteiro de inscritos reproduz o valor com essa base."}
                </li>
                {l.inverso.candidatos.length > 0 && (
                  <li>Outras bases que reproduzem o valor com os mesmos inscritos: {l.inverso.candidatos.map((c) => n(c.base)).join(", ")}.</li>
                )}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
