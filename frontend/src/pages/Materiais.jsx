import CadastroPage from "../CadastroPage";
import { apiMateriais } from "../api";

const CATEGORIAS = [
  { value: "GERAL", label: "Geral" },
  { value: "LAMPADA", label: "Lâmpada" },
];

const labelCategoria = (v) => CATEGORIAS.find((c) => c.value === v)?.label || v;

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
        { key: "categoria", label: "Categoria", render: (item) => labelCategoria(item.categoria) },
        { key: "custo_unitario", label: "Custo unitário (R$)" },
      ]}
      campos={[
        { name: "codigo", label: "Código", required: true, size: 3 },
        { name: "nome", label: "Nome", required: true, size: 5 },
        { name: "unidade", label: "Unidade (UN, M, KG...)", required: true, size: 2 },
        { name: "categoria", label: "Categoria", type: "select", size: 2, options: CATEGORIAS },
        { name: "custo_unitario", label: "Custo unitário (R$)", type: "number", step: "0.01", required: true, size: 3 },
      ]}
      valoresPadrao={{ categoria: "GERAL" }}
    />
  );
}
