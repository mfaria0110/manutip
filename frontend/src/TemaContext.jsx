import { createContext, useContext, useEffect, useState } from "react";
import { meuPerfil, salvarTema } from "./api";

/**
 * TemaContext — paleta de cores do app, POR usuário.
 *
 * A cor escolhida é salva no backend (usuarios.tema) e segue a pessoa entre
 * navegadores/dispositivos. O localStorage é só um cache POR usuário (chave
 * `manutip_tema_<username>`) para aplicar a cor na hora, sem "piscar", antes
 * de o /api/me responder.
 *
 * Aplica via atributo data-tema no <html> (ver definições em styles.css).
 * Mesmo padrão usado no EcoWatt (TemaContext.jsx / SeletorTema.jsx).
 */
export const PALETAS = [
  { id: "azul", nome: "Azul", cor: "#2563eb" },
  { id: "indigo", nome: "Índigo", cor: "#4f46e5" },
  { id: "violeta", nome: "Violeta", cor: "#8b5cf6" },
  { id: "roxo", nome: "Roxo", cor: "#7e22ce" },
  { id: "ciano", nome: "Ciano", cor: "#0891b2" },
  { id: "turquesa", nome: "Turquesa", cor: "#0d9488" },
  { id: "verde", nome: "Verde", cor: "#059669" },
  { id: "lima", nome: "Lima", cor: "#65a30d" },
  { id: "amarelo", nome: "Âmbar", cor: "#d97706" },
  { id: "laranja", nome: "Laranja", cor: "#ea580c" },
  { id: "vermelho", nome: "Vermelho", cor: "#dc2626" },
  { id: "rosa", nome: "Rosa", cor: "#db2777" },
  { id: "grafite", nome: "Grafite", cor: "#475569" },
];

const PADRAO = "azul";
const chaveDe = (username) => `manutip_tema_${username || "_anon"}`;

function lerCache(username) {
  try {
    return localStorage.getItem(chaveDe(username)) || PADRAO;
  } catch {
    return PADRAO;
  }
}

const TemaCtx = createContext({ tema: PADRAO, setTema: () => {} });

export function TemaProvider({ children, username, autenticado }) {
  const [tema, setTemaState] = useState(() => lerCache(username));

  useEffect(() => {
    setTemaState(lerCache(username));
    if (!autenticado) return;
    let vivo = true;
    meuPerfil()
      .then((u) => {
        if (!vivo || !u?.tema) return;
        setTemaState(u.tema);
        try {
          localStorage.setItem(chaveDe(username), u.tema);
        } catch {}
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [username, autenticado]);

  useEffect(() => {
    document.documentElement.setAttribute("data-tema", tema);
    try {
      localStorage.setItem(chaveDe(username), tema);
    } catch {}
  }, [tema, username]);

  const setTema = (novo) => {
    setTemaState(novo);
    if (autenticado) salvarTema(novo).catch(() => {});
  };

  return <TemaCtx.Provider value={{ tema, setTema }}>{children}</TemaCtx.Provider>;
}

export const useTema = () => useContext(TemaCtx);
