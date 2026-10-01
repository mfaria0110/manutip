import { useEffect, useState } from "react";
import CadastroPage from "../CadastroPage";
import { apiBairros, apiCidades } from "../api";

export default function Bairros() {
  const [cidades, setCidades] = useState([]);

  useEffect(() => {
    apiCidades.listar().then(setCidades);
  }, []);

  const nomeCidade = (id) => cidades.find((c) => c.id === id)?.nome || "—";

  return (
    <CadastroPage
      titulo="Bairros"
      modulo="bairros"
      api={apiBairros}
      colunas={[
        { key: "nome", label: "Nome" },
        { key: "cidade_id", label: "Cidade", render: (item) => nomeCidade(item.cidade_id) },
      ]}
      campos={[
        { name: "nome", label: "Nome", required: true },
        {
          name: "cidade_id",
          label: "Cidade",
          type: "select",
          required: true,
          options: cidades.map((c) => ({ value: c.id, label: `${c.nome} - ${c.uf}` })),
        },
      ]}
    />
  );
}
