import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAcesso } from "./AcessoContext";
import { logout } from "./api";
import SeletorTema from "./SeletorTema";
import logoSelles from "./assets/logo-selles.png";

const GRUPOS = [
  {
    label: "Cadastros base",
    itens: [
      { to: "/cidades", icon: "ti-map-pin", label: "Cidades" },
      { to: "/bairros", icon: "ti-map-2", label: "Bairros" },
      { to: "/prefeituras", icon: "ti-building-bank", label: "Prefeituras" },
      { to: "/atividades", icon: "ti-list-check", label: "Atividades" },
    ],
  },
  {
    label: "Comercial",
    itens: [
      { to: "/contratos", icon: "ti-file-text", label: "Contratos" },
      { to: "/materiais", icon: "ti-package", label: "Materiais" },
      { to: "/mao-obra", icon: "ti-user-cog", label: "Mão de obra" },
    ],
  },
  {
    label: "Operação",
    itens: [
      { to: "/veiculos", icon: "ti-truck", label: "Veículos" },
      { to: "/funcionarios", icon: "ti-users", label: "Funcionários" },
      { to: "/ordens-servico", icon: "ti-clipboard-list", label: "Ordens de serviço" },
    ],
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

  // Fecha a gaveta do menu (mobile/tablet) sempre que a rota muda.
  useEffect(() => {
    setMenuAberto(false);
  }, [location.pathname]);

  function sair() {
    logout();
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

      <aside className={"sidebar" + (menuAberto ? " aberta" : "")}>
        <div className="sidebar-logo">
          <img src={logoSelles} alt="Selles" />
          <span>Manutip</span>
        </div>

        {GRUPOS.map((grupo) => (
          <div className="sidebar-group" key={grupo.label}>
            <div className="sidebar-group-label">{grupo.label}</div>
            {grupo.itens.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
              >
                <i className={`ti ${item.icon}`} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{iniciais}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{perfil?.nome}</div>
              <div className="sidebar-user-role">{perfil?.papel}</div>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <SeletorTema />
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: "100%", marginTop: 6, color: "var(--text-inverse-muted)" }}
            onClick={sair}
          >
            <i className="ti ti-logout" aria-hidden="true" style={{ marginRight: 6 }} />
            Sair
          </button>
        </div>
      </aside>

      <div className="main-area">
        <Outlet />
      </div>
    </div>
  );
}
