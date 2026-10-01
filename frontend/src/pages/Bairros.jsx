import { useEffect, useState } from "react";
import CadastroPage from "../CadastroPage";
import { apiBairros, apiCidades } from "../api";

export default function Bairros() {
  const [cidades, setCidades] = useState([]);
  const [cidadeFiltro, setCidadeFiltro] = useState("");

  useEffect(() => {
    apiCidades.listar().then(setCidades);
  }, []);

  const nomeCidade = (id) => cidades.find((c) => c.id === id)?.nome || "—";

  return (
    <CadastroPage
      titulo="Bairros"
      modulo="bairros"
      api={apiBairros}
      exigeFiltro
      queryExtra={cidadeFiltro ? `?cidade_id=${cidadeFiltro}` : ""}
      valoresPadrao={cidadeFiltro ? { cidade_id: cidadeFiltro } : undefined}
      filtroTopo={
        <div className="filtro-wrap" style={{ maxWidth: 260 }}>
          <i className="ti ti-map-pin" aria-hidden="true" />
          <select value={cidadeFiltro} onChange={(e) => setCidadeFiltro(e.target.value)}>
            <option value="">Selecione o município...</option>
            {cidades.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} - {c.uf}
              </option>
            ))}
          </select>
        </div>
      }
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
