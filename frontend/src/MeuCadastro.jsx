import { useState } from "react";
import { salvarMeuCadastro } from "./api";
import { useAcesso } from "./AcessoContext";

/** Modal em que o próprio usuário edita nome, e-mail e troca a senha.
 * Login, perfil e CPF só aparecem — quem muda é a administração. */
export default function MeuCadastro({ onFechar }) {
  const { perfil, recarregar } = useAcesso();
  const [d, setD] = useState({
    nome: perfil?.nome || "",
    email: perfil?.email || "",
    senha_atual: "",
    senha: "",
    repetir: "",
  });
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const campo = (k) => (e) => setD((v) => ({ ...v, [k]: e.target.value }));
  const trocaSenha = !!d.senha;
  const tipoSenha = mostrar ? "text" : "password";

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    if (trocaSenha && !d.senha_atual) return setErro("Informe a senha atual para trocar a senha.");
    if (trocaSenha && d.senha !== d.repetir) return setErro("A confirmação da nova senha não confere.");
    const corpo = { nome: d.nome, email: d.email };
    if (trocaSenha) Object.assign(corpo, { senha: d.senha, senha_atual: d.senha_atual });
    setSalvando(true);
    try {
      await salvarMeuCadastro(corpo);
      await recarregar();
      onFechar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 520 }}>
        <h2>Meu cadastro</h2>
        <form onSubmit={salvar}>
          <div className="form-grid">
            <div className="form-field" style={{ "--span": 12 }}>
              <label htmlFor="mc-nome">Nome</label>
              <input id="mc-nome" required value={d.nome} onChange={campo("nome")} />
            </div>
            <div className="form-field" style={{ "--span": 12 }}>
              <label htmlFor="mc-email">E-mail</label>
              <input id="mc-email" type="email" value={d.email} onChange={campo("email")} />
            </div>
            <div className="form-field" style={{ "--span": 6 }}>
              <label htmlFor="mc-login">Usuário (login)</label>
              <input id="mc-login" disabled value={perfil?.username || ""} />
            </div>
            <div className="form-field" style={{ "--span": 6 }}>
              <label htmlFor="mc-perfil">Perfil de acesso</label>
              <input id="mc-perfil" disabled value={perfil?.perfil_nome || perfil?.perfil || ""} />
            </div>
          </div>

          <h3 style={{ fontSize: 14, margin: "8px 0 12px" }}>Trocar a senha</h3>
          <div className="form-grid">
            <div className="form-field" style={{ "--span": 12 }}>
              <label htmlFor="mc-atual">Senha atual</label>
              <input
                id="mc-atual"
                type={tipoSenha}
                autoComplete="current-password"
                value={d.senha_atual}
                onChange={campo("senha_atual")}
              />
            </div>
            <div className="form-field" style={{ "--span": 6 }}>
              <label htmlFor="mc-nova">Nova senha</label>
              <input
                id="mc-nova"
                type={tipoSenha}
                autoComplete="new-password"
                minLength={8}
                value={d.senha}
                onChange={campo("senha")}
              />
            </div>
            <div className="form-field" style={{ "--span": 6 }}>
              <label htmlFor="mc-repetir">Repetir a nova senha</label>
              <input
                id="mc-repetir"
                type={tipoSenha}
                autoComplete="new-password"
                value={d.repetir}
                onChange={campo("repetir")}
              />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)" }}>
            <input id="mc-mostrar" type="checkbox" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
            Mostrar as senhas
          </label>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 0" }}>
            Deixe em branco para manter a senha atual. A nova senha precisa ter pelo menos 8 caracteres, com letras
            e números.
          </p>

          {erro && <p className="erro-msg">{erro}</p>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onFechar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
