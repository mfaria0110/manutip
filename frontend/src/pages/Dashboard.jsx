import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  apiAtividades,
  apiBairros,
  apiCidades,
  apiContratos,
  apiFuncionarios,
  apiMateriais,
  apiOrdensServico,
  apiPrefeituras,
  apiVeiculos,
} from "../api";
import { useAcesso } from "../AcessoContext";
import logoSelles from "../assets/logo-selles.png";
import heroIluminacao from "../assets/login-bg.jpg";

const STATUS_ABERTA = new Set(["ABERTA", "VALIDADA"]);

export default function Dashboard() {
  const { perfil } = useAcesso();
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null);

  useEffect(() => {
    Promise.all([
      apiPrefeituras.listar(),
      apiContratos.listar(),
      apiOrdensServico.listar(),
      apiVeiculos.listar(),
      apiFuncionarios.listar(),
      apiMateriais.listar(),
      apiAtividades.listar(),
      apiCidades.listar(),
      apiBairros.listar(),
    ])
      .then(([prefeituras, contratos, ordens, veiculos, funcionarios, materiais, atividades, cidades, bairros]) => {
        setDados({
          prefeituras,
          contratos,
          ordens,
          veiculos,
          funcionarios,
          materiais,
          atividades,
          cidades,
          bairros,
        });
      })
      .finally(() => setCarregando(false));
  }, []);

  const osAbertas = dados?.ordens.filter((o) => STATUS_ABERTA.has(o.status)).length ?? 0;
  const contratosAtivos = dados?.contratos.filter((c) => c.ativo).length ?? 0;
  const valorTotalOS = (dados?.ordens || []).reduce((acc, o) => acc + Number(o.valor_total || 0), 0);

  const cartoes = [
    { label: "Prefeituras atendidas", valor: dados?.prefeituras.length, icon: "ti-building-bank", to: "/prefeituras" },
    { label: "Contratos ativos", valor: contratosAtivos, icon: "ti-file-text", to: "/contratos" },
    { label: "Ordens de serviço abertas", valor: osAbertas, icon: "ti-clipboard-list", to: "/ordens-servico" },
    { label: "Veículos da frota", valor: dados?.veiculos.length, icon: "ti-truck", to: "/veiculos" },
    { label: "Funcionários", valor: dados?.funcionarios.length, icon: "ti-users", to: "/funcionarios" },
    { label: "Tipos de serviço", valor: dados?.atividades.length, icon: "ti-list-check", to: "/atividades" },
    { label: "Materiais cadastrados", valor: dados?.materiais.length, icon: "ti-package", to: "/materiais" },
    { label: "Cidades / Bairros", valor: dados ? `${dados.cidades.length} / ${dados.bairros.length}` : undefined, icon: "ti-map-pin", to: "/bairros" },
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

            <div className="card" style={{ marginTop: 16 }}>
              <div className="table-header" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Resumo financeiro das OS</h3>
              </div>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
                Valor total somado de todas as ordens de serviço lançadas:{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  R$ {valorTotalOS.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </strong>
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
