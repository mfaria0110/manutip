import { useNavigate } from "react-router-dom";
import { logout } from "./api";
import { useAcesso } from "./AcessoContext";
import { useFluxo } from "./FluxoContext";

export default function Topo({ titulo, subtitulo, voltar, acao }) {
  const navigate = useNavigate();
  const { recarregar } = useAcesso();
  const { limpar } = useFluxo();

  async function sair() {
    await logout();
    limpar();
    await recarregar();
    navigate("/login", { replace: true });
  }

  return (
    <div className="topo">
      <div className="linha">
        {voltar && (
          <button
            type="button"
            onClick={voltar}
            style={{ background: "none", border: "none", color: "#fff", padding: 0, marginRight: 4 }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
        )}
        <div>
          <div className="topo-titulo">{titulo}</div>
          {subtitulo && <div className="topo-sub">{subtitulo}</div>}
        </div>
      </div>
      <div className="linha" style={{ gap: 14 }}>
        {acao}
        <button
          type="button"
          onClick={sair}
          title="Sair"
          style={{ background: "none", border: "none", color: "#fff", padding: 0 }}
        >
          <i className="ti ti-logout" style={{ fontSize: 20 }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
