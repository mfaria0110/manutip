import CadastroPage from "../CadastroPage";
import { apiUsuarios } from "../api";
import { useAcesso } from "../AcessoContext";

export default function Usuarios() {
  const { perfil } = useAcesso();
  const ehSuperadmin = perfil?.papel === "SUPERADMIN";

  return (
    <CadastroPage
      titulo="Usuários"
      modulo="usuarios"
      api={apiUsuarios}
      colunas={[
        { key: "nome", label: "Nome" },
        { key: "username", label: "Usuário" },
        { key: "papel", label: "Perfil" },
        {
          key: "ativo",
          label: "Status",
          render: (item) => (
            <span className={`badge ${item.ativo ? "badge-success" : "badge-muted"}`}>
              {item.ativo ? "Ativo" : "Inativo"}
            </span>
          ),
        },
      ]}
      campos={[
        { name: "nome", label: "Nome", required: true },
        { name: "username", label: "Usuário (login)", required: true },
        { name: "senha", label: "Senha (deixe em branco para manter)" },
        {
          name: "papel",
          label: "Perfil",
          type: "select",
          required: true,
          options: [
            ...(ehSuperadmin ? [{ value: "SUPERADMIN", label: "Superadmin (acima do admin)" }] : []),
            { value: "ADMIN", label: "Admin (acesso total)" },
            { value: "USUARIO", label: "Usuário (acesso operacional)" },
            { value: "OPERACIONAL", label: "Operacional (app de campo)" },
          ],
        },
        { name: "ativo", label: "Ativo", type: "checkbox" },
      ]}
    />
  );
}
