import { useEffect, useState } from "react";
import CadastroPage from "../CadastroPage";
import { apiFuncionarios, apiUsuarios } from "../api";
import { useAcesso } from "../AcessoContext";

export default function Usuarios() {
  const { perfil } = useAcesso();
  const ehSuperadmin = perfil?.papel === "SUPERADMIN";
  const [funcionarios, setFuncionarios] = useState([]);

  useEffect(() => {
    apiFuncionarios.listar().then(setFuncionarios).catch(() => {});
  }, []);

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
        {
          name: "cpf",
          label: "Funcionário (busque por nome ou CPF)",
          type: "combo",
          size: 5,
          options: funcionarios
            .filter((f) => f.cpf)
            .map((f) => ({ value: f.cpf, label: `${f.nome} — ${f.cpf}` })),
          onCriar: () =>
            Promise.reject(
              new Error("Funcionário não encontrado no cadastro. Cadastre-o em Funcionários primeiro.")
            ),
          aoSelecionar: (cpf, formAtual) => ({
            ...formAtual,
            cpf,
            nome: funcionarios.find((f) => f.cpf === cpf)?.nome || formAtual.nome,
          }),
        },
        { name: "nome", label: "Nome", disabled: true, size: 4 },
        { name: "username", label: "Usuário (login)", required: true, size: 3 },
        { name: "senha", label: "Senha (deixe em branco para manter)", size: 5 },
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
