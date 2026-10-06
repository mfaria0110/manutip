import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { meuPerfil } from "./api";

const AcessoContext = createContext(null);

export function AcessoProvider({ children }) {
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregarPerfil = () =>
    meuPerfil()
      .then(setPerfil)
      .catch(() => setPerfil(null))
      .finally(() => setCarregando(false));

  useEffect(() => {
    carregarPerfil();
  }, []);

  const valor = useMemo(() => ({ perfil, carregando, recarregar: carregarPerfil }), [perfil, carregando]);

  return <AcessoContext.Provider value={valor}>{children}</AcessoContext.Provider>;
}

export function useAcesso() {
  const ctx = useContext(AcessoContext);
  if (!ctx) throw new Error("useAcesso deve ser usado dentro de AcessoProvider");
  return ctx;
}
