import CadastroPage from "../CadastroPage";
import { apiMateriais, proximoCodigoMaterial } from "../api";

const CATEGORIAS = [
  { value: "GERAL", label: "Geral" },
  { value: "LAMPADA", label: "Lâmpada" },
  { value: "RELE", label: "Relê" },
  { value: "BASE", label: "Base" },
  { value: "PERFURANTE", label: "Perfurante" },
  { value: "CONECTOR", label: "Conector" },
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
        {
          key: "custo_unitario",
          label: "Custo unitário (R$)",
          render: (item) => (
            <span style={{ display: "block", textAlign: "center", fontSize: 12 }}>{item.custo_unitario}</span>
          ),
        },
      ]}
      campos={[
        { name: "codigo", label: "Código", required: true, size: 3 },
        { name: "nome", label: "Nome", required: true, size: 6 },
        { name: "unidade", label: "Unidade (UN, M, KG...)", required: true, size: 3 },
        { name: "categoria", label: "Categoria", type: "select", size: 3, options: CATEGORIAS },
        { name: "custo_unitario", label: "Custo unitário (R$)", mask: "moeda", center: true, required: true, size: 3 },
      ]}
      valoresPadrao={{ categoria: "GERAL", custo_unitario: 0 }}
      obterValoresPadrao={() => proximoCodigoMaterial()}
      larguraModal={880}
      classeTabela="tabela-compacta"
    />
  );
}
