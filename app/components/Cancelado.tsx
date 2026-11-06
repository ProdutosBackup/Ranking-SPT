"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CANCELADO } from "./estrutura";

/**
 * Controle "Cancelado" de um torneio, na aba Torneios (visível sem abrir nada). Marcar ou desmarcar abre a confirmação logo abaixo:
 * "Deseja cancelar o torneio (NOME)?" / "Deseja reativar o torneio (NOME)?", com Sim e Não. Não fecha sem alterar nada.
 * Teclado: o foco entra na confirmação (em "Não", o botão seguro), Esc = Não e o foco volta à caixa. Vale para todos (salvo no servidor).
 * Mesmo padrão da confirmação do acordo: a caixa só muda de valor quando o servidor confirma.
 */
export function ControleCancelado({
  nome,
  cancelado,
  onMudar,
}: {
  nome: string;
  cancelado: boolean;
  /** Grava (true) ou desfaz (false) o cancelamento e audita de novo. Devolve a mensagem de erro, ou null se deu certo. */
  onMudar: (cancelar: boolean) => Promise<string | null>;
}) {
  const id = useId();
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const caixa = useRef<HTMLInputElement>(null);
  const acaoLocal = useRef(false);

  // O valor salvo mudou (outra pessoa, ou esta mesma): a confirmação fecha e, se a mudança foi daqui, o foco volta à caixa.
  useEffect(() => {
    setConfirmando(false);
    setErro(null);
    if (acaoLocal.current) {
      acaoLocal.current = false;
      caixa.current?.focus();
    }
  }, [cancelado]);

  function fechar() {
    setConfirmando(false);
    setErro(null);
    setTimeout(() => caixa.current?.focus(), 0);
  }

  async function sim() {
    if (ocupado) return;
    setOcupado(true);
    acaoLocal.current = true;
    const falha = await onMudar(!cancelado);
    setOcupado(false);
    if (falha) {
      acaoLocal.current = false;
      setErro(falha);
    }
  }

  return (
    <div className="cancelado-ctl">
      <label className="acordo-caixa cancelado-caixa">
        <input
          ref={caixa}
          type="checkbox"
          checked={cancelado}
          aria-label={CANCELADO.controle(nome)}
          aria-expanded={confirmando}
          aria-controls={confirmando ? `${id}-c` : undefined}
          onChange={() => setConfirmando(true)} // a marca só muda depois do "Sim"
        />
        <span>{CANCELADO.rotulo}</span>
      </label>
      {confirmando && (
        <div
          id={`${id}-c`}
          className="acordo-confirma cancelado-confirma"
          role="group"
          aria-labelledby={`${id}-t`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              fechar();
            }
          }}
        >
          <span id={`${id}-t`}>{cancelado ? CANCELADO.reativar(nome) : CANCELADO.cancelar(nome)}</span>
          <span className="acordo-botoes">
            <button type="button" className={cancelado ? "btn" : "btn perigo"} disabled={ocupado} onClick={() => void sim()}>
              {ocupado ? CANCELADO.salvando : CANCELADO.sim}
            </button>
            <button type="button" className="btn sec" autoFocus disabled={ocupado} onClick={fechar}>
              {CANCELADO.nao}
            </button>
          </span>
        </div>
      )}
      {erro && (
        <p className="acordo-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
