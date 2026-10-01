import CadastroPage from "../CadastroPage";
import { apiMateriais } from "../api";

export default function Materiais() {
  return (
    <CadastroPage
      titulo="Materiais"
      modulo="materiais"
      api={apiMateriais}
      colunas={[
        { key: "codigo", label: "Código" },
        { key: "nome", label: "Nome" },
        { key: "unidade", label: "Unidade" },
        { key: "custo_unitario", label: "Custo unitário (R$)" },
      ]}
      campos={[
        { name: "codigo", label: "Código", required: true },
        { name: "nome", label: "Nome", required: true },
        { name: "unidade", label: "Unidade (UN, M, KG...)", required: true },
        { name: "custo_unitario", label: "Custo unitário (R$)", type: "number", step: "0.01", required: true },
      ]}
    />
  );
}
