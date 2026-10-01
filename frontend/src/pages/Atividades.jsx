import CadastroPage from "../CadastroPage";
import { apiAtividades } from "../api";

export default function Atividades() {
  return (
    <CadastroPage
      titulo="Atividades"
      modulo="atividades"
      api={apiAtividades}
      colunas={[
        { key: "nome", label: "Nome" },
        { key: "descricao", label: "Descrição" },
      ]}
      campos={[
        { name: "nome", label: "Nome", required: true },
        { name: "descricao", label: "Descrição", size: 8 },
      ]}
    />
  );
}
