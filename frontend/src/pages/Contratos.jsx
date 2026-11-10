import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAcesso } from "../AcessoContext";
import CadastroPage from "../CadastroPage";
import { apiContratos, apiPrefeituras } from "../api";
import { formatarData } from "../formatos";

const TIPOS_CONTRATO = [
  { value: "POR_ITEM", label: "Por item" },
  { value: "POR_PONTO", label: "Por ponto" },
];

export default function Contratos() {
  const navigate = useNavigate();
  // Pontos de materiais: só Superadmin e Administrador.
  // Contrato Por ponto: só o Superadmin (a tabela não entra no cálculo).
  const { ehAdmin, ehSuperadmin } = useAcesso();
  const podeVerPontos = (contrato) => (contrato.tipo_contrato === "POR_PONTO" ? ehSuperadmin : ehAdmin);
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
        { name: "numero_contrato", label: "Número do contrato", size: 3, unico: true, rotuloUnico: "um contrato" },
        { name: "tipo_contrato", label: "Tipo de contrato", type: "select", required: true, size: 3, options: TIPOS_CONTRATO },
        { name: "data_inicio", label: "Data de início", type: "date", required: true, size: 2 },
        { name: "data_fim", label: "Data de fim", type: "date", size: 2 },
        { name: "observacoes", label: "Observações", type: "textarea", rows: 4, fullWidth: true },
      ]}
      larguraModal={900}
      valoresPadrao={{ tipo_contrato: "POR_ITEM" }}
      acoesExtras={(item) => podeVerPontos(item) && (
        // Também no Por ponto (que não usa a tabela no cálculo), pra ver/remover pontos que ficaram cadastrados.
        <button
          className="btn btn-ghost"
          onClick={() => navigate(`/contratos/${item.id}/pontos`)}
          title={
            item.tipo_contrato === "POR_PONTO"
              ? "Pontos de materiais (contrato Por ponto: não entram no cálculo)"
              : "Pontos de materiais deste contrato"
          }
        >
          <i className="ti ti-list-numbers" aria-hidden="true" />
        </button>
      )}
    />
  );
}
