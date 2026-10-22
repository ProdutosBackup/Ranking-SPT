"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Abas, type Aba } from "./components/Abas";
import { ABAS, CONSOLIDADO, ENDERECO, ENDERECO_EXTRA, TEXTOS_PLANILHA } from "./components/estrutura";
import { consolidar, type EtapaConsolidado } from "../lib/consolidado";
import { Barra, ETAPAS } from "./components/Barra";
import { Consolidado, type EtapaOpcao } from "./components/Consolidado";
import { lerAuditoria } from "./components/lerAuditoria";
import { Erros, filtrarErros } from "./components/Erros";
import { Aguardando, Divergencias, Jogadores, Regras, Torneios } from "./components/Outras";
import { Painel } from "./components/Painel";
import { BlocoLido } from "./components/Planilha";
import { Resumo } from "./components/Resumo";
import type { Bloqueio, Guardada, PlanilhaGuardada } from "./components/tipos";
import { useUrl } from "./components/url";

// Nomes amigáveis dos campos que o verificador pode apontar numa divergência.
const CAMPOS: Record<string, string> = {
  esperadoCent: "pontos corretos (em centésimos)", situacao: "classificação do resultado", field: "inscritos considerados",
  buyIn: "buy-in", premiados: "número de premiados", jogador: "jogador", torneioId: "torneio", "nº de linhas": "quantidade de resultados",
  base: "base da posição", fatorParticipantes: "fator de participantes", fatorBuyIn: "fator de buy-in", registradoCent: "pontos registrados (em centésimos)",
  diferenca: "diferença (em centésimos)", pendencia: "motivo de aguardar", "inscritos deduzidos": "inscritos deduzidos",
  "linhas que reproduzem": "resultados que a dedução reproduz", "linhas não pendentes": "resultados considerados",
  "divergência de inscritos": "divergência de inscritos", "inscritos do site": "inscritos do site", "inscritos da API": "inscritos da API",
  "diferença de inscritos": "diferença de inscritos", "linhas explicadas": "resultados explicados", "torneio presente": "torneio presente",
};

const ABAS_VALIDAS: string[] = ABAS.map((a) => a.id);
// A planilha só vale para a Etapa 3.
const ETAPA_PLANILHA = ETAPAS[2].v;
const MSG_SEM_RANKING = "Esta etapa ainda não tem ranking publicado.";

