import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAcesso } from "./AcessoContext";
import { heartbeat, logout } from "./api";
import SeletorTema from "./SeletorTema";
import logoSelles from "./assets/logo-selles.png";

const GRUPOS = [
  {
    label: "Cadastros base",
    itens: [
      { to: "/cidades", icon: "ti-map-pin", label: "Cidades" },
      { to: "/bairros", icon: "ti-map-2", label: "Bairros" },
      { to: "/prefeituras", icon: "ti-building-bank", label: "Prefeituras" },
    ],
  },
  {
    label: "Comercial",
    itens: [
      { to: "/contratos", icon: "ti-file-text", label: "Contratos" },
      { to: "/materiais", icon: "ti-package", label: "Materiais" },
    ],
  },
  {
    label: "Operação",
    itens: [
      { to: "/reclamacoes", icon: "ti-phone-call", label: "Reclamações" },
      { to: "/equipes", icon: "ti-users-group", label: "Equipes do dia" },
      { to: "/veiculos", icon: "ti-truck", label: "Veículos" },
      { to: "/cargos", icon: "ti-id-badge-2", label: "Cargos" },
      { to: "/funcionarios", icon: "ti-users", label: "Funcionários" },
    ],
  },
  {
    label: "Relatórios",
    itens: [{ to: "/relatorios/pontos-atendidos", icon: "ti-report", label: "Pontos atendidos" }],
  },
  {
    label: "Administração",
    itens: [{ to: "/usuarios", icon: "ti-shield-lock", label: "Usuários" }],
  },
];

export default function Layout() {
  const { perfil } = useAcesso();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [recolhida, setRecolhida] = useState(() => localStorage.getItem("manutip_menu_recolhido") === "1");

  // Fecha a gaveta do menu (mobile/tablet) sempre que a rota muda.
  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  // Sinal de vida da sessão — mantém o usuário marcado como "conectado" no
  // servidor, bloqueando login com o mesmo usuário em outra máquina enquanto
  // esta aba estiver aberta (ver JANELA_SESSAO_ATIVA no backend).
  useEffect(() => {
    const id = setInterval(() => {
      heartbeat().catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, []);

  function alternarRecolhida() {
    setRecolhida((v) => {
      const novo = !v;
      localStorage.setItem("manutip_menu_recolhido", novo ? "1" : "0");
      return novo;
    });
  }

  async function sair() {
    await logout();
    navigate("/login");
  }

  const iniciais = (perfil?.nome || "?").trim().slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <button
        className="mobile-menu-btn"
        onClick={() => setMenuAberto((v) => !v)}
        aria-label="Abrir menu"
      >
        <i className={`ti ${menuAberto ? "ti-x" : "ti-menu-2"}`} aria-hidden="true" />
      </button>

      <div className={"sidebar-backdrop" + (menuAberto ? " visivel" : "")} onClick={() => setMenuAberto(false)} />

      <aside className={"sidebar" + (menuAberto ? " aberta" : "") + (recolhida ? " recolhida" : "")}>
        <div className="sidebar-logo">
          <img src={logoSelles} alt="Selles" />
          <span>Manutip</span>
        </div>

        <NavLink to="/" end className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")} title="Início">
          <i className="ti ti-home" aria-hidden="true" />
          <span>Início</span>
        </NavLink>

        {GRUPOS.map((grupo) => (
          <div className="sidebar-group" key={grupo.label}>
            <div className="sidebar-group-label">{grupo.label}</div>
            {grupo.itens.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
                title={item.label}
              >
                <i className={`ti ${item.icon}`} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}

        <div className="sidebar-group sidebar-group-footer">
          <SeletorTema />
        </div>
      </aside>

      <div className="main-area">
        <div className="userbar">
          <button
            className="userbar-toggle"
            onClick={alternarRecolhida}
            title={recolhida ? "Expandir menu" : "Reduzir menu"}
            aria-label={recolhida ? "Expandir menu" : "Reduzir menu"}
          >
            <i className={`ti ${recolhida ? "ti-layout-sidebar-left-expand" : "ti-layout-sidebar-left-collapse"}`} aria-hidden="true" />
          </button>
          <div className="sidebar-user" style={{ marginLeft: "auto" }}>
            <div className="sidebar-user-avatar">{iniciais}</div>
            <div className="sidebar-user-info">
              <div className="userbar-nome">{perfil?.nome}</div>
              <div className="userbar-papel">{perfil?.papel}</div>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ color: "var(--on-accent, #fff)" }} onClick={sair}>
            <i className="ti ti-logout" aria-hidden="true" style={{ marginRight: 6 }} />
            Sair
          </button>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
