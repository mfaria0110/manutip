import CadastroPage from "../CadastroPage";
import { apiCategoriasMaterial } from "../api";

export default function CategoriasMaterial() {
  return (
    <CadastroPage
      titulo="Categorias de Material"
      modulo="categorias_material"
      api={apiCategoriasMaterial}
      colunas={[
        { key: "codigo", label: "Código" },
        { key: "nome", label: "Nome" },
        { key: "motivo", label: "Motivo", render: (item) => item.motivo || "—" },
      ]}
      campos={[
        { name: "codigo", label: "Código", required: true, size: 3, uppercase: true },
        { name: "nome", label: "Nome", required: true, size: 5 },
        // Motivo da ocorrência (ex.: Relê → "queimado"), usado no relatório Pontos atendidos Mod-02.
        { name: "motivo", label: "Motivo", size: 4, placeholder: "ex.: queimado, danificado" },
      ]}
    />
  );
}
