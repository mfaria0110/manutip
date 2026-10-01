import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";
import { useAcesso } from "../AcessoContext";
import logoSelles from "../assets/logo-selles.png";

export default function Login() {
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const navigate = useNavigate();
  const { recarregar } = useAcesso();

  async function onSubmit(e) {
    e.preventDefault();
    setErro("");
    try {
      await login(username, senha);
      await recarregar();
      navigate("/");
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center" }}>
      <img src={logoSelles} alt="Selles" style={{ width: "100%", maxWidth: 380, marginBottom: 16 }} />
      <h1>Manutip</h1>
      <form onSubmit={onSubmit} style={{ textAlign: "left" }}>
        <input placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input placeholder="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <button type="submit">Entrar</button>
      </form>
      {erro && <p style={{ color: "red" }}>{erro}</p>}
    </div>
  );
}
