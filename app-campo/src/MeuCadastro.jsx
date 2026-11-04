import { useState } from "react";
import { salvarMeuCadastro } from "./api";
import { useAcesso } from "./AcessoContext";
import { useOffline } from "./offline/OfflineContext";


/** Mesmo "Meu cadastro" do site de escritório, adaptado ao celular: o
 * próprio usuário edita nome, e-mail e troca a senha. Exige internet. */
export default function MeuCadastro({ onFechar }) {
  const { perfil, recarregar } = useAcesso();
  const { online } = useOffline();
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
    if (!online) return setErro("Sem internet — conecte-se para salvar o seu cadastro.");
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
    <div className="modal-fundo" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal-folha">
        <div className="linha-entre">
          <div className="modal-titulo">Meu cadastro</div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            style={{ background: "none", border: "none", fontSize: 20, color: "var(--text-secondary)", marginBottom: 14 }}
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={salvar}>
          <div className="campo">
            <label htmlFor="mc-nome">Nome</label>
            <input id="mc-nome" required value={d.nome} onChange={campo("nome")} />
          </div>
          <div className="campo">
            <label htmlFor="mc-email">E-mail</label>
            <input id="mc-email" type="email" value={d.email} onChange={campo("email")} />
          </div>
          <div className="linha" style={{ alignItems: "flex-start" }}>
            <div className="campo" style={{ flex: 1, minWidth: 0 }}>
              <label htmlFor="mc-login">Usuário (login)</label>
              <input id="mc-login" disabled value={perfil?.username || ""} />
            </div>
            <div className="campo" style={{ flex: 1, minWidth: 0 }}>
              <label htmlFor="mc-perfil">Perfil</label>
              <input id="mc-perfil" disabled value={perfil?.perfil_nome || perfil?.perfil || ""} />
            </div>
          </div>

          <div className="cartao-titulo" style={{ margin: "6px 0 10px" }}>Trocar a senha</div>
          <div className="campo">
            <label htmlFor="mc-atual">Senha atual</label>
            <input
              id="mc-atual"
              type={tipoSenha}
              autoComplete="current-password"
              value={d.senha_atual}
              onChange={campo("senha_atual")}
            />
          </div>
          <div className="campo">
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
          <div className="campo">
            <label htmlFor="mc-repetir">Repetir a nova senha</label>
            <input
              id="mc-repetir"
              type={tipoSenha}
              autoComplete="new-password"
              value={d.repetir}
              onChange={campo("repetir")}
            />
          </div>
          <label
            htmlFor="mc-mostrar"
            style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, marginBottom: 6 }}
          >
            <input
              id="mc-mostrar"
              type="checkbox"
              style={{ width: "auto" }}
              checked={mostrar}
              onChange={(e) => setMostrar(e.target.checked)}
            />
            Mostrar as senhas
          </label>
          <p className="cartao-sub" style={{ marginBottom: 14 }}>
            Deixe em branco para manter a senha atual. A nova senha precisa ter pelo menos 8 caracteres, com letras
            e números.
          </p>

          {erro && <p className="erro-msg">{erro}</p>}
          <button type="submit" className="btn btn-primario" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </div>
    </div>
  );
}
