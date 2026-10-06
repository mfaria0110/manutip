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
      ]}
      valoresPadrao={{ custo_unitario: 0 }}
      obterValoresPadrao={() => proximoCodigoMaterial()}
      larguraModal={880}
      classeTabela="tabela-compacta"
      notaModal="Depois de salvar, acesse Contratos > Pontos de materiais (em cada contrato) para cadastrar os pontos deste material — sem isso, o lançamento de execução com ele fica bloqueado."
    />
  );
}