export default function Home() {
  const { q, pronto, navegar } = useUrl();
  const [stage, setStage] = useState(ETAPAS[1].v);
  const [foraPremiacao, setForaPremiacao] = useState("base10xFatores");
  const [apos18, setApos18] = useState("base100TodosItm");
  const [tolerancia, setTolerancia] = useState("0,01");
  const [campo, setCampo] = useState("inscritos");
  // Versão dos acordos: muda quando alguém marca ou desfaz um acordo, e invalida as leituras guardadas de outras etapas.
  const versaoAcordos = useRef(0);
  const [, setVAc] = useState(0);
  const [guardadas, setGuardadas] = useState<Record<string, Guardada>>({});
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState<[number, number] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [bloqueio, setBloqueio] = useState<Bloqueio | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [revisados, setRevisados] = useState<Set<string>>(new Set());
  const [planilha, setPlanilha] = useState<PlanilhaGuardada | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [lidoAberto, setLidoAberto] = useState(false);

  // Consolidado: ranking correto acumulado, montado só com etapas já auditadas (a mesma rota /api/auditoria).
  const [semRanking3, setSemRanking3] = useState<boolean | null>(null); // null = ainda não sei se o site tem a Etapa 3
  const [carregandoCons, setCarregandoCons] = useState<string | null>(null);
  const [erroCons, setErroCons] = useState<string | null>(null);
  const guardadasRef = useRef(guardadas);
  guardadasRef.current = guardadas;

  const atual = guardadas[stage];
  const d = atual?.dados;
  const abaUrl = q.get(ENDERECO.aba) ?? ABAS[0].id;
  const aba = ABAS_VALIDAS.includes(abaUrl) ? abaUrl : "resumo";
  const ver = d ? q.get(ENDERECO.item) : null;

  const parametros = (etapa: string) =>
    new URLSearchParams({ stage: etapa, foraDoItm: foraPremiacao, aposDecimoOitavo: apos18, tolerancia, campo, av: String(versaoAcordos.current) }).toString();

  async function auditar(etapa = stage) {
    const p = parametros(etapa);
    setCarregando(true);
    setProgresso(null);
    setFalha(null);
    setBloqueio(null);
    setAviso(null);
    try {
      const r = await fetch(`/api/auditoria?${p}&progresso=1`);
      if (!r.body) throw new Error("sem resposta");
      const leitor = r.body.getReader();
      const dec = new TextDecoder();
      let resto = "";
      let fim = false;
      while (!fim) {
        const { value, done } = await leitor.read();
        resto += dec.decode(value, { stream: !done });
        const partes = resto.split("\n");
        resto = done ? "" : partes.pop()!;
        for (const txt of partes.filter(Boolean)) {
          const m = JSON.parse(txt);
          if (m.progresso) setProgresso(m.progresso);
          else if (m.resultado) setGuardadas((g) => ({ ...g, [etapa]: { dados: m.resultado, params: p } }));
          else if (m.erro) {
            setGuardadas((g) => {
              const { [etapa]: _, ...outras } = g;
              return outras;
            });
            if (Array.isArray(m.erro.detalhes)) setBloqueio({ erro: m.erro.erro, detalhes: m.erro.detalhes });
            else setFalha(m.erro.erro ?? "Ocorreu um erro inesperado.");
          }
        }
        fim = done;
      }
      navegar({ [ENDERECO.etapa]: etapa, [ENDERECO.aba]: new URLSearchParams(window.location.search).get(ENDERECO.aba) ?? ABAS[0].id }, "replace");
    } catch {
      setFalha("Não foi possível falar com o servidor. Verifique a conexão e tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  // Acordo (salvo para todos): grava ou desfaz e audita de novo a etapa que está na tela. Devolve a mensagem de erro, ou null.
  async function mudarAcordo(torneioId: string, k: number | null): Promise<string | null> {
    try {
      const r =
        k == null
          ? await fetch(`/api/acordos?etapa=${encodeURIComponent(stage)}&torneioId=${encodeURIComponent(torneioId)}`, { method: "DELETE" })
          : await fetch("/api/acordos", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ etapa: stage, torneioId, k }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) return j?.erro ?? "Não foi possível salvar o acordo. Tente novamente.";
      versaoAcordos.current += 1;
      setVAc(versaoAcordos.current);
      await auditar(stage);
      return null;
    } catch {
      return "Não foi possível falar com o servidor. Verifique a conexão e tente novamente.";
    }
  }

  // Link compartilhado (?aba=...): lê a etapa do endereço e audita sozinho.
  const partiu = useRef(false);
  const ultimoFoco = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!pronto || partiu.current) return;
    partiu.current = true;
    const e = q.get(ENDERECO.etapa);
    const etapa = ETAPAS.some((x) => x.v === e) ? (e as string) : stage;
    setStage(etapa);
    if (q.has(ENDERECO.aba) || q.has(ENDERECO.item)) void auditar(etapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto]);

  // Planilha guardada no servidor (vale para todos os visitantes).
  async function carregarPlanilha() {
    try {
      const j = await (await fetch("/api/planilha", { cache: "no-store" })).json();
      setPlanilha(j?.carregada ? (j as PlanilhaGuardada) : null);
    } catch {
      setPlanilha(null);
    }
  }
  useEffect(() => {
    void carregarPlanilha();
  }, []);

  // ---------- Consolidado ----------
  const visaoCons = q.get(ENDERECO_EXTRA.visao) === CONSOLIDADO.visao;
  const ateUrl = ETAPAS.findIndex((e) => e.v === q.get(ENDERECO.etapa)) + 1;
  const ate = ateUrl === 3 && semRanking3 === true && !planilha ? 2 : ateUrl || (planilha ? 3 : 2);
  // A leitura serve só se foi feita com as mesmas regras de agora e, na Etapa 3, com a mesma origem (planilha ou site).
  const fresca = (g: Record<string, Guardada>, k: number) => {
    const slug = ETAPAS[k - 1].v;
    const x = g[slug];
    if (!x || x.params !== parametros(slug)) return false;
    return slug !== ETAPA_PLANILHA || (x.dados.origem?.tipo === "planilha") === (planilha != null);
  };

  useEffect(() => setSemRanking3(null), [planilha?.sha256]);
  useEffect(() => {
    if (!visaoCons || !pronto) return;
    let cancelado = false;
    (async () => {
      setErroCons(null);
      for (const k of [1, 2, 3].filter((x) => x <= ate || (x === 3 && !planilha && semRanking3 === null))) {
        if (fresca(guardadasRef.current, k)) continue;
        const slug = ETAPAS[k - 1].v;
        setCarregandoCons(`Lendo a Etapa ${k}…`);
        const r = await lerAuditoria(parametros(slug), (f, t) => !cancelado && setCarregandoCons(`Lendo a Etapa ${k}: jogadores ${f} de ${t}`));
        if (cancelado) return;
        if (r.resultado) {
          setGuardadas((g) => ({ ...g, [slug]: { dados: r.resultado!, params: parametros(slug) } }));
          if (k === 3) setSemRanking3(false);
        } else if (k === 3 && (r.erro?.erro === MSG_SEM_RANKING || k > ate)) {
          setSemRanking3(true); // sem planilha e sem ranking no site
          setGuardadas((g) => {
            const { [slug]: _, ...outras } = g;
            return outras;
          });
        } else {
          setErroCons(r.semServidor ? "Não foi possível falar com o servidor. Verifique a conexão e tente novamente." : (r.erro?.erro ?? "Ocorreu um erro inesperado."));
          break;
        }
      }
      if (!cancelado) setCarregandoCons(null);
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaoCons, pronto, ate, planilha?.sha256, semRanking3, foraPremiacao, apos18, tolerancia, campo, versaoAcordos.current]);

  const consolidado = useMemo(() => {
    if (!visaoCons) return null;
    const etapas: EtapaConsolidado[] = [];
    for (let k = 1; k <= ate; k++) {
      if (!fresca(guardadas, k)) return null;
      const d3 = guardadas[ETAPAS[k - 1].v].dados;
      etapas.push({
        numero: k,
        jogadores: d3.painel.jogadores.map((j) => ({ nome: j.nome, id: j.id })),
        linhas: d3.linhas.map((l) => ({ jogador: l.jogador, posicao: l.posicao, esperadoCent: Math.round(l.esperado * 100), aguarda: l.classe === "aguarda", participacao: l.participacao })),
      });
    }
    return consolidar(etapas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaoCons, ate, guardadas, planilha, foraPremiacao, apos18, tolerancia, campo, versaoAcordos.current]);
  const regraCons = guardadas[ETAPAS[ate - 1].v]?.dados.painel.regrasTexto.find((r) => r.titulo === "Quem fica fora da premiação")?.valor ?? null;
  const opcoesEtapa: EtapaOpcao[] = ETAPAS.map((_, i) => ({
    numero: i + 1,
    rotulo: `Etapa ${i + 1}`,
    estado: i < 2 || planilha || semRanking3 === false ? "ok" : semRanking3 === true ? "sem-dados" : "verificando",
  }));
  function sairConsolidado() {
    navegar({ [ENDERECO_EXTRA.visao]: null });
    setTimeout(() => document.getElementById("btn-consolidado")?.focus(), 0);
  }
  function alternarConsolidado() {
    if (visaoCons) sairConsolidado();
    else navegar({ [ENDERECO_EXTRA.visao]: CONSOLIDADO.visao, [ENDERECO.etapa]: ETAPAS[ate - 1].v, [ENDERECO.item]: null });
  }
  useEffect(() => {
    if (!visaoCons) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) sairConsolidado();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaoCons]);

  async function enviarPlanilha(arquivo: File) {
    setEnviando(true);
    setErroEnvio(null);
    try {
      const f = new FormData();
      f.set("arquivo", arquivo);
      const r = await fetch("/api/planilha", { method: "POST", body: f });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setErroEnvio(j?.erro ?? "Não foi possível enviar a planilha. Tente novamente.");
        return;
      }
      await carregarPlanilha();
      setStage(ETAPA_PLANILHA);
      navegar({ [ENDERECO.etapa]: ETAPA_PLANILHA, [ENDERECO.item]: null }, "replace");
      setLidoAberto(true);
      await auditar(ETAPA_PLANILHA);
    } catch {
      setErroEnvio("Não foi possível falar com o servidor. Verifique a conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  async function removerPlanilha() {
    setRemovendo(true);
    setErroEnvio(null);
    try {
      const r = await fetch("/api/planilha", { method: "DELETE" });
      if (!r.ok) throw new Error("falhou");
      setPlanilha(null);
      if (guardadas[ETAPA_PLANILHA]?.dados.origem?.tipo === "planilha") {
        setGuardadas((g) => {
          const { [ETAPA_PLANILHA]: _, ...outras } = g;
          return outras;
        });
        if (stage === ETAPA_PLANILHA) await auditar(ETAPA_PLANILHA); // sem planilha, o servidor responde que a etapa ainda não tem ranking
      }
    } catch {
      setErroEnvio("Não foi possível remover a planilha. Tente novamente.");
    } finally {
      setRemovendo(false);
    }
  }

  async function baixar(tipo: "relatorio" | "exportacao") {
    if (!atual) return;
    setBaixando(tipo);
    setAviso(null);
    try {
      const qs = new URLSearchParams(atual.params);
      qs.set("id", atual.dados.identificador.sha256);
      const r = await fetch(`/api/${tipo}?${qs}`);
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.erro ?? "Não foi possível gerar o arquivo.");
      }
      if (r.headers.get("X-Dados-Mudaram") === "1")
        setAviso(
          atual.dados.origem?.tipo === "planilha"
            ? TEXTOS_PLANILHA.mudou
            : "Os dados do site mudaram depois desta auditoria. O arquivo baixado usa os dados mais recentes e pode não bater com a tela. Clique em “Auditar etapa” para atualizar a tela.",
        );
      const nome = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? `${tipo}.xlsx`;
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setFalha(e instanceof TypeError ? "Não foi possível falar com o servidor. Verifique a conexão e tente novamente." : e instanceof Error ? e.message : "Não foi possível gerar o arquivo.");
    } finally {
      setBaixando(null);
    }
  }

  // "Marcar como revisado": guardado só neste navegador, por etapa e versão dos dados.
  const chaveRevisados = d ? `spt-revisados:${stage}:${d.identificador.sha256.slice(0, 8)}` : null;
  useEffect(() => {
    if (!chaveRevisados) return;
    try {
      setRevisados(new Set(JSON.parse(localStorage.getItem(chaveRevisados) ?? "[]")));
    } catch {
      setRevisados(new Set());
    }
  }, [chaveRevisados]);
  const alternarRevisado = useCallback(
    (chave: string) => {
      setRevisados((anterior) => {
        const novo = new Set(anterior);
        if (!novo.delete(chave)) novo.add(chave);
        try {
          if (chaveRevisados) localStorage.setItem(chaveRevisados, JSON.stringify([...novo]));
        } catch {
          /* sem armazenamento: o marcador vale só enquanto a página estiver aberta */
        }
        return novo;
      });
    },
    [chaveRevisados],
  );

  const contadores: Record<string, number> = d
    ? {
        erros: d.painel.indicadores.erros,
        divergencias: d.painel.indicadores.divergenciasInscritos.torneios,
        jogadores: d.painel.jogadores.length,
        torneios: d.painel.torneios.filter((t) => t.resultados > 0).length,
        aguardando: d.painel.indicadores.aguardando,
      }
    : {};
  const abas: Aba[] = d ? ABAS.map((a) => (a.comContador ? { id: a.id, rotulo: a.rotulo, contador: contadores[a.id] } : { id: a.id, rotulo: a.rotulo })) : [];
  const listaNavegacao = useMemo(() => (d && aba === "erros" ? filtrarErros(d, q) : null), [d, aba, q]);

  return (
    <div className="pagina">
      <div inert={ver ? true : undefined} onFocusCapture={(e) => { ultimoFoco.current = e.target as HTMLElement; }}>
        <header className="topo">
          <img className="logo" src="/logo-spt-transparente-560.png" alt="Suprema Poker Tour" width={560} height={195} decoding="async" fetchPriority="high" />
          <h1>Auditoria do Ranking</h1>
        </header>

        <Barra
          stage={stage}
          onEtapa={(v) => {
            setStage(v);
            navegar({ [ENDERECO.etapa]: v, [ENDERECO.item]: null }, "replace");
          }}
          carregando={carregando}
          progresso={progresso}
          onAuditar={() => auditar()}
          onBaixar={baixar}
          baixando={baixando}
          d={d}
          planilha={planilha}
          enviando={enviando}
          removendo={removendo}
          erroEnvio={erroEnvio}
          onEnviar={enviarPlanilha}
          onRemover={removerPlanilha}
          lidoFechado={!lidoAberto}
          onAbrirLido={() => setLidoAberto(true)}
          consolidadoAtivo={visaoCons}
          onConsolidado={alternarConsolidado}
        />

        <main className="wrap">
          {visaoCons ? (
            <Consolidado
              ate={ate}
              etapas={opcoesEtapa}
              onAte={(k) => navegar({ [ENDERECO.etapa]: ETAPAS[k - 1].v }, "replace")}
              dados={consolidado}
              carregando={carregandoCons}
              erro={erroCons}
              regra={regraCons}
              onSair={sairConsolidado}
            />
          ) : (
            <>
          {falha && (
            <div className="aviso bloqueio" role="alert">
              <b>Não foi possível concluir.</b> {falha}
            </div>
          )}
          {aviso && (
            <div className="aviso atencao" role="status">
              {aviso}
            </div>
          )}

          {bloqueio && (
            <div className="aviso bloqueio" role="alert">
              <h2>Auditoria bloqueada</h2>
              <p>Os dois cálculos independentes não chegaram ao mesmo resultado, ou uma conferência de consistência falhou. Por segurança, nenhum número é exibido nem pode ser baixado até isso ser resolvido.</p>
              <p className="muted small">{bloqueio.erro}</p>
              <ul>
                {bloqueio.detalhes.slice(0, 50).map((x, i) => {
                  if (typeof x === "string") return <li key={i}>{x}</li>;
                  const o = x as { jogador: string; torneio: string; posicao: number | null; campo: string; motor: unknown; verificador: unknown };
                  return (
                    <li key={i}>
                      {o.jogador} — {o.torneio}
                      {o.posicao != null && `, ${o.posicao}º`}: {CAMPOS[o.campo] ?? o.campo}; primeiro cálculo {String(o.motor)}, segundo cálculo {String(o.verificador)}.
                    </li>
                  );
                })}
              </ul>
              {bloqueio.detalhes.length > 50 && <p className="muted small">… e mais {bloqueio.detalhes.length - 50} itens.</p>}
            </div>
          )}

          {!d && !carregando && !bloqueio && !falha && (
            <section className="comecar" aria-labelledby="t-comecar">
              <h2 id="t-comecar">Como começar</h2>
              <p className="muted">Em poucos segundos você vê quantos erros existem, quais são e por quê.</p>
              <ol className="passos">
                <li>
                  <span className="numero" aria-hidden="true">1</span>
                  <b>Escolher a etapa</b>
                  <span className="muted">Etapa 1, 2 ou 3, no seletor da barra acima.</span>
                </li>
                <li>
                  <span className="numero" aria-hidden="true">2</span>
                  <b>Auditar etapa</b>
                  <span className="muted">A ferramenta lê os resultados do site e refaz a conta de cada um.</span>
                </li>
                <li>
                  <span className="numero" aria-hidden="true">3</span>
                  <b>Ler os erros</b>
                  <span className="muted">Veja quantos são, quais são e por quê.</span>
                </li>
              </ol>
            </section>
          )}

          {d && (
            <>
              {d.painel.numeroEtapa === 1 && <div className="aviso referencia">Etapa de referência: usada para conferir as regras.</div>}
              {d.painel.avisos.map((a) => (
                <div key={a} className="aviso atencao" role="status">
                  {a}
                </div>
              ))}

              {planilha && lidoAberto && d.origem?.tipo === "planilha" && <BlocoLido p={planilha} d={d} onFechar={() => setLidoAberto(false)} />}

              <Abas abas={abas} atual={aba} onMudar={(id) => navegar({ [ENDERECO.aba]: id, [ENDERECO.item]: null })} />

              <div role="tabpanel" id="conteudo-aba" aria-labelledby={`aba-${aba}`} className="conteudo-aba">
                {aba === "resumo" && <Resumo d={d} navegar={navegar} />}
                {aba === "erros" && <Erros d={d} q={q} navegar={navegar} revisados={revisados} />}
                {aba === "divergencias" && <Divergencias d={d} navegar={navegar} />}
                {aba === "jogadores" && <Jogadores d={d} q={q} navegar={navegar} />}
                {aba === "torneios" && <Torneios d={d} navegar={navegar} />}
                {aba === "aguardando" && <Aguardando d={d} />}
                {aba === "regras" && <Regras d={d} opcoes={{ foraPremiacao, setForaPremiacao, apos18, setApos18, tolerancia, setTolerancia, campo, setCampo }} />}
              </div>
            </>
          )}
            </>
          )}
        </main>
      </div>

      {d && ver && <Painel key={ver.split(":")[0]} d={d} ver={ver} navegar={navegar} lista={listaNavegacao} revisados={revisados} alternarRevisado={alternarRevisado} retorno={ultimoFoco} onAcordo={mudarAcordo} />}
    </div>
  );
}
