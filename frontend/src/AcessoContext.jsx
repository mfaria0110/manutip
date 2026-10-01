import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { meuPerfil } from "./api";

const AcessoContext = createContext(null);

// Nível de ação por perfil — MESMA matriz do backend (app/core/acesso.py).
// ADMIN alcança tudo; USUARIO só "use" por padrão, salvo permissão extra.
const NIVEIS_ORDEM = ["read", "use", "edit", "admin"];
const NIVEL_MAX_POR_PERFIL = { ADMIN: "admin", USUARIO: "use" };

function nivelOk(papel, nivelRequerido) {
  const max = NIVEL_MAX_POR_PERFIL[papel];
  if (!max || !NIVEIS_ORDEM.includes(nivelRequerido)) return false;
  return NIVEIS_ORDEM.indexOf(max) >= NIVEIS_ORDEM.indexOf(nivelRequerido);
}

function parseExtra(entry) {
  const raw = (entry || "").trim();
  if (raw.includes(":")) {
    const [modulo, nivel] = raw.split(":");
    return [modulo.trim(), nivel.trim().toLowerCase()];
  }
  return [raw, null];
}

function nivelOverride(permissoesExtra, modulo) {
  let melhor = null;
  for (const entry of permissoesExtra || []) {
    const [mod, niv] = parseExtra(entry);
    if (!niv) continue;
    const casa = mod === "*" || mod === modulo;
    if (casa && (!melhor || NIVEIS_ORDEM.indexOf(niv) > NIVEIS_ORDEM.indexOf(melhor))) {
      melhor = niv;
    }
  }
  return melhor;
}

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
    const papel = perfil?.papel || null;
    const extras = perfil?.permissoes_extra || [];
    return {
      perfil,
      carregando,
      recarregar: carregarPerfil,
      ehAdmin: papel === "ADMIN",
      // Autorização de AÇÃO num módulo: perfil alcança o nível, ou há extra
      // concedido pelo admin para este usuário específico. Enquanto carrega
      // (papel=null), nega — melhor esconder um botão um instante do que
      // mostrar indevido.
      pode: (modulo, nivel = "use") => {
        if (nivelOk(papel, nivel)) return true;
        const ov = nivelOverride(extras, modulo);
        return !!ov && NIVEIS_ORDEM.indexOf(ov) >= NIVEIS_ORDEM.indexOf(nivel);
      },
    };
  }, [perfil, carregando]);

  return <AcessoContext.Provider value={valor}>{children}</AcessoContext.Provider>;
}

export function useAcesso() {
  const ctx = useContext(AcessoContext);
  if (!ctx) throw new Error("useAcesso deve ser usado dentro de AcessoProvider");
  return ctx;
}
