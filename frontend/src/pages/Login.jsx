import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";
import { useAcesso } from "../AcessoContext";
import logoSelles from "../assets/logo-selles.png";
import loginBg from "../assets/login-bg.jpg";

export default function Login() {
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const navigate = useNavigate();
  const { recarregar } = useAcesso();

  async function onSubmit(e) {
    e.preventDefault();
    setErro("");
    setEntrando(true);
    try {
      await login(username, senha);
      await recarregar();
      navigate("/");
    } catch (err) {
      setErro(err.message);
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg" style={{ backgroundImage: `url(${loginBg})` }} />
      <div className="login-overlay" />
      <div className="login-card">
        <img src={logoSelles} alt="Selles" className="login-logo" />
        <h1 className="login-titulo">Manutip</h1>
        <p className="login-subtitulo">Gestão de manutenção e obras de iluminação pública</p>

        <form onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="login-usuario">Usuário</label>
            <input
              id="login-usuario"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="login-senha">Senha</label>
            <input
              id="login-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          {erro && <p className="erro-msg">{erro}</p>}
          <button type="submit" className="btn btn-primary login-botao" disabled={entrando}>
            {entrando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
