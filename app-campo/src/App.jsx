import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AcessoProvider, useAcesso } from "./AcessoContext";
import { FluxoProvider } from "./FluxoContext";
import { OfflineProvider } from "./offline/OfflineContext";
import FaixaOffline from "./FaixaOffline";
import Login from "./pages/Login";
import Equipe from "./pages/Equipe";
import Prefeitura from "./pages/Prefeitura";
import Reclamacoes from "./pages/Reclamacoes";
import Execucao from "./pages/Execucao";

function Rotas() {
  const { perfil, carregando } = useAcesso();
  if (carregando) return null;
  if (!perfil) return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route path="/equipe" element={<Equipe />} />
      <Route path="/prefeitura" element={<Prefeitura />} />
      <Route path="/reclamacoes" element={<Reclamacoes />} />
      <Route path="/execucao/:id" element={<Execucao />} />
      <Route path="*" element={<Navigate to="/equipe" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/campo">
      <OfflineProvider>
        <AcessoProvider>
          <FluxoProvider>
            <FaixaOffline />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<Rotas />} />
            </Routes>
          </FluxoProvider>
        </AcessoProvider>
      </OfflineProvider>
    </BrowserRouter>
  );
}
