"use client";

import { useEffect, useId, useRef, useState } from "react";
import { validarN } from "../../lib/acordo";
import { ACORDO } from "./estrutura";

/**
 * Caixa "Acordo" do rodapé do painel: marca que o torneio teve acordo entre N pessoas (as posições 1 a N dividem os pontos).
 * Vale para todos e fica salvo no servidor. Marcar abre o campo; desmarcar pede uma confirmação curta.
 */
export function Acordo({
  atual,
  premiados,
  onAplicar,
  onDesfazer,
}: {
  /** N do acordo já salvo para este torneio, ou null. */
  atual: number | null;
  premiados: number;
  onAplicar: (n: number) => Promise<string | null>;
  onDesfazer: () => Promise<string | null>;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(atual != null);
  const [valor, setValor] = useState(atual != null ? String(atual) : "");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLInputElement>(null);

  // O acordo salvo mudou (outra pessoa, ou esta mesma): a caixa acompanha.
  useEffect(() => {
    setAberto(atual != null);
    setValor(atual != null ? String(atual) : "");
    setErro(null);
    setConfirmando(false);
  }, [atual]);

  // Valida só o formato do campo (inteiro, de 2 até os premiados); a mensagem é a mesma do servidor.
  const checar = (texto: string) => validarN(/^\s*\d+\s*$/.test(texto) ? Number(texto) : Number.NaN, premiados);

  async function aplicar() {
    const msg = checar(valor);
    setErro(msg);
    if (msg) return campo.current?.focus();
    setOcupado(true);
    const falha = await onAplicar(Number(valor));
    setOcupado(false);
    if (falha) {
      setErro(falha);
      campo.current?.focus();
    }
  }

  async function desfazer() {
    setOcupado(true);
    const falha = await onDesfazer();
    setOcupado(false);
    setConfirmando(false);
    if (falha) setErro(falha);
  }

  return (
    <div className="acordo">
      <label className="acordo-caixa">
        <input
          ref={caixa}
          type="checkbox"
          checked={aberto}
          disabled={ocupado}
          onChange={(e) => {
            if (e.target.checked) {
              setAberto(true);
              setTimeout(() => campo.current?.focus(), 0);
            } else if (atual != null) setConfirmando(true); // há acordo salvo: pede confirmação antes de desfazer
            else {
              setAberto(false);
              setErro(null);
            }
          }}
        />
        <span>{ACORDO.rotulo}</span>
      </label>

      {aberto && !confirmando && (
        <div className="acordo-campo">
          <div className="campo">
            <label htmlFor={`${id}-n`}>{ACORDO.pergunta}</label>
            <input
              id={`${id}-n`}
              ref={campo}
              type="text"
              inputMode="numeric"
              size={4}
              value={valor}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? `${id}-erro` : undefined}
              onChange={(e) => setValor(e.target.value)}
              onBlur={() => setErro(valor.trim() === "" ? null : checar(valor))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void aplicar();
                }
              }}
            />
          </div>
          <button type="button" className="btn" disabled={ocupado} onClick={() => void aplicar()}>
            {ocupado ? "Aplicando…" : ACORDO.aplicar}
          </button>
        </div>
      )}

      {confirmando && (
        <div className="acordo-confirma" role="group" aria-label={ACORDO.desfazer}>
          <span>{ACORDO.desfazer}</span>
          <button type="button" className="btn sec" disabled={ocupado} onClick={() => void desfazer()}>
            {ACORDO.sim}
          </button>
          <button
            type="button"
            className="btn sec"
            autoFocus
            onClick={() => {
              setConfirmando(false);
              setTimeout(() => caixa.current?.focus(), 0);
            }}
          >
            {ACORDO.nao}
          </button>
        </div>
      )}

      {erro && (
        <p id={`${id}-erro`} className="acordo-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
