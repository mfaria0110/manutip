import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  apiBairros,
  apiCidades,
  apiContratos,
  apiFuncionarios,
  apiMateriais,
  apiPrefeituras,
  apiReclamacoes,
  apiVeiculos,
} from "../api";
import { useAcesso } from "../AcessoContext";
import logoSelles from "../assets/logo-selles.png";
import heroIluminacao from "../assets/login-bg.jpg";

const STATUS_RECLAMACAO_ABERTA = new Set(["ABERTA", "EM_ANDAMENTO"]);

export default function Dashboard() {
  const { perfil } = useAcesso();
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null);

  useEffect(() => {
    Promise.all([
      apiPrefeituras.listar(),
      apiContratos.listar(),
      apiVeiculos.listar(),
      apiFuncionarios.listar(),
      apiMateriais.listar(),
      apiCidades.listar(),
      apiBairros.listar(),
      apiReclamacoes.listar(),
    ])
      .then(([prefeituras, contratos, veiculos, funcionarios, materiais, cidades, bairros, reclamacoes]) => {
        setDados({
          prefeituras,
          contratos,
          veiculos,
          funcionarios,
          materiais,
          cidades,
          bairros,
          reclamacoes,
        });
      })
      .finally(() => setCarregando(false));
  }, []);

  const contratosAtivos = dados?.contratos.filter((c) => c.ativo).length ?? 0;
  const reclamacoesAbertas = dados?.reclamacoes.filter((r) => STATUS_RECLAMACAO_ABERTA.has(r.status)).length ?? 0;

  const cartoes = [
    { label: "Prefeituras atendidas", valor: dados?.prefeituras.length, icon: "ti-building-bank", to: "/prefeituras" },
    { label: "Contratos ativos", valor: contratosAtivos, icon: "ti-file-text", to: "/contratos" },
    { label: "Reclamações abertas", valor: reclamacoesAbertas, icon: "ti-phone-call", to: "/reclamacoes" },
    { label: "Veículos da frota", valor: dados?.veiculos.length, icon: "ti-truck", to: "/veiculos" },
    { label: "Funcionários", valor: dados?.funcionarios.length, icon: "ti-users", to: "/funcionarios" },
  ];

  return (
    <>
      <header className="topbar">
        <h1>Início</h1>
      </header>

      <div className="content">
        <div className="dash-hero" style={{ backgroundImage: `url(${heroIluminacao})` }}>
          <div className="dash-hero-overlay" />
          <div className="dash-hero-conteudo">
            <img src={logoSelles} alt="Selles" className="dash-hero-logo" />
            <h2>Olá, {perfil?.nome?.split(" ")[0]}</h2>
            <p>Gestão de manutenção e obras de iluminação pública — Manutip</p>
          </div>
        </div>

        {carregando ? (
          <div className="card empty-state">Carregando dados...</div>
        ) : (
          <>
            <div className="dash-grid">
              {cartoes.map((c) => (
                <Link to={c.to} key={c.label} className="dash-card">
                  <div className="dash-card-icon">
                    <i className={`ti ${c.icon}`} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="dash-card-valor">{c.valor ?? "—"}</div>
                    <div className="dash-card-label">{c.label}</div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
