import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiBairros, apiCidades, apiReclamacoes } from "../api";
import { useFluxo } from "../FluxoContext";
import { comCache } from "../offline/cache";
import Topo from "../Topo";

function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Reclamacoes() {
  const navigate = useNavigate();
  const { prefeituraId } = useFluxo();
  const [lista, setLista] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!prefeituraId) {
      navigate("/prefeitura", { replace: true });
      return;
    }
    Promise.all([
      comCache(`reclamacoesAbertas:${prefeituraId}`, () =>
        apiReclamacoes.listar(`?prefeitura_id=${prefeituraId}&status=ABERTA`)
      ),
      comCache("cidades", () => apiCidades.listar()),
      comCache("bairros", () => apiBairros.listar()),
    ])
      .then(([r, c, b]) => {
        setLista(r.dados);
        setCidades(c.dados);
        setBairros(b.dados);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [prefeituraId, navigate]);

  const nomeCidade = (id) => cidades.find((c) => c.id === id)?.nome || "—";
  const nomeBairro = (id) => bairros.find((b) => b.id === id)?.nome || "—";

  return (
    <div className="tela">
      <Topo titulo="Reclamações abertas" subtitulo={`${lista.length} encontrada(s)`} voltar={() => navigate("/prefeitura")} />
      <div className="conteudo">
        {erro && <p className="erro-msg">{erro}</p>}
        {carregando && <div className="vazio">Carregando...</div>}
        {!carregando && lista.length === 0 && <div className="vazio">Nenhuma reclamação aberta nessa prefeitura.</div>}
        {lista.map((r) => (
          <div
            key={r.id}
            className="cartao cartao-toque"
            style={{ alignItems: "center" }}
            onClick={() => navigate(`/execucao/${r.id}`)}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="cartao-titulo">{r.codigo}</div>
              <div className="cartao-sub">
                {r.logradouro || "—"}
                {r.numero ? `, ${r.numero}` : ""}
              </div>
              <div className="cartao-sub">{formatarData(r.data_reclamacao)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px", marginTop: 4 }}>
                <div className="cartao-sub">
                  <strong>Reclamante:</strong> {r.nome_reclamante || "—"}
                </div>
                <div className="cartao-sub">
                  <strong>Telefone:</strong> {r.telefone || "—"}
                </div>
                <div className="cartao-sub">
                  <strong>Cidade:</strong> {nomeCidade(r.cidade_id)}
                </div>
                <div className="cartao-sub">
                  <strong>Bairro:</strong> {nomeBairro(r.bairro_id)}
                </div>
                <div className="cartao-sub">
                  <strong>Ponto de referência:</strong> {r.ponto_referencia || "—"}
                </div>
                <div className="cartao-sub">
                  <strong>Observações:</strong> {r.observacoes || "—"}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secundario"
              style={{
                width: "auto",
                flexShrink: 0,
                whiteSpace: "nowrap",
                marginLeft: 10,
                padding: "10px 12px",
                fontSize: 13,
              }}
            >
              Ir para execução
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-secundario" style={{ marginTop: 10 }} onClick={() => navigate("/reclamacoes/nova")}>
          <i className="ti ti-plus" aria-hidden="true" /> Nova reclamação (atendimento no local)
        </button>
      </div>
    </div>
  );
}
