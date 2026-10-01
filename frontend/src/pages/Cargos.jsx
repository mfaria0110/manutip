import CadastroPage from "../CadastroPage";
import { apiCargos } from "../api";

export default function Cargos() {
  return (
    <CadastroPage
      titulo="Cargos"
      modulo="cargos"
      api={apiCargos}
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
