import { useEffect, useState } from "react";
import CadastroPage from "../CadastroPage";
import { apiBairros, apiCidades, apiPrefeituras, apiReclamacoes } from "../api";
import { buscarEnderecoPorCep } from "../viacep";

const TIPOS_RECLAMACAO = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "TELEFONE", label: "Telefone" },
  { value: "EMAIL", label: "E-mail" },
  { value: "SITE", label: "Site" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "PROCESSO", label: "Processo" },
  { value: "PELA_EQUIPE", label: "Pela equipe" },
  { value: "OUTROS", label: "Outros" },
];

const STATUS_RECLAMACAO = [
  { value: "ABERTA", label: "Aberta" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "CONCLUIDA", label: "Concluída" },
];

export default function Reclamacoes() {
  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [prefeituras, setPrefeituras] = useState([]);
  const [prefeituraEscolhida, setPrefeituraEscolhida] = useState("");
  const [prefeituraConfirmada, setPrefeituraConfirmada] = useState(null);

  useEffect(() => {
    apiCidades.listar().then(setCidades);
    apiBairros.listar().then(setBairros);
    apiPrefeituras.listar().then(setPrefeituras);
  }, []);

  const nomeCidade = (id) => cidades.find((c) => c.id === id)?.nome || "—";
  const nomeBairro = (id) => bairros.find((b) => b.id === id)?.nome || "—";
  const siglaPrefeitura = (id) => prefeituras.find((p) => p.id === id)?.sigla || "—";
  const labelStatus = (v) => STATUS_RECLAMACAO.find((s) => s.value === v)?.label || v;

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

  if (!prefeituraConfirmada) {
    return (
      <>
        <header className="topbar">
          <h1>Reclamações</h1>
        </header>
        <div className="content">
          <div className="card" style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0 }}>De qual prefeitura é essa reclamação?</h3>
            <div className="form-field">
              <label>Prefeitura</label>
              <select value={prefeituraEscolhida} onChange={(e) => setPrefeituraEscolhida(e.target.value)}>
                <option value="">Selecione...</option>
                {prefeituras.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 10 }}
              disabled={!prefeituraEscolhida}
              onClick={() => setPrefeituraConfirmada(prefeituraEscolhida)}
            >
              Continuar
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <CadastroPage
      key={prefeituraConfirmada}
      titulo="Reclamações"
      modulo="reclamacoes"
      api={apiReclamacoes}
      valoresPadrao={{ status: "ABERTA", nome_reclamante: "SELLES", prefeitura_id: prefeituraConfirmada }}
      colunas={[
        { key: "data_reclamacao", label: "Data" },
        { key: "nome_reclamante", label: "Reclamante" },
        { key: "prefeitura_id", label: "Sigla", render: (item) => siglaPrefeitura(item.prefeitura_id) },
        { key: "logradouro", label: "Logradouro", render: (item) => item.logradouro || "—" },
        { key: "numero", label: "Número", render: (item) => item.numero || "—" },
        { key: "bairro_id", label: "Bairro", render: (item) => nomeBairro(item.bairro_id) },
        { key: "cidade_id", label: "Cidade", render: (item) => nomeCidade(item.cidade_id) },
        {
          key: "status",
          label: "Status",
          render: (item) => (
            <span className={`badge ${item.status === "CONCLUIDA" ? "badge-success" : "badge-muted"}`}>
              {labelStatus(item.status)}
            </span>
          ),
        },
      ]}
      campos={[
        { name: "nome_reclamante", label: "Nome do reclamante", required: true, size: 8 },
        { name: "telefone", label: "Telefone", mask: "telefone", center: true },
        {
          name: "tipo_reclamacao",
          label: "Canal (como chegou)",
          type: "select",
          required: true,
          size: 4,
          options: TIPOS_RECLAMACAO,
        },
        { name: "data_reclamacao", label: "Data", type: "date", required: true, size: 4, center: true },
        {
          name: "status",
          label: "Status",
          type: "select",
          size: 4,
          options: STATUS_RECLAMACAO,
        },
        {
          name: "prefeitura_id",
          label: "Prefeitura",
          size: 7,
          disabled: true,
          valorCalculado: (valores) => prefeituras.find((p) => p.id === valores.prefeitura_id)?.nome || "",
        },
        {
          name: "sigla_prefeitura",
          label: "Sigla",
          size: 2,
          disabled: true,
          center: true,
          valorCalculado: (valores) => siglaPrefeitura(valores.prefeitura_id),
        },
        { name: "cep", label: "CEP", mask: "cep", center: true, onBlur: aoSairDoCep },
        { name: "logradouro", label: "Logradouro", size: 7 },
        { name: "numero", label: "Número", size: 2, center: true },
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
        { name: "ponto_referencia", label: "Ponto de referência", type: "textarea", rows: 2, fullWidth: true },
        { name: "observacoes", label: "Observações", type: "textarea", rows: 3, fullWidth: true },
      ]}
      filtroTopo={
        <button
          type="button"
          className="btn"
          onClick={() => {
            setPrefeituraConfirmada(null);
            setPrefeituraEscolhida("");
          }}
        >
          <i className="ti ti-replace" aria-hidden="true" style={{ marginRight: 6 }} />
          Trocar prefeitura
        </button>
      }
    />
  );
}
