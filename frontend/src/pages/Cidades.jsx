import CadastroPage from "../CadastroPage";
import { apiCidades } from "../api";

export default function Cidades() {
  return (
    <CadastroPage
      titulo="Cidades"
      modulo="cidades"
      api={apiCidades}
      colunas={[
        { key: "nome", label: "Nome" },
        { key: "uf", label: "UF" },
      ]}
      campos={[
        { name: "nome", label: "Nome", required: true, size: 8 },
        { name: "uf", label: "UF", required: true, mask: "uf" },
      ]}
    />
  );
}
