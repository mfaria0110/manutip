import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";
import { useAcesso } from "../AcessoContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const { recarregar } = useAcesso();
  const navigate = useNavigate();

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      await login(username.trim(), senha);
      await recarregar();
      navigate("/equipe", { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="tela">
      <div className="conteudo" style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Manutip Campo</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Login exige internet — conecte-se antes de entrar</div>
        </div>
        <form onSubmit={entrar}>
          <div className="campo">
            <label>Usuário</label>
            <input autoFocus autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="campo">
            <label>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </div>
          {erro && <p className="erro-msg">{erro}</p>}
          <button type="submit" className="btn btn-primario" disabled={entrando}>
            {entrando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
