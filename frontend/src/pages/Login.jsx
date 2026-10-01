import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";
import { useAcesso } from "../AcessoContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const navigate = useNavigate();
  const { recarregar } = useAcesso();

  async function onSubmit(e) {
    e.preventDefault();
    setErro("");
    try {
      await login(email, senha);
      await recarregar();
      navigate("/");
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <h1>Manutip</h1>
      <form onSubmit={onSubmit}>
        <input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <button type="submit">Entrar</button>
      </form>
      {erro && <p style={{ color: "red" }}>{erro}</p>}
    </div>
  );
}
