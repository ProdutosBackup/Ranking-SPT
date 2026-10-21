"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Acordo } from "./Acordo";
import { Detalhe } from "./Detalhe";
import { ACORDO, ATALHOS, ENDERECO, PARTICIPACAO } from "./estrutura";
import { chaveLinha, classeDif, n, nSinal } from "./formato";
import { LinhaExpandivel } from "./Outras";
import { Paginada } from "./Paginada";
import type { Navegar, Resposta } from "./tipos";

type Props = {
  d: Resposta;
  ver: string;
  navegar: Navegar;
  /** Índices dos erros na ordem da lista aberta; permite Anterior/Próximo. */
  lista: number[] | null;
  revisados: Set<string>;
  alternarRevisado: (chave: string) => void;
  /** Último elemento com foco antes de abrir (o fundo fica inerte e perde o foco). */
  retorno: RefObject<HTMLElement | null>;
  /** Salva (n) ou desfaz (null) o acordo de um torneio, para todos. Devolve a mensagem de erro, ou null se deu certo. */
  onAcordo: (torneioId: string, n: number | null) => Promise<string | null>;
};

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Painel lateral (tela cheia no celular). Prende o foco, fecha com Esc e devolve o foco ao fechar. */
export function Painel({ d, ver, navegar, lista, revisados, alternarRevisado, retorno, onAcordo }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const [tipo, ...resto] = ver.split(":");
  const id = resto.join(":");
  const fechar = () => navegar({ [ENDERECO.item]: null }, "replace");

  const indice = tipo === "l" ? d.linhas.findIndex((l) => chaveLinha(l) === id) : -1;
  const linha = indice >= 0 ? d.linhas[indice] : null;
  const pos = lista && indice >= 0 ? lista.indexOf(indice) : -1;
  const ir = (passo: number) => {
    if (!lista || pos < 0) return;
    const alvo = lista[pos + passo];
    if (alvo != null) navegar({ [ENDERECO.item]: `l:${chaveLinha(d.linhas[alvo])}` }, "replace");
  };

  useEffect(() => {
    raiz.current?.focus();
    return () => {
      const anterior = retorno.current;
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, [retorno]);

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === ATALHOS.fechar.tecla) {
      e.preventDefault();
      fechar();
    } else if (e.key === "Tab" && raiz.current) {
      const itens = [...raiz.current.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.offsetParent !== null);
      if (!itens.length) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || ativo === raiz.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    } else if ((e.key === ATALHOS.anterior.tecla || e.key === ATALHOS.proximo.tecla) && tipo === "l") {
      const alvo = e.target as HTMLElement;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(alvo.tagName)) return;
      e.preventDefault();
      ir(e.key === ATALHOS.anterior.tecla ? -1 : 1);
    }
  };

  const conteudo = useMemo(() => {
    if (tipo === "j") {
      const j = d.painel.jogadores.find((x) => x.nome === id);
      const ls = d.linhas.filter((l) => l.jogador === id);
      return {
        titulo: id,
        sub: j && (
          <p className="comparativo grande">
            Site <b>{n(j.pontosSite)}</b> → Correto <b>{n(j.pontosCorretos)}</b>
            {j.diferenca !== 0 && <span className={`dif ${classeDif(j.diferenca)}`}>{nSinal(j.diferenca)}</span>}
          </p>
        ),
        corpo: ls.length ? (
          <div className="expandiveis">
            <Paginada itens={ls} render={(l) => <LinhaExpandivel key={chaveLinha(l)} l={l} />} />
          </div>
        ) : (
          <p className="muted">Nenhum resultado encontrado para este jogador.</p>
        ),
      };
    }
    if (tipo === "t") {
      const t = d.painel.torneios.find((x) => x.id === id);
      const ls = d.linhas.filter((l) => l.torneioId === id);
      return {
        titulo: t?.nome ?? "Torneio",
        sub: t && (
          <div>
            <p className="muted">
              {n(t.inscritos)} inscritos na API · {n(t.premiados)} premiados · {n(t.resultados)} resultados · {n(t.corretos)} corretos · {n(t.erros)} {t.erros === 1 ? "erro" : "erros"}
            </p>
            {t.achado && (
              <p className="aviso atencao">
                Os pontos registrados de todos os {n(t.achado.linhasExplicadas)} resultados só batem com {n(t.achado.fieldSite)} inscritos, e a API informa {n(t.achado.fieldApi)}. É uma inconsistência entre a API e o site; não prova que o site esteja certo.
              </p>
            )}
          </div>
        ),
        corpo: ls.length ? (
          <div className="expandiveis">
            <Paginada itens={ls} render={(l) => <LinhaExpandivel key={chaveLinha(l)} l={l} />} />
          </div>
        ) : (
          <p className="muted">Este torneio não tem resultados no site.</p>
        ),
      };
    }
    return null;
  }, [tipo, id, d]);

  const torneioDaLinha = linha ? d.painel.torneios.find((t) => t.id === linha.torneioId) : undefined;
  const k = linha ? chaveLinha(linha) : "";
  const revisado = revisados.has(k);

  return (
    <div className="painel-fundo" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div ref={raiz} className="painel" role="dialog" aria-modal="true" aria-labelledby="painel-titulo" tabIndex={-1} onKeyDown={aoTeclar}>
        <header className="painel-topo">
          <div className="painel-titulo">
            <h2 id="painel-titulo">{linha ? linha.jogador : (conteudo?.titulo ?? "Detalhe")}</h2>
            {linha && (
              <p className="muted">
                {linha.torneio} · {linha.posicao == null ? "sem posição" : `${n(linha.posicao)}º`} · {linha.participacao && <><span className="etiqueta categoria">{PARTICIPACAO.rotulo}</span>{" "}</>}{linha.acordo && <><span className="etiqueta categoria">{ACORDO.rotulo}</span>{" "}</>}<span className={`etiqueta ${linha.classe}`}>{linha.rotulo}</span>
              </p>
            )}
          </div>
          <button type="button" className="btn sec fechar" onClick={fechar} aria-label="Fechar (Esc)">
            Fechar ✕
          </button>
        </header>

        <div className="painel-corpo">
          {linha ? (
            <Detalhe l={linha} />
          ) : conteudo ? (
            <>
              {conteudo.sub}
              {conteudo.corpo}
            </>
          ) : (
            <p className="muted">Resultado não encontrado nesta auditoria.</p>
          )}
        </div>

        {linha && (
          <footer className="painel-rodape">
            <button type="button" className="btn sec" disabled={pos <= 0} onClick={() => ir(-1)} aria-keyshortcuts={ATALHOS.anterior.tecla}>
              ← Anterior
            </button>
            <button type="button" className="btn sec" disabled={pos < 0 || !lista || pos >= lista.length - 1} onClick={() => ir(1)} aria-keyshortcuts={ATALHOS.proximo.tecla}>
              Próximo →
            </button>
            <button type="button" className={`btn ${revisado ? "sec" : ""}`} aria-pressed={revisado} onClick={() => alternarRevisado(k)}>
              {revisado ? "✓ Revisado (desfazer)" : "Marcar como revisado"}
            </button>
            {torneioDaLinha && torneioDaLinha.premiados >= 2 && (
              <Acordo
                key={linha.torneioId}
                atual={torneioDaLinha.acordo}
                premiados={torneioDaLinha.premiados}
                onAplicar={(n) => onAcordo(linha.torneioId, n)}
                onDesfazer={() => onAcordo(linha.torneioId, null)}
              />
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
