import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { meuPerfil } from "./api";

const AcessoContext = createContext(null);

// Nível de ação por perfil — MESMA matriz do backend (app/core/acesso.py).
// ADMIN alcança tudo; USUARIO só "use" por padrão, salvo permissão extra.
const NIVEIS_ORDEM = ["read", "use", "edit", "admin"];
const NIVEL_MAX_POR_PERFIL = { SUPERADMIN: "admin", ADMIN: "admin", USUARIO: "use", OPERACIONAL: "use" };

// Módulos só do SUPERADMIN — mesma lista de app/core/acesso.py
// (MODULOS_SOMENTE_SUPERADMIN), nem ADMIN nem permissão extra libera.
const MODULOS_SOMENTE_SUPERADMIN = ["categorias_material"];

// Módulos só de ADMIN/SUPERADMIN — mesma lista de app/core/acesso.py
// (MODULOS_SOMENTE_ADMIN), nem permissão extra libera para USUARIO comum.
const MODULOS_SOMENTE_ADMIN = ["usuarios", "contratos", "precos"];

// OPERACIONAL (app de campo) tem "edit" liberado só nesses módulos — mesma
// lista de app/core/acesso.py (MODULOS_EDIT_OPERACIONAL).
const MODULOS_EDIT_OPERACIONAL = ["equipes", "reclamacoes", "execucoes"];

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
      ehAdmin: papel === "ADMIN" || papel === "SUPERADMIN",
      ehSuperadmin: papel === "SUPERADMIN",
      ehOperacional: papel === "OPERACIONAL",
      // Autorização de AÇÃO num módulo: perfil alcança o nível, ou há extra
      // concedido pelo admin para este usuário específico. Enquanto carrega
      // (papel=null), nega — melhor esconder um botão um instante do que
      // mostrar indevido.
      pode: (modulo, nivel = "use") => {
        if (MODULOS_SOMENTE_SUPERADMIN.includes(modulo)) return papel === "SUPERADMIN";
        if (MODULOS_SOMENTE_ADMIN.includes(modulo)) return papel === "ADMIN" || papel === "SUPERADMIN";
        if (papel === "OPERACIONAL" && MODULOS_EDIT_OPERACIONAL.includes(modulo)) {
          return NIVEIS_ORDEM.indexOf("edit") >= NIVEIS_ORDEM.indexOf(nivel);
        }
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
