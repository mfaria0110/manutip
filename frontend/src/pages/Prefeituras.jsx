import { useEffect, useState } from "react";
import CadastroPage from "../CadastroPage";
import { apiBairros, apiCidades, apiPrefeituras } from "../api";

export default function Prefeituras() {
  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);

  useEffect(() => {
    apiCidades.listar().then(setCidades);
    apiBairros.listar().then(setBairros);
  }, []);

  const nomeCidade = (id) => cidades.find((c) => c.id === id)?.nome || "—";

  return (
    <CadastroPage
      titulo="Prefeituras"
      modulo="prefeituras"
      api={apiPrefeituras}
      colunas={[
        { key: "nome", label: "Nome" },
        { key: "cnpj", label: "CNPJ" },
        { key: "cidade_id", label: "Cidade", render: (item) => nomeCidade(item.cidade_id) },
        {
          key: "ativo",
          label: "Status",
          render: (item) => (
            <span className={`badge ${item.ativo ? "badge-success" : "badge-muted"}`}>
              {item.ativo ? "Ativa" : "Inativa"}
            </span>
          ),
        },
      ]}
      campos={[
        { name: "nome", label: "Nome", required: true },
        { name: "cnpj", label: "CNPJ" },
        { name: "logradouro", label: "Logradouro" },
        { name: "numero", label: "Número" },
        { name: "cep", label: "CEP" },
        {
          name: "cidade_id",
          label: "Cidade",
          type: "select",
          options: cidades.map((c) => ({ value: c.id, label: `${c.nome} - ${c.uf}` })),
        },
        {
          name: "bairro_id",
          label: "Bairro",
          type: "select",
          options: (valores) =>
            bairros
              .filter((b) => !valores.cidade_id || b.cidade_id === valores.cidade_id)
              .map((b) => ({ value: b.id, label: b.nome })),
        },
        { name: "telefone", label: "Telefone" },
      ]}
    />
  );
}
