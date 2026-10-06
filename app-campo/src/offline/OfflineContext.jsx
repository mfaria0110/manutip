import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { contarPendentes, sincronizar } from "./fila";

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendentes, setPendentes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const sincronizandoRef = useRef(false);

  const atualizarContagem = useCallback(() => {
    contarPendentes().then(setPendentes).catch(() => {});
  }, []);

  const sincronizarAgora = useCallback(async () => {
    if (sincronizandoRef.current || !navigator.onLine) return;
    sincronizandoRef.current = true;
    setSincronizando(true);
    try {
      await sincronizar();
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
      atualizarContagem();
    }
  }, [atualizarContagem]);

  useEffect(() => {
    atualizarContagem();
    function aoFicarOnline() {
      setOnline(true);
      sincronizarAgora();
    }
    function aoFicarOffline() {
      setOnline(false);
    }
    window.addEventListener("online", aoFicarOnline);
    window.addEventListener("offline", aoFicarOffline);
    // Tenta sincronizar periodicamente também — cobre o caso de "voltou a
    // internet" sem o navegador disparar o evento (comum em rede celular
    // instável, que fica alternando sem um "offline" explícito no meio).
    const intervalo = setInterval(sincronizarAgora, 20000);
    sincronizarAgora();
    return () => {
      window.removeEventListener("online", aoFicarOnline);
      window.removeEventListener("offline", aoFicarOffline);
      clearInterval(intervalo);
    };
  }, [sincronizarAgora, atualizarContagem]);

  return (
    <OfflineContext.Provider value={{ online, pendentes, sincronizando, sincronizarAgora, atualizarContagem }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline deve ser usado dentro de OfflineProvider");
  return ctx;
}
