import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AcessoProvider, useAcesso } from "./AcessoContext";
import { TemaProvider } from "./TemaContext";
import Layout from "./Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Cidades from "./pages/Cidades";
import Bairros from "./pages/Bairros";
import Prefeituras from "./pages/Prefeituras";
import Atividades from "./pages/Atividades";
import Contratos from "./pages/Contratos";
import Materiais from "./pages/Materiais";
import MaoObra from "./pages/MaoObra";
import Veiculos from "./pages/Veiculos";
import Cargos from "./pages/Cargos";
import Funcionarios from "./pages/Funcionarios";
import OrdensServico from "./pages/OrdensServico";
import Reclamacoes from "./pages/Reclamacoes";
import ExecucaoReclamacao from "./pages/ExecucaoReclamacao";
import EquipesDia from "./pages/EquipesDia";
import RelatorioPontos from "./pages/RelatorioPontos";
import Usuarios from "./pages/Usuarios";

function Rotas() {
  const { perfil, carregando } = useAcesso();
  if (carregando) return null;
  if (!perfil) return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cidades" element={<Cidades />} />
        <Route path="/bairros" element={<Bairros />} />
        <Route path="/prefeituras" element={<Prefeituras />} />
        <Route path="/atividades" element={<Atividades />} />
        <Route path="/contratos" element={<Contratos />} />
        <Route path="/materiais" element={<Materiais />} />
        <Route path="/mao-obra" element={<MaoObra />} />
        <Route path="/veiculos" element={<Veiculos />} />
        <Route path="/cargos" element={<Cargos />} />
        <Route path="/funcionarios" element={<Funcionarios />} />
        <Route path="/reclamacoes" element={<Reclamacoes />} />
        <Route path="/reclamacoes/:id/execucao" element={<ExecucaoReclamacao />} />
        <Route path="/equipes" element={<EquipesDia />} />
        <Route path="/ordens-servico" element={<OrdensServico />} />
        <Route path="/relatorios/pontos-atendidos" element={<RelatorioPontos />} />
        <Route path="/usuarios" element={<Usuarios />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ComTema({ children }) {
  const { perfil } = useAcesso();
  return (
    <TemaProvider username={perfil?.username} autenticado={!!perfil}>
      {children}
    </TemaProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AcessoProvider>
        <ComTema>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<Rotas />} />
          </Routes>
        </ComTema>
      </AcessoProvider>
    </BrowserRouter>
  );
}
