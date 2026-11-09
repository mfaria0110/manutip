import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CadastroPage from "../CadastroPage";
import { apiBairros, apiCidades, apiPrefeituras, apiReclamacoes } from "../api";
import ModalDesignarEquipe from "../ModalDesignarEquipe";
import { formatarData } from "../formatos";
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
  { value: "VALIDADA", label: "Validada" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "CONCLUIDA", label: "Concluída" },
];

// Validada, Já atendida e Concluída só aparecem na lista até este nº de dias.
const DIAS_FINALIZADAS = 45;

export default function Reclamacoes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [concluindoId, setConcluindoId] = useState(null);
  const [designando, setDesignando] = useState(false);
  // Muda ao salvar designações, remontando a lista pra recarregar a coluna "Designado".
  const [versaoLista, setVersaoLista] = useState(0);
  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [prefeituras, setPrefeituras] = useState([]);
  const [prefeituraEscolhida, setPrefeituraEscolhida] = useState("");
  const [abertasPorPrefeitura, setAbertasPorPrefeitura] = useState(null);
  // Guardada na URL (não em estado solto) pra sobreviver a navegar pra
  // execução/ocorrência e voltar — o botão Voltar dessas telas devolve pra
  // cá com o mesmo ?prefeitura_id=, sem precisar escolher de novo.
  const prefeituraConfirmada = searchParams.get("prefeitura_id");

  useEffect(() => {
    apiCidades.listar().then(setCidades);
    apiBairros.listar().then(setBairros);
    apiPrefeituras.listar().then(setPrefeituras);
  }, []);

  // Contagem de abertas por prefeitura: recarrega sempre que volta pra tela de escolha.
  useEffect(() => {
    if (prefeituraConfirmada) return;
    apiReclamacoes
      .abertasPorPrefeitura()
      .then(setAbertasPorPrefeitura)
      .catch(() => setAbertasPorPrefeitura({}));
  }, [prefeituraConfirmada]);

  const nomeCidade = (id) => cidades.find((c) => c.id === id)?.nome || "—";
  const nomeBairro = (id) => bairros.find((b) => b.id === id)?.nome || "—";
  const siglaPrefeitura = (id) => prefeituras.find((p) => p.id === id)?.sigla || "—";
  const labelStatus = (v) => STATUS_RECLAMACAO.find((s) => s.value === v)?.label || v;

  async function marcarConcluida(item) {
    setConcluindoId(item.id);
    try {
      await apiReclamacoes.atualizar(item.id, { status: "CONCLUIDA" });
      window.location.reload();
    } catch (e) {
      alert(e.message);
      setConcluindoId(null);
    }
  }

  async function aoSairDoCep(valor, atualizarCampos) {
    const digitos = (valor || "").replace(/\D/g, "");
    if (digitos.length !== 8) return;
    try {
      const end = await buscarEnderecoPorCep(valor);

      // A cidade vem da prefeitura (já preenchida no formulário), não do CEP:
      // o CEP só completa logradouro e bairro, e o bairro é buscado/criado
      // dentro da cidade da prefeitura.
      const cidadeId = prefeituras.find((p) => p.id === prefeituraConfirmada)?.cidade_id;

      let bairro = null;
      if (cidadeId && end.bairro) {
        bairro = bairros.find((b) => b.nome.toLowerCase() === end.bairro.toLowerCase() && b.cidade_id === cidadeId);
        if (!bairro) {
          bairro = await apiBairros.criar({ nome: end.bairro, cidade_id: cidadeId });
          setBairros((prev) => [...prev, bairro]);
        }
      }

      atualizarCampos({
        logradouro: end.logradouro || "",
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
              onClick={() => setSearchParams({ prefeitura_id: prefeituraEscolhida })}
            >
              Continuar
            </button>
          </div>
          <h3 className="titulo-cards-prefeituras">Reclamações abertas por prefeitura</h3>
          {/* Um card por prefeitura cadastrada, com a quantidade de reclamações abertas; clicar entra na lista dela. */}
          <div className="cards-prefeituras">
            {prefeituras.map((p) => {
              const abertas = abertasPorPrefeitura ? abertasPorPrefeitura[p.id] || 0 : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={"card-prefeitura" + (p.ativo === false ? " inativa" : "")}
                  onClick={() => setSearchParams({ prefeitura_id: p.id })}
                  title={`Abrir as reclamações de ${p.nome}`}
                >
                  <div className="card-prefeitura-topo">
                    <i className="ti ti-building-bank" aria-hidden="true" />
                    <div className="card-prefeitura-nome">{p.nome}</div>
                    {p.sigla && <span className="card-prefeitura-sigla">{p.sigla}</span>}
                  </div>
                  <div className={"card-prefeitura-abertas" + (abertas ? " tem" : "")}>
                    <strong>{abertas ?? "…"}</strong>
                    <span>{abertas === 1 ? "reclamação aberta" : "reclamações abertas"}</span>
                  </div>
                </button>
              );
            })}
            {abertasPorPrefeitura && prefeituras.length === 0 && (
              <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                Nenhuma prefeitura cadastrada.
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <CadastroPage
      key={`${prefeituraConfirmada}-${versaoLista}`}
      titulo="Reclamações"
      modulo="reclamacoes"
      api={apiReclamacoes}
      valoresPadrao={{
        status: "ABERTA",
        nome_reclamante: "SELLES",
        prefeitura_id: prefeituraConfirmada,
        cidade_id: prefeituras.find((p) => p.id === prefeituraConfirmada)?.cidade_id || "",
      }}
      // Abertas sempre; Validada / Já atendida / Concluída só dos últimos 45 dias.
      queryExtra={`?prefeitura_id=${prefeituraConfirmada}&dias_finalizadas=${DIAS_FINALIZADAS}`}
      // Mais largo para caberem Telefone, Canal, Data, Urgente e Pedido de na mesma linha.
      larguraModal={900}
      classeTabela="tabela-compacta cabecalho-35"
      exigirSenhaParaExcluir
      mensagemExclusao={(item) =>
        `Excluir a reclamação ${item.codigo}? Serão apagadas também as execuções, os materiais lançados, ` +
        "as fotos e a localização (latitude e longitude). Essa ação não pode ser desfeita."
      }
      acoesExtras={(item) => (
        <>
          <button
            className="btn btn-ghost"
            onClick={() => navigate(`/reclamacoes/${item.id}/execucao?prefeitura_id=${prefeituraConfirmada}`)}
            title="Registrar execução"
          >
            <i className="ti ti-tool" aria-hidden="true" />
          </button>
          {item.tem_execucao && item.status !== "CONCLUIDA" && (
            <button
              className="btn btn-ghost"
              onClick={() => marcarConcluida(item)}
              disabled={concluindoId === item.id}
              title="Já tem execução lançada — marcar como concluída sem precisar abrir"
              style={{ color: "var(--success, #15803d)" }}
            >
              <i className="ti ti-check" aria-hidden="true" />
            </button>
          )}
          {(["VALIDADA", "CONCLUIDA"].includes(item.status) || item.tem_foto) && (
            <button
              className="btn btn-ghost"
              onClick={() => navigate(`/reclamacoes/${item.id}/ocorrencia?prefeitura_id=${prefeituraConfirmada}`)}
              title="Fotos e localização"
            >
              <i className="ti ti-photo" aria-hidden="true" />
            </button>
          )}
        </>
      )}
      colunas={[
        {
          key: "codigo",
          label: "Código",
          width: 130,
          // Pedido urgente: selo vermelho com "de quem é o pedido" no título.
          render: (item) => (
            <>
              {item.codigo}
              {item.urgente && (
                <span className="badge badge-urgente" title={item.pedido_de ? `Pedido de: ${item.pedido_de}` : "Urgente"}>
                  Urgente
                </span>
              )}
            </>
          ),
        },
        { key: "data_reclamacao", label: "Data_Rec", render: (item) => formatarData(item.data_reclamacao) },
        {
          key: "data_execucao",
          label: "Data_Exec",
          render: (item) => (item.data_execucao ? formatarData(item.data_execucao) : "—"),
        },
        { key: "nome_reclamante", label: "Reclamante" },
        // Número junto do logradouro ("Rua X, 123"); sem coluna Número separada.
        {
          key: "logradouro",
          label: "Logradouro",
          width: 300,
          render: (item) => [item.logradouro, item.numero].filter(Boolean).join(", ") || "—",
        },
        { key: "bairro_id", label: "Bairro", render: (item) => nomeBairro(item.bairro_id) },
        { key: "cidade_id", label: "Cidade", width: 160, render: (item) => nomeCidade(item.cidade_id) },
        {
          key: "designada",
          label: "Designado",
          render: (item) => (item.designada ? "Sim" : "Não"),
        },
        {
          key: "status",
          label: "Status",
          render: (item) => (
            <>
              <span
                className={`badge ${["CONCLUIDA", "VALIDADA"].includes(item.status) ? "badge-success" : "badge-muted"}`}
              >
                {labelStatus(item.status)}
              </span>
              {item.tem_execucao && !["CONCLUIDA"].includes(item.status) && (
                <span
                  className="badge"
                  style={{ marginLeft: 6, background: "#fef3c7", color: "#92400e" }}
                  title="Já tem execução lançada — falta só marcar como concluída"
                >
                  Já atendida
                </span>
              )}
            </>
          ),
        },
      ]}
      campos={[
        { name: "codigo", label: "Código", size: 4, disabled: true, placeholder: "Gerado ao salvar" },
        { name: "nome_reclamante", label: "Nome do reclamante", required: true, size: 8 },
        {
          name: "tipo_reclamacao",
          label: "Como chegou",
          type: "select",
          required: true,
          size: 2,
          options: TIPOS_RECLAMACAO,
        },
        { name: "data_reclamacao", label: "Data", type: "date", required: true, size: 2, center: true },
        // Tem foto = Sim: o reclamante tem foto do problema; o telefone vira obrigatório.
        { name: "foto_reclamante", label: "Tem foto", type: "simnao", size: 1 },
        // Obrigatório quando o reclamante tem foto (a equipe pede a foto por esse telefone).
        { name: "telefone", label: "Telefone", mask: "telefone", center: true, size: 2, required: (f) => !!f.foto_reclamante },
        // Urgente = Sim abre o campo "Pedido de" (de quem é o pedido); Não limpa o campo.
        {
          name: "urgente",
          label: "Urgente",
          type: "simnao",
          size: 1,
          aoMudar: (sim, f) => (sim ? f : { ...f, pedido_de: "" }),
        },
        {
          name: "pedido_de",
          label: "Pedido de",
          required: true,
          size: 4,
          placeholder: "De quem é o pedido",
          visivel: (f) => !!f.urgente,
          reservarEspaco: true, // oculto, mantém o lugar (as linhas de baixo não sobem)
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          size: 3,
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
        { name: "cep", label: "CEP", mask: "cep", center: true, size: 2, onBlur: aoSairDoCep },
        { name: "logradouro", label: "Logradouro", size: 8 },
        { name: "numero", label: "Número", size: 2, center: true },
        {
          name: "cidade_id",
          label: "Cidade",
          type: "select",
          required: true,
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
      acaoAposFiltro={
        <>
          <button type="button" className="btn btn-primary" onClick={() => setDesignando(true)}>
            <i className="ti ti-users-group" aria-hidden="true" style={{ marginRight: 6 }} />
            Designar equipe
          </button>
          {designando && (
            <ModalDesignarEquipe
              prefeitura={prefeituras.find((p) => p.id === prefeituraConfirmada)}
              nomeBairro={nomeBairro}
              nomeCidade={nomeCidade}
              onFechar={(salvou) => {
                setDesignando(false);
                if (salvou) setVersaoLista((v) => v + 1);
              }}
            />
          )}
        </>
      }
      filtroTopo={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSearchParams({});
              setPrefeituraEscolhida("");
            }}
          >
            <i className="ti ti-replace" aria-hidden="true" style={{ marginRight: 6 }} />
            Trocar prefeitura
          </button>

          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
            {prefeituras.find((p) => p.id === prefeituraConfirmada)?.nome}
          </span>
        </div>
      }
    />
  );
}
