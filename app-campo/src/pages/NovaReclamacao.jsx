import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiBairros, apiCidades, apiPrefeituras, apiReclamacoes } from "../api";
import { buscarEnderecoPorCep } from "../viacep";
import { useFluxo } from "../FluxoContext";
import { hojeLocal } from "../datas";
import { useOffline } from "../offline/OfflineContext";
import { comCache, salvarCache } from "../offline/cache";
import Topo from "../Topo";

const hoje = hojeLocal;

export default function NovaReclamacao() {
  const navigate = useNavigate();
  const { prefeituraId, equipeDiaId } = useFluxo();
  const { online } = useOffline();

  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [prefeituras, setPrefeituras] = useState([]);
  // Cadastro de bairro novo (opção "+ Cadastrar novo bairro…" no select).
  const [novoBairro, setNovoBairro] = useState(null); // null = fechado; string = texto digitado
  const [criandoBairro, setCriandoBairro] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({
    nome_reclamante: "",
    telefone: "",
    cep: "",
    logradouro: "",
    numero: "",
    ponto_referencia: "",
    observacoes: "",
    prefeitura_id: "",
    cidade_id: "",
    bairro_id: "",
  });

  useEffect(() => {
    if (!prefeituraId) {
      navigate("/prefeitura", { replace: true });
      return;
    }
    Promise.all([
      comCache("cidades", () => apiCidades.listar()),
      comCache("bairros", () => apiBairros.listar()),
      comCache("prefeituras", () => apiPrefeituras.listar()),
    ])
      .then(([c, b, p]) => {
        setCidades(c.dados);
        setBairros(b.dados);
        setPrefeituras(p.dados);
        // Já abre com a prefeitura em que a equipe está trabalhando e a cidade dela.
        const atual = p.dados.find((x) => x.id === prefeituraId);
        setForm((f) => ({ ...f, prefeitura_id: prefeituraId, cidade_id: atual?.cidade_id || "" }));
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [prefeituraId, navigate]);

  function campo(nome, valor) {
    setForm((f) => ({ ...f, [nome]: valor }));
  }

  async function aoSairDoCep() {
    const digitos = form.cep.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    try {
      const end = await buscarEnderecoPorCep(form.cep);
      const cidade = cidades.find((c) => c.nome.toLowerCase() === end.cidade.toLowerCase() && c.uf === end.uf);
      const bairro = cidade
        ? bairros.find((b) => b.nome.toLowerCase() === end.bairro.toLowerCase() && b.cidade_id === cidade.id)
        : null;
      setForm((f) => ({
        ...f,
        logradouro: end.logradouro || f.logradouro,
        // A cidade vem da prefeitura escolhida; o CEP só completa logradouro e bairro.
        cidade_id: cidadesDaPrefeitura.some((c) => c.id === cidade?.id) ? cidade.id : f.cidade_id,
        bairro_id: bairro?.id || f.bairro_id,
      }));
    } catch {
      // CEP não encontrado — segue com preenchimento manual.
    }
  }

  const bairrosDaCidade = bairros
    .filter((b) => !form.cidade_id || b.cidade_id === form.cidade_id)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Cascata: Prefeitura -> Cidade(s) da prefeitura -> Bairros da cidade.
  const prefeituraEscolhida = prefeituras.find((p) => p.id === form.prefeitura_id) || null;
  const cidadesDaPrefeitura = cidades.filter((c) => c.id === prefeituraEscolhida?.cidade_id);

  function escolherCidade(cidadeId) {
    setForm((f) => ({ ...f, cidade_id: cidadeId, bairro_id: "" }));
    setNovoBairro(null);
  }

  function escolherBairro(valor) {
    if (valor === "__novo") {
      setNovoBairro("");
      return;
    }
    setNovoBairro(null);
    campo("bairro_id", valor);
  }

  // Cria o bairro na cidade escolhida (ou usa o existente com o mesmo nome) e já seleciona.
  async function cadastrarBairro() {
    const nome = (novoBairro || "").trim();
    if (!nome) return;
    if (!form.cidade_id) {
      setErro("Escolha a cidade antes de cadastrar o bairro.");
      return;
    }
    const existente = bairrosDaCidade.find((b) => b.nome.toLowerCase() === nome.toLowerCase());
    if (existente) {
      campo("bairro_id", existente.id);
      setNovoBairro(null);
      return;
    }
    setCriandoBairro(true);
    setErro("");
    try {
      const criado = await apiBairros.criar({ nome: nome.toUpperCase(), cidade_id: form.cidade_id });
      const lista = [...bairros, criado];
      setBairros(lista);
      await salvarCache("bairros", lista);
      campo("bairro_id", criado.id);
      setNovoBairro(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCriandoBairro(false);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.prefeitura_id) {
      setErro("Escolha a prefeitura.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const nova = await apiReclamacoes.criar({
        nome_reclamante: form.nome_reclamante,
        telefone: form.telefone || null,
        tipo_reclamacao: "PELA_EQUIPE",
        data_reclamacao: hoje(),
        cep: form.cep || null,
        logradouro: form.logradouro || null,
        numero: form.numero || null,
        ponto_referencia: form.ponto_referencia || null,
        cidade_id: form.cidade_id || null,
        bairro_id: form.bairro_id || null,
        prefeitura_id: prefeituraId,
        observacoes: form.observacoes || null,
        status: "ABERTA",
        // Fica designada para a própria equipe, na data de hoje.
        designar_equipe_id: equipeDiaId || null,
      });
      navigate(`/execucao/${nova.id}`, { replace: true });
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="tela">
        <Topo titulo="Nova reclamação" voltar={() => navigate("/reclamacoes")} />
        <div className="conteudo vazio">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="tela">
      <Topo titulo="Nova reclamação" subtitulo="Atendimento solicitado no local" voltar={() => navigate("/reclamacoes")} />
      <div className="conteudo">
        {!online && (
          <p className="erro-msg">
            Sem internet — criar uma reclamação nova exige conexão (o código dela é gerado pelo servidor).
            Conecte-se e tente de novo.
          </p>
        )}
        {erro && <p className="erro-msg">{erro}</p>}
        <form onSubmit={salvar}>
          <div className="campo">
            <label>Nome do reclamante</label>
            <input required value={form.nome_reclamante} onChange={(e) => campo("nome_reclamante", e.target.value)} />
          </div>
          <div className="campo">
            <label>Telefone</label>
            <input value={form.telefone} onChange={(e) => campo("telefone", e.target.value)} />
          </div>
          <div className="campo">
            <label>CEP</label>
            <input value={form.cep} onChange={(e) => campo("cep", e.target.value)} onBlur={aoSairDoCep} />
          </div>
          <div className="campo">
            <label>Logradouro</label>
            <input value={form.logradouro} onChange={(e) => campo("logradouro", e.target.value)} />
          </div>
          <div className="linha">
            <div className="campo" style={{ flex: 1 }}>
              <label>Número</label>
              <input value={form.numero} onChange={(e) => campo("numero", e.target.value)} />
            </div>
          </div>
          <div className="campo">
            <label>Prefeitura</label>
            {/* Fixa: é a prefeitura escolhida na entrada do app (evita cadastrar na prefeitura errada). */}
            <input value={prefeituraEscolhida?.nome || ""} disabled readOnly />
          </div>
          <div className="campo">
            <label>Cidade</label>
            <select value={form.cidade_id} onChange={(e) => escolherCidade(e.target.value)} disabled={!form.prefeitura_id}>
              <option value="">Selecione...</option>
              {cidadesDaPrefeitura.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Bairro</label>
            <select value={novoBairro !== null ? "__novo" : form.bairro_id} onChange={(e) => escolherBairro(e.target.value)}>
              <option value="">Selecione...</option>
              {bairrosDaCidade.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
              <option value="__novo">+ Cadastrar novo bairro…</option>
            </select>
            {novoBairro !== null && (
              <div className="linha" style={{ marginTop: 6, gap: 8 }}>
                <input
                  autoFocus
                  style={{ flex: 1 }}
                  placeholder="Nome do novo bairro"
                  value={novoBairro}
                  onChange={(e) => setNovoBairro(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      cadastrarBairro();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secundario btn-pequeno"
                  style={{ width: "auto" }}
                  onClick={cadastrarBairro}
                  disabled={criandoBairro || !novoBairro.trim() || !online}
                >
                  {criandoBairro ? "Salvando..." : "Adicionar"}
                </button>
              </div>
            )}
          </div>
          <div className="campo">
            <label>Ponto de referência</label>
            <input value={form.ponto_referencia} onChange={(e) => campo("ponto_referencia", e.target.value)} />
          </div>
          <div className="campo">
            <label>Observações</label>
            <textarea rows={3} value={form.observacoes} onChange={(e) => campo("observacoes", e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primario" disabled={salvando || !online}>
            {salvando ? "Criando..." : "Criar e atender agora"}
          </button>
        </form>
      </div>
    </div>
  );
}
