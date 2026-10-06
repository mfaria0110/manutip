import { createContext, useContext, useEffect, useState } from "react";

// Guarda a equipe e a prefeitura escolhidas pro turno — em localStorage pra
// sobreviver a um recarregamento de página (ou o navegador matando a aba)
// no meio do trabalho em campo.
const FluxoContext = createContext(null);

const CHAVE = "manutip_campo_fluxo";

function carregarInicial() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || { equipeDiaId: null, prefeituraId: null };
  } catch {
    return { equipeDiaId: null, prefeituraId: null };
  }
}

export function FluxoProvider({ children }) {
  const [fluxo, setFluxo] = useState(carregarInicial);

  useEffect(() => {
    localStorage.setItem(CHAVE, JSON.stringify(fluxo));
  }, [fluxo]);

  function definirEquipe(equipeDiaId) {
    setFluxo((f) => ({ ...f, equipeDiaId }));
  }

  function definirPrefeitura(prefeituraId) {
    setFluxo((f) => ({ ...f, prefeituraId }));
  }

  function limpar() {
    setFluxo({ equipeDiaId: null, prefeituraId: null });
  }

  return (
    <FluxoContext.Provider value={{ ...fluxo, definirEquipe, definirPrefeitura, limpar }}>
      {children}
    </FluxoContext.Provider>
  );
}

export function useFluxo() {
  const ctx = useContext(FluxoContext);
  if (!ctx) throw new Error("useFluxo deve ser usado dentro de FluxoProvider");
  return ctx;
}
