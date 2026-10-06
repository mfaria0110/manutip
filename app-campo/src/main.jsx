import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

// autoUpdate: quando sobe uma versão nova do app, o service worker troca
// sozinho no próximo carregamento — sem avisar o usuário no meio do
// trabalho em campo, que não tem como perder o que já preencheu numa tela.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
