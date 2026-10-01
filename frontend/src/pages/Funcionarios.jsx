import CadastroPage from "../CadastroPage";
import { apiFuncionarios } from "../api";

export default function Funcionarios() {
  return (
    <CadastroPage
      titulo="Funcionários"
      modulo="funcionarios"
      api={apiFuncionarios}
      colunas={[
        { key: "matricula", label: "Matrícula" },
        { key: "nome", label: "Nome" },
        { key: "funcao", label: "Função" },
        { key: "cpf", label: "CPF" },
      ]}
      campos={[
        { name: "nome", label: "Nome", required: true, fullWidth: true },
        { name: "matricula", label: "Matrícula", size: 2, center: true },
        { name: "funcao", label: "Função (técnico, encarregado, motorista...)", size: 6 },
        { name: "cpf", label: "CPF", mask: "cpf" },
      ]}
    />
  );
}
