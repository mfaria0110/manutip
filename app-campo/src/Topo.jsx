import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "./api";
import { useAcesso } from "./AcessoContext";
import { useFluxo } from "./FluxoContext";
import MeuCadastro from "./MeuCadastro";

export default function Topo({ titulo, subtitulo, voltar, acao }) {
  const navigate = useNavigate();
  const { perfil, recarregar } = useAcesso();
  const { limpar } = useFluxo();
  const [meuCadastro, setMeuCadastro] = useState(false);
  const primeiroNome = (perfil?.nome || "").trim().split(/\s+/)[0];
  // Operacional não edita o próprio cadastro (nem troca senha) — o backend
  // também recusa; aqui só não oferece a opção.
  const podeEditarCadastro = !!perfil && !perfil.operacional;

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
        {podeEditarCadastro ? (
          <button type="button" className="topo-usuario" onClick={() => setMeuCadastro(true)} title="Meu cadastro">
            <i className="ti ti-user-circle" style={{ fontSize: 20 }} aria-hidden="true" />
            {primeiroNome && <span>{primeiroNome}</span>}
          </button>
        ) : (
          <div className="topo-usuario" style={{ cursor: "default" }}>
            <i className="ti ti-user-circle" style={{ fontSize: 20 }} aria-hidden="true" />
            {primeiroNome && <span>{primeiroNome}</span>}
          </div>
        )}
        <button
          type="button"
          onClick={sair}
          title="Sair"
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <i className="ti ti-logout" style={{ fontSize: 20 }} aria-hidden="true" />
          Sair
        </button>
      </div>
      {meuCadastro && podeEditarCadastro && <MeuCadastro onFechar={() => setMeuCadastro(false)} />}
    </div>
  );
}
