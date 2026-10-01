import { useEffect, useState } from "react";
import CadastroPage from "../CadastroPage";
import { apiBairros, apiCidades, apiPrefeituras } from "../api";
import { buscarEnderecoPorCep } from "../viacep";

export default function Prefeituras() {
  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);

  function carregarListas() {
    apiCidades.listar().then(setCidades);
    apiBairros.listar().then(setBairros);
  }

  useEffect(carregarListas, []);

  const nomeCidade = (id) => cidades.find((c) => c.id === id)?.nome || "—";

  // Busca o CEP no ViaCEP e preenche logradouro/bairro/cidade sozinho —
  // cria a cidade/bairro no catálogo se ainda não existirem.
  async function aoSairDoCep(valor, atualizarCampos) {
    const digitos = (valor || "").replace(/\D/g, "");
    if (digitos.length !== 8) return;
    try {
      const end = await buscarEnderecoPorCep(valor);

      let cidade = cidades.find(
        (c) => c.nome.toLowerCase() === end.cidade.toLowerCase() && c.uf === end.uf
      );
      if (!cidade && end.cidade) {
        cidade = await apiCidades.criar({ nome: end.cidade, uf: end.uf });
        setCidades((prev) => [...prev, cidade]);
      }

      let bairro = null;
      if (cidade && end.bairro) {
        bairro = bairros.find(
          (b) => b.nome.toLowerCase() === end.bairro.toLowerCase() && b.cidade_id === cidade.id
        );
        if (!bairro) {
          bairro = await apiBairros.criar({ nome: end.bairro, cidade_id: cidade.id });
          setBairros((prev) => [...prev, bairro]);
        }
      }

      atualizarCampos({
        logradouro: end.logradouro || "",
        cidade_id: cidade?.id || "",
        bairro_id: bairro?.id || "",
      });
    } catch {
      // CEP inválido/não encontrado: deixa o usuário preencher manualmente.
    }
  }

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
        { name: "nome", label: "Nome", required: true, size: 8 },
        { name: "cnpj", label: "CNPJ", mask: "cnpj", size: 4 },
        { name: "cep", label: "CEP", mask: "cep", center: true, onBlur: aoSairDoCep },
        { name: "logradouro", label: "Logradouro", size: 7 },
        { name: "numero", label: "Número", size: 2, center: true },
        { name: "complemento", label: "Complemento", size: 6 },
        {
          name: "cidade_id",
          label: "Cidade",
          type: "select",
          size: 6,
          options: cidades.map((c) => ({ value: c.id, label: `${c.nome} - ${c.uf}` })),
        },
        {
          name: "bairro_id",
          label: "Bairro",
          type: "combo",
          size: 6,
          placeholder: "Digite para buscar ou criar...",
          options: (valores) =>
            bairros
              .filter((b) => !valores.cidade_id || b.cidade_id === valores.cidade_id)
              .map((b) => ({ value: b.id, label: b.nome })),
          onCriar: async (texto, valores) => {
            if (!valores.cidade_id) throw new Error("Selecione a cidade antes de criar o bairro.");
            const novo = await apiBairros.criar({ nome: texto, cidade_id: valores.cidade_id });
            setBairros((prev) => [...prev, novo]);
            return { value: novo.id, label: novo.nome };
          },
        },
        { name: "telefone", label: "Telefone", mask: "telefone", center: true },
        { name: "contato_nome", label: "Contato (nome)", size: 6 },
        { name: "contato_telefone", label: "Telefone do contato", mask: "telefone", center: true },
        { name: "observacoes", label: "Observações", type: "textarea", rows: 4 },
      ]}
    />
  );
}
