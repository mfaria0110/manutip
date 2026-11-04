import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { meuPerfil } from "./api";

const AcessoContext = createContext(null);

// Permissões vêm do PERFIL de acesso do usuário (tela Usuários → Perfis de
// acesso), calculadas no backend (/api/me → permissoes, "modulo.acao").
// Superadmin tem tudo. Forma antiga pode(modulo, nivel) continua aceita:
// "use"/"read" → acesso, "edit" → editar, "admin" → excluir.
const NIVEL_PARA_ACAO = { read: "acesso", use: "acesso", edit: "editar", admin: "excluir" };

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

  const valor = useMemo(() => {
    const ehSuperadmin = perfil?.perfil === "superadmin";
    const permissoes = new Set(perfil?.permissoes || []);
    // Enquanto carrega (perfil=null), nega — melhor esconder um botão um
    // instante do que mostrar indevido.
    const pode = (alvo, nivel) => {
      if (!perfil) return false;
      if (ehSuperadmin) return true;
      const permissao = alvo.includes(".") ? alvo : `${alvo}.${NIVEL_PARA_ACAO[nivel || "use"] || nivel}`;
      return permissoes.has(permissao);
    };
    return {
      perfil,
      carregando,
      recarregar: carregarPerfil,
      ehSuperadmin,
      ehOperacional: !!perfil?.operacional,
      pode,
    };
  }, [perfil, carregando]);

  return <AcessoContext.Provider value={valor}>{children}</AcessoContext.Provider>;
}

export function useAcesso() {
  const ctx = useContext(AcessoContext);
  if (!ctx) throw new Error("useAcesso deve ser usado dentro de AcessoProvider");
  return ctx;
}
