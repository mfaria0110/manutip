import { useEffect, useState } from "react";
import CadastroPage from "../CadastroPage";
import { apiCategoriasMaterial, apiMateriais, proximoCodigoMaterial } from "../api";

export default function Materiais() {
  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    apiCategoriasMaterial
      .listar()
      .then((lista) => setCategorias(lista.map((c) => ({ value: c.codigo, label: c.nome }))))
      .catch(() => {});
  }, []);

  const labelCategoria = (v) => categorias.find((c) => c.value === v)?.label || v;

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
        {
          key: "qde_pontos_inst",
          label: "Pts Inst.",
          render: (item) => <span style={{ display: "block", textAlign: "center", fontSize: 12 }}>{item.qde_pontos_inst}</span>,
        },
        {
          key: "qde_pontos_ret",
          label: "Pts Ret.",
          render: (item) => <span style={{ display: "block", textAlign: "center", fontSize: 12 }}>{item.qde_pontos_ret}</span>,
        },
        {
          key: "qde_pontos_subst",
          label: "Pts Subst.",
          render: (item) => <span style={{ display: "block", textAlign: "center", fontSize: 12 }}>{item.qde_pontos_subst}</span>,
        },
      ]}
      campos={[
        { name: "codigo", label: "Código", required: true, size: 3 },
        { name: "nome", label: "Nome", required: true, size: 6 },
        { name: "unidade", label: "Unidade (UN, M, KG...)", required: true, size: 3 },
        {
          name: "categoria",
          label: "Categoria",
          type: "select",
          required: true,
          size: 3,
          options: categorias,
        },
        { name: "custo_unitario", label: "Custo unitário (R$)", mask: "moeda", center: true, required: true, size: 3 },
        { name: "qde_pontos_inst", label: "Pts Instalação", type: "number", step: "0.01", center: true, size: 2 },
        { name: "qde_pontos_ret", label: "Pts Retirada", type: "number", step: "0.01", center: true, size: 2 },
        { name: "qde_pontos_subst", label: "Pts Substituição", type: "number", step: "0.01", center: true, size: 2 },
      ]}
      valoresPadrao={{ custo_unitario: 0, qde_pontos_inst: 0, qde_pontos_ret: 0, qde_pontos_subst: 0 }}
      obterValoresPadrao={() => proximoCodigoMaterial()}
      larguraModal={880}
      classeTabela="tabela-compacta"
    />
  );
}
