import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AcessoProvider, useAcesso } from "./AcessoContext";
import Login from "./pages/Login";

function Dashboard() {
  const { perfil, ehAdmin } = useAcesso();
  return (
    <div style={{ padding: 24 }}>
      <h1>Manutip</h1>
      <p>Bem-vindo, {perfil?.nome}.</p>
      <p>Perfil: {perfil?.papel} {ehAdmin && "(acesso total)"}</p>
    </div>
  );
}

function Rotas() {
  const { perfil, carregando } = useAcesso();
  if (carregando) return null;
  if (!perfil) return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AcessoProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<Rotas />} />
        </Routes>
      </AcessoProvider>
    </BrowserRouter>
  );
}
