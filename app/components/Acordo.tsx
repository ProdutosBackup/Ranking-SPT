"use client";

import { useEffect, useId, useRef, useState } from "react";
import { validarK } from "../../lib/acordo";
import { ACORDO } from "./estrutura";

/**
 * Cartão "Acordo" do painel lateral, logo abaixo de "Conta correta": marca que os jogadores das posições 1 a K pontuam como o Kº colocado.
 * Vale para o torneio e para todos (salvo no servidor). Sem acordo: caixa que abre o campo; com acordo: resumo e "Remover acordo"
 * (com confirmação curta); para quem está fora das posições 1 a K, só o aviso.
 */
export function Acordo({
  atual,
  dentro,
  premiados,
  onAplicar,
  onRemover,
}: {
  /** K do acordo já salvo para este torneio, ou null. */
  atual: number | null;
  /** O resultado aberto está entre as posições 1 a K do acordo salvo. */
  dentro: boolean;
  premiados: number;
  onAplicar: (k: number) => Promise<string | null>;
  onRemover: () => Promise<string | null>;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLInputElement>(null);
  const resumo = useRef<HTMLParagraphElement>(null);
  const remover = useRef<HTMLButtonElement>(null);
  const acaoLocal = useRef(false);

  // O acordo salvo mudou (outra pessoa, ou esta mesma): o cartão volta ao estado de leitura e, se a mudança foi daqui, o foco segue.
  useEffect(() => {
    setAberto(false);
    setValor("");
    setErro(null);
    setConfirmando(false);
    if (acaoLocal.current) {
      acaoLocal.current = false;
      (atual != null ? resumo : caixa).current?.focus();
    }
  }, [atual]);

  // Só o formato (inteiro, de 2 até os premiados); a mensagem é a mesma do servidor.
  const checar = (texto: string) => validarK(/^\s*\d+\s*$/.test(texto) ? Number(texto) : Number.NaN, premiados);

  async function aplicar() {
    if (ocupado) return;
    const msg = checar(valor);
    setErro(msg);
    if (msg) return campo.current?.focus();
    setOcupado(true);
    acaoLocal.current = true;
    const falha = await onAplicar(Number(valor));
    setOcupado(false);
    if (falha) {
      acaoLocal.current = false;
      setErro(falha);
      campo.current?.focus();
    }
  }

  async function confirmarRemocao() {
    if (ocupado) return;
    setOcupado(true);
    acaoLocal.current = true;
    const falha = await onRemover();
    setOcupado(false);
    if (falha) {
      acaoLocal.current = false;
      setConfirmando(false);
      setErro(falha);
      setTimeout(() => remover.current?.focus(), 0);
    }
  }

  function cancelar() {
    setConfirmando(false);
    setTimeout(() => remover.current?.focus(), 0);
  }

  const erroP = erro && (
    <p id={`${id}-erro`} className="acordo-erro" role="alert">
      {erro}
    </p>
  );

  return (
    <section className={`bloco acordo-cartao${atual != null ? " ativo" : ""}`} aria-labelledby={`${id}-t`}>
      <h4 id={`${id}-t`}>{ACORDO.rotulo}</h4>

      {atual != null && !dentro ? (
        <p className="acordo-resumo" role="note">
          {ACORDO.aviso(atual)}
        </p>
      ) : atual != null ? (
        <>
          <p ref={resumo} className="acordo-resumo" tabIndex={-1}>
            {ACORDO.resumo(atual)}
          </p>
          {confirmando ? (
            <div
              className="acordo-confirma"
              role="group"
              aria-labelledby={`${id}-c`}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation(); // Esc cancela a confirmação sem fechar o painel
                  cancelar();
                }
              }}
            >
              <span id={`${id}-c`}>{ACORDO.confirmar}</span>
              <span className="acordo-botoes">
                <button type="button" className="btn perigo" onClick={() => void confirmarRemocao()}>
                  {ocupado ? "Removendo…" : ACORDO.confirmarSim}
                </button>
                <button type="button" className="btn sec" autoFocus onClick={cancelar}>
                  {ACORDO.confirmarNao}
                </button>
              </span>
            </div>
          ) : (
            <button ref={remover} type="button" className="acordo-link" onClick={() => setConfirmando(true)}>
              {ACORDO.remover}
            </button>
          )}
          {erroP}
        </>
      ) : (
        <>
          <label className="acordo-caixa">
            <input
              ref={caixa}
              type="checkbox"
              checked={aberto}
              aria-controls={`${id}-campo`}
              aria-expanded={aberto}
              onChange={(e) => {
                setAberto(e.target.checked);
                setErro(null);
                if (e.target.checked) setTimeout(() => campo.current?.focus(), 0);
              }}
            />
            <span>{ACORDO.caixa}</span>
          </label>
          {aberto && (
            <div id={`${id}-campo`} className="acordo-campo">
              <label htmlFor={`${id}-k`}>{ACORDO.pergunta}</label>
              <div className="acordo-linha">
                <input
                  id={`${id}-k`}
                  ref={campo}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={valor}
                  aria-invalid={erro ? true : undefined}
                  aria-describedby={erro ? `${id}-erro` : `${id}-dica`}
                  onChange={(e) => {
                    setValor(e.target.value);
                    setErro(null);
                  }}
                  onFocus={() => setErro(null)}
                  onBlur={() => setErro(valor.trim() === "" ? null : checar(valor))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void aplicar();
                    }
                  }}
                />
                <button type="button" className="btn" aria-busy={ocupado} onClick={() => void aplicar()}>
                  {ocupado ? "Aplicando…" : ACORDO.aplicar}
                </button>
              </div>
              {erroP ?? (
                <p id={`${id}-dica`} className="acordo-dica">
                  {ACORDO.dica(premiados)}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
