import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiBairros, apiCidades, apiReclamacoes } from "../api";
import { buscarEnderecoPorCep } from "../viacep";
import { useFluxo } from "../FluxoContext";
import { hojeLocal } from "../datas";
import { useOffline } from "../offline/OfflineContext";
import { comCache } from "../offline/cache";
import Topo from "../Topo";

const hoje = hojeLocal;

export default function NovaReclamacao() {
  const navigate = useNavigate();
  const { prefeituraId } = useFluxo();
  const { online } = useOffline();

  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);
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
    cidade_id: "",
    bairro_id: "",
  });

  useEffect(() => {
    if (!prefeituraId) {
      navigate("/prefeitura", { replace: true });
      return;
    }
    Promise.all([comCache("cidades", () => apiCidades.listar()), comCache("bairros", () => apiBairros.listar())])
      .then(([c, b]) => {
        setCidades(c.dados);
        setBairros(b.dados);
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
        cidade_id: cidade?.id || f.cidade_id,
        bairro_id: bairro?.id || f.bairro_id,
      }));
    } catch {
      // CEP não encontrado — segue com preenchimento manual.
    }
  }

  const bairrosDaCidade = bairros.filter((b) => !form.cidade_id || b.cidade_id === form.cidade_id);

  async function salvar(e) {
    e.preventDefault();
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
            <label>Cidade</label>
            <select value={form.cidade_id} onChange={(e) => campo("cidade_id", e.target.value)}>
              <option value="">Selecione...</option>
              {cidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Bairro</label>
            <select value={form.bairro_id} onChange={(e) => campo("bairro_id", e.target.value)}>
              <option value="">Selecione...</option>
              {bairrosDaCidade.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
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
