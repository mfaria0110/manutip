import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CadastroPage from "../CadastroPage";
import { apiContratos, apiPrefeituras } from "../api";
import { formatarData } from "../formatos";

const TIPOS_CONTRATO = [
  { value: "POR_ITEM", label: "Por item" },
  { value: "POR_PONTO", label: "Por ponto" },
];

export default function Contratos() {
  const navigate = useNavigate();
  const [prefeituras, setPrefeituras] = useState([]);

  useEffect(() => {
    apiPrefeituras.listar().then(setPrefeituras);
  }, []);

  const nomePrefeitura = (id) => prefeituras.find((p) => p.id === id)?.nome || "—";

  return (
    <CadastroPage
      titulo="Contratos"
      modulo="contratos"
      api={apiContratos}
      colunas={[
        { key: "prefeitura_id", label: "Prefeitura", render: (item) => nomePrefeitura(item.prefeitura_id) },
        { key: "numero_contrato", label: "Número" },
        {
          key: "tipo_contrato",
          label: "Tipo",
          render: (item) => TIPOS_CONTRATO.find((t) => t.value === item.tipo_contrato)?.label || "—",
        },
        { key: "data_inicio", label: "Início", render: (item) => formatarData(item.data_inicio) },
        { key: "data_fim", label: "Fim", render: (item) => formatarData(item.data_fim) || "—" },
        {
          key: "ativo",
          label: "Status",
          render: (item) => (
            <span className={`badge ${item.ativo ? "badge-success" : "badge-muted"}`}>
              {item.ativo ? "Ativo" : "Encerrado"}
            </span>
          ),
        },
      ]}
      campos={[
        {
          name: "prefeitura_id",
          label: "Prefeitura",
          type: "select",
          required: true,
          size: 5,
          options: prefeituras.map((p) => ({ value: p.id, label: p.nome })),
        },
        { name: "numero_contrato", label: "Número do contrato", size: 3 },
        { name: "tipo_contrato", label: "Tipo de contrato", type: "select", required: true, size: 3, options: TIPOS_CONTRATO },
        { name: "data_inicio", label: "Data de início", type: "date", required: true, size: 2 },
        { name: "data_fim", label: "Data de fim", type: "date", size: 2 },
        { name: "observacoes", label: "Observações", type: "textarea", rows: 4, fullWidth: true },
      ]}
      larguraModal={900}
      valoresPadrao={{ tipo_contrato: "POR_ITEM" }}
      acoesExtras={(item) =>
        // Contrato por ponto vale 1 ponto por atendimento: não tem tabela de pontos por material.
        item.tipo_contrato === "POR_PONTO" ? null : (
          <button
            className="btn btn-ghost"
            onClick={() => navigate(`/contratos/${item.id}/pontos`)}
            title="Pontos de materiais deste contrato"
          >
            <i className="ti ti-list-numbers" aria-hidden="true" />
          </button>
        )
      }
    />
  );
}
