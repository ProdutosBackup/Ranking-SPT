"use client";

// Aba "Auditoria" (v2, no modelo do Resumo): cartões de indicador, lista de distribuição, causas em cartões e casos em linhas alinhadas.
// Clicar num caso abre o painel lateral de sempre (parâmetro `ver`).
// Causa, torneio e ordem ficam em estado local (sem parâmetros novos no endereço). Só usa os dados que a auditoria já entrega.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { filtrarErros } from "./Erros";
import { AUDITORIA, ENDERECO, SECOES_RESUMO } from "./estrutura";
import { chaveLinha, classeDif, n, nSinal, semAcento } from "./formato";
import { CartoesIndicador, ListaDistribuicao, pc, percentuais, type CartaoIndicador } from "./Indicadores";
import { Paginada } from "./Paginada";
import type { Navegar, Resposta } from "./tipos";

type Ordem = "diferenca" | "jogador" | "torneio";
type Opcao = { id: string; rotulo: string };

/** Menu de filtro (Causa, Torneio, Ordenar): botão que abre uma lista de opções, com busca opcional. Esc, clique fora e Tab fecham; ↑ ↓ Home End percorrem. */
function MenuFiltro({ rotulo, valor, opcoes, onEscolher, comBusca, classe }: { rotulo: string; valor: string; opcoes: Opcao[]; onEscolher: (id: string) => void; comBusca?: boolean; classe?: string }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();
  const atual = opcoes.find((o) => o.id === valor);
  const visiveis = comBusca && busca ? opcoes.filter((o) => semAcento(o.rotulo).includes(semAcento(busca))) : opcoes;
  const itens = () => [...(lista.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];

  useEffect(() => {
    if (!aberto) return;
    (campo.current ?? itens().find((i) => i.getAttribute("aria-selected") === "true") ?? itens()[0])?.focus();
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);
  const fechar = (voltar: boolean) => {
    setAberto(false);
    setBusca("");
    if (voltar) botao.current?.focus();
  };
  const tecla = (e: React.KeyboardEvent) => {
    const todos = itens();
    const i = todos.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // fecha só o menu
      fechar(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      todos[Math.min(i + 1, todos.length - 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i <= 0 && campo.current) campo.current.focus();
      else todos[Math.max(i - 1, 0)]?.focus();
    } else if (e.key === "Home" && i >= 0) {
      e.preventDefault();
      todos[0]?.focus();
    } else if (e.key === "End" && i >= 0) {
      e.preventDefault();
      todos[todos.length - 1]?.focus();
    } else if (e.key === "Tab") fechar(false);
  };

  return (
    <div className={`menu-filtro ${classe ?? ""}`} ref={raiz}>
      <button
        ref={botao}
        type="button"
        className="b-btn b-sec filtro-botao"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((x) => !x)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !aberto) {
            e.preventDefault();
            setAberto(true);
          }
        }}
      >
        <span className="filtro-rotulo">{rotulo}:</span> <span className="filtro-valor">{atual?.rotulo ?? ""}</span>
      </button>
      {aberto && (
        <div id={id} className="menu-filtro-lista" onKeyDown={tecla}>
          {comBusca && (
            <input ref={campo} type="search" className="filtro-busca" placeholder={AUDITORIA.buscarTorneio} aria-label={AUDITORIA.buscarTorneio} autoComplete="off" value={busca} onChange={(e) => setBusca(e.target.value)} />
          )}
          <div ref={lista} role="listbox" aria-label={rotulo}>
            {visiveis.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={o.id === valor}
                className="menu-item"
                onClick={() => {
                  onEscolher(o.id);
                  fechar(true);
                }}
              >
                {o.rotulo}
              </button>
            ))}
            {visiveis.length === 0 && <p className="muted small filtro-vazio">{AUDITORIA.nenhumTorneio}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function Auditoria({ d, carregando, navegar, revisados, onLista }: { d: Resposta | undefined; carregando: boolean; navegar: Navegar; revisados: Set<string>; onLista: (indices: number[] | null) => void }) {
  const [causa, setCausa] = useState<string | null>(null);
  const [torneio, setTorneio] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<Ordem>("diferenca");
  const [foco, setFoco] = useState(0);
  const [todasCausas, setTodasCausas] = useState(false); // celular: as 4 maiores ou todas
  const linhasRef = useRef<(HTMLButtonElement | null)[]>([]);
  const tituloCasos = useRef<HTMLHeadingElement>(null);

  // A mesma lista e a mesma ordem das abas antigas; é também a lista que o painel usa em Anterior/Próximo.
  const lista = useMemo(() => {
    if (!d) return [];
    const q = new URLSearchParams();
    if (causa) q.set(ENDERECO.causa, causa);
    if (torneio) q.set(ENDERECO.torneio, torneio);
    q.set(ENDERECO.ordem, ordem);
    return filtrarErros(d, q);
  }, [d, causa, torneio, ordem]);
  useEffect(() => {
    onLista(d ? lista : null);
    return () => onLista(null);
  }, [lista, d, onLista]);
  useEffect(() => setFoco(0), [lista]);
  // Nova auditoria (outros dados): os filtros voltam ao padrão.
  const versao = d?.identificador.sha256;
  useEffect(() => {
    setCausa(null);
    setTorneio(null);
  }, [versao]);

  if (!d) {
    return carregando ? (
      <div className="aud-esqueleto" aria-busy="true" aria-label={AUDITORIA.carregando}>
        <div className="esq-linha larga" />
        <div className="esq-grade">
          <div className="esq-bloco" />
          <div className="esq-bloco" />
          <div className="esq-bloco" />
        </div>
        <div className="esq-bloco alto" />
      </div>
    ) : (
      <p className="aud-vazio">{AUDITORIA.antes}</p>
    );
  }

  const { indicadores: ind, grupos, veredito } = d.painel;
  const totalErros = grupos.reduce((a, g) => a + g.indices.length, 0);
  const causas = [...grupos].sort((a, b) => b.indices.length - a.indices.length); // maior número de casos primeiro
  const pctCausas = percentuais(causas.map((g) => g.indices.length), totalErros);
  const grupoAtual = causa ? grupos.find((g) => g.codigo === causa) : null;
  // Torneios com casos na causa escolhida (com a contagem dela); o torneio já escolhido fica na lista mesmo sem casos.
  const porTorneio = new Map<string, number>();
  for (const i of grupoAtual ? grupoAtual.indices : grupos.flatMap((g) => g.indices)) porTorneio.set(d.linhas[i].torneioId, (porTorneio.get(d.linhas[i].torneioId) ?? 0) + 1);
  const opcoesTorneio: Opcao[] = [
    { id: "", rotulo: AUDITORIA.todosTorneios },
    ...d.painel.torneios.filter((t) => porTorneio.has(t.id) || t.id === torneio).map((t) => ({ id: t.id, rotulo: `${t.nome} (${n(porTorneio.get(t.id) ?? 0)})` })),
  ];
  const opcoesOrdem: Opcao[] = AUDITORIA.ordens.map(([id, rotulo]) => ({ id, rotulo }));
  const filtrando = causa != null || torneio != null;
  const limpar = () => {
    setCausa(null);
    setTorneio(null);
  };
  const ativos = [grupoAtual ? `${AUDITORIA.causa}: ${grupoAtual.titulo}` : null, torneio ? `${AUDITORIA.torneio}: ${d.painel.torneios.find((t) => t.id === torneio)?.nome ?? ""}` : null].filter(Boolean) as string[];

  // Ao escolher uma causa, rola até o título dos casos se ele não estiver visível (sem animação se a pessoa prefere menos movimento).
  const escolher = (codigo: string | null) => {
    setCausa(codigo);
    setTimeout(() => {
      const t = tituloCasos.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) t.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 0);
  };

  const teclaLinhas = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const i = linhasRef.current.indexOf(e.target as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(i + (e.key === "ArrowDown" ? 1 : -1), linhasRef.current.filter(Boolean).length - 1));
    setFoco(j);
    linhasRef.current[j]?.focus();
  };

  const cartoes: CartaoIndicador[] = [
    { rotulo: "Erros", valor: n(ind.erros), destaque: ind.erros > 0, onClick: limpar },
    { rotulo: "Pontos em discordância", valor: n(ind.pontosEmDiscordancia) },
    { rotulo: "Jogadores afetados", valor: n(ind.jogadoresAfetados) },
    { rotulo: "Divergências de inscritos", valor: n(ind.divergenciasInscritos.torneios), onClick: () => navegar({ [ENDERECO.aba]: "divergencias", [ENDERECO.causa]: null, [ENDERECO.torneio]: null }) },
    { rotulo: "Aguardando regra", valor: n(ind.aguardando), onClick: () => navegar({ [ENDERECO.aba]: "aguardando", [ENDERECO.causa]: null, [ENDERECO.torneio]: null }) },
    { rotulo: AUDITORIA.corretos, valor: ind.percentualCorretos == null ? "—" : `${n(ind.percentualCorretos, 1)}%` },
  ];

  return (
    <div className={`aud${todasCausas ? " mostrar-todas-causas" : ""}`}>
      <p className={`veredito ${ind.erros > 0 ? "com-erro" : "sem-erro"}`}>{veredito}</p>
      <CartoesIndicador cartoes={cartoes} />
      <ListaDistribuicao d={d} />

      {totalErros === 0 ? (
        <p className="aud-vazio">{AUDITORIA.semErros}</p>
      ) : (
        <>
          <section aria-labelledby="aud-t-causas" className="aud-secao">
            <h2 id="aud-t-causas">{SECOES_RESUMO[3].nome} (hipóteses)</h2>
            <ul className="causas-grade">
              <li>
                <button type="button" className="causa-cartao" aria-pressed={causa == null} onClick={() => escolher(null)}>
                  <span className="cc-titulo">{AUDITORIA.todasAsCausas}</span>
                  <span className="cc-num">
                    <b>{n(totalErros)}</b> {totalErros === 1 ? "caso" : "casos"}
                  </span>
                  <span className="cc-pontos">
                    {n(ind.pontosEmDiscordancia)} {AUDITORIA.pontosEmDiscordancia}
                  </span>
                  <span className="cc-parcela" aria-hidden="true">
                    <span className="barra">
                      <span style={{ transform: "scaleX(1)" }} />
                    </span>
                    <span className="pct">{pc(100)}%</span>
                  </span>
                </button>
              </li>
              {causas.map((g, i) => (
                <li key={g.codigo} className={i >= 4 ? "extra" : undefined}>
                  <button type="button" className="causa-cartao" aria-pressed={causa === g.codigo} onClick={() => escolher(g.codigo)}>
                    <span className="cc-titulo">{g.titulo}</span>
                    <span className="cc-num">
                      <b>{n(g.indices.length)}</b> {g.indices.length === 1 ? "caso" : "casos"}
                    </span>
                    <span className="cc-pontos">
                      {n(g.pontos)} {AUDITORIA.pontosEmDiscordancia}
                    </span>
                    <span className="cc-parcela" aria-hidden="true">
                      <span className="barra">
                        <span style={{ transform: `scaleX(${g.indices.length / totalErros})` }} />
                      </span>
                      <span className="pct">{pc(pctCausas[i])}%</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {causas.length > 4 && (
              <button type="button" className="b-btn b-sec ver-todas-causas" aria-expanded={todasCausas} onClick={() => setTodasCausas((x) => !x)}>
                {todasCausas ? AUDITORIA.verMenos : AUDITORIA.verTodas(causas.length)}
              </button>
            )}
          </section>

          <section aria-labelledby="aud-t-casos" className="aud-secao">
            <div className="aud-casos-topo">
              <h2 id="aud-t-casos" ref={tituloCasos}>
                {AUDITORIA.casos}
                <span className="muted"> · {grupoAtual ? grupoAtual.titulo : AUDITORIA.todasAsCausas}</span>
              </h2>
              <p className="aud-contagem" role="status" aria-live="polite">
                {n(lista.length)} {lista.length === 1 ? "resultado" : "resultados"}
              </p>
            </div>
            <p className="muted small">{AUDITORIA.clique}</p>
            <div className="aud-filtros" role="group" aria-label={AUDITORIA.filtros}>
              <MenuFiltro rotulo={AUDITORIA.torneio} valor={torneio ?? ""} opcoes={opcoesTorneio} comBusca onEscolher={(id) => setTorneio(id || null)} />
              <MenuFiltro rotulo={AUDITORIA.ordenar} valor={ordem} opcoes={opcoesOrdem} onEscolher={(id) => setOrdem(id as Ordem)} />
              {filtrando && (
                <button type="button" className="texto-btn" onClick={limpar}>
                  {AUDITORIA.limpar}
                </button>
              )}
            </div>

            {lista.length === 0 ? (
              <div className="aud-vazio" role="status">
                <p>
                  {AUDITORIA.semResultado}
                  {ativos.length > 0 && <> {AUDITORIA.filtrosAtivos}: {ativos.join("; ")}.</>}
                </p>
                <button type="button" className="b-btn b-sec" onClick={limpar}>
                  {AUDITORIA.limpar}
                </button>
              </div>
            ) : (
              <div className="casos-bloco">
                <div className="casos-cab" aria-hidden="true">
                  <span>{AUDITORIA.colunas[0]}</span>
                  <span>{AUDITORIA.colunas[1]}</span>
                  <span className="num">{AUDITORIA.colunas[2]}</span>
                  <span className="num">{AUDITORIA.colunas[3]}</span>
                  <span>{AUDITORIA.colunas[4]}</span>
                </div>
                <ul className="casos-lista" key={`${causa}|${torneio}|${ordem}`} onKeyDown={teclaLinhas}>
                  <Paginada
                    itens={lista}
                    render={(i, pos) => {
                      const l = d.linhas[i];
                      const k = chaveLinha(l);
                      return (
                        <li key={k}>
                          <button
                            type="button"
                            ref={(el) => {
                              linhasRef.current[pos] = el;
                            }}
                            tabIndex={pos === foco ? 0 : -1}
                            className="caso"
                            onFocus={() => setFoco(pos)}
                            onClick={() => navegar({ [ENDERECO.item]: `l:${k}` })}
                          >
                            <span className="c-jogador">
                              <b>{l.jogador}</b>
                              {revisados.has(k) && <span className="revisado">✓ revisado</span>}
                            </span>
                            <span className="c-onde">
                              {l.torneio} · {l.posicao == null ? "sem posição" : `${n(l.posicao)}º`}
                            </span>
                            <span className="c-site num">
                              <span className="rot-celular">Site </span>
                              {n(l.registrado)}
                            </span>
                            <span className="c-correto num">
                              <span className="seta-celular" aria-hidden="true">→ </span>
                              <span className="rot-celular">Correto </span>
                              {n(l.esperado)}
                            </span>
                            <span className="c-dif">{l.diferenca !== 0 && <span className={`dif ${classeDif(l.diferenca)}`}>{nSinal(l.diferenca)}</span>}</span>
                          </button>
                        </li>
                      );
                    }}
                  />
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
