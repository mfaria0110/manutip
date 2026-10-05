import CadastroPage from "../CadastroPage";
import { apiCategoriasMaterial } from "../api";

export default function CategoriasMaterial() {
  return (
    <CadastroPage
      titulo="Categorias de Material"
      modulo="materiais"
      api={apiCategoriasMaterial}
      colunas={[
        { key: "codigo", label: "Código" },
        { key: "nome", label: "Nome" },
      ]}
      campos={[
        { name: "codigo", label: "Código", required: true, size: 4, uppercase: true },
        { name: "nome", label: "Nome", required: true, size: 8 },
      ]}
    />
  );
}
