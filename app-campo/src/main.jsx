import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

// autoUpdate: quando sobe uma versão nova do app, o service worker troca
// sozinho no próximo carregamento — sem avisar o usuário no meio do
// trabalho em campo, que não tem como perder o que já preencheu numa tela.
// Em desenvolvimento (npm run dev) não usa service worker: ele ficava servindo
// a versão antiga do app guardada em cache e escondia as alterações. Remove
// qualquer um que tenha sobrado de um build anterior e limpa o cache dele.
if (import.meta.env.DEV) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  }
  if ("caches" in window) {
    caches.keys().then((chaves) => chaves.forEach((c) => caches.delete(c)));
  }
} else {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
