import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CadastroPage from "../CadastroPage";
import { apiContratos, apiPrefeituras } from "../api";

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
        { key: "data_inicio", label: "Início" },
        { key: "data_fim", label: "Fim" },
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
          options: prefeituras.map((p) => ({ value: p.id, label: p.nome })),
        },
        { name: "numero_contrato", label: "Número do contrato" },
        { name: "data_inicio", label: "Data de início", type: "date", required: true },
        { name: "data_fim", label: "Data de fim", type: "date" },
        { name: "observacoes", label: "Observações" },
      ]}
      acoesExtras={(item) => (
        <button
          className="btn btn-ghost"
          onClick={() => navigate(`/contratos/${item.id}/pontos`)}
          title="Pontos de materiais deste contrato"
        >
          <i className="ti ti-list-numbers" aria-hidden="true" />
        </button>
      )}
    />
  );
}
