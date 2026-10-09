import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiBairros, apiCidades, apiDesignacoes, apiReclamacoes } from "../api";
import { hojeLocal } from "../datas";
import { useFluxo } from "../FluxoContext";
import { comCache } from "../offline/cache";
import Topo from "../Topo";

export default function Reclamacoes() {
  const navigate = useNavigate();
  const { prefeituraId, equipeDiaId } = useFluxo();
  const [lista, setLista] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!equipeDiaId) {
      navigate("/equipe", { replace: true });
      return;
    }
    if (!prefeituraId) {
      navigate("/prefeitura", { replace: true });
      return;
    }
    const hoje = hojeLocal();
    Promise.all([
      comCache(`reclamacoesAbertas:${prefeituraId}`, () =>
        apiReclamacoes.listar(`?prefeitura_id=${prefeituraId}&status=ABERTA`)
      ),
      // Roteiro de hoje da equipe: só as reclamações designadas a ela aparecem.
      comCache(`designacoes:${equipeDiaId}:${hoje}`, () =>
        apiDesignacoes.listar(`?data=${hoje}&equipe_dia_id=${equipeDiaId}`)
      ),
      comCache("cidades", () => apiCidades.listar()),
      comCache("bairros", () => apiBairros.listar()),
    ])
      .then(([r, d, c, b]) => {
        const designadas = new Set(d.dados.map((x) => x.reclamacao_id));
        setLista(r.dados.filter((rec) => designadas.has(rec.id)));
        setCidades(c.dados);
        setBairros(b.dados);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [prefeituraId, equipeDiaId, navigate]);

  const nomeCidade = (id) => cidades.find((c) => c.id === id)?.nome || "—";
  const nomeBairro = (id) => bairros.find((b) => b.id === id)?.nome || "—";

  return (
    <div className="tela">
      <Topo titulo="Reclamações da equipe" subtitulo={`${lista.length} designada(s) para hoje`} voltar={() => navigate("/prefeitura")} />
      <div className="conteudo">
        {erro && <p className="erro-msg">{erro}</p>}
        {carregando && <div className="vazio">Carregando...</div>}
        {!carregando && lista.length === 0 && <div className="vazio">Nenhuma reclamação designada para a sua equipe nesta prefeitura hoje.</div>}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px", marginTop: 4 }}>
                <div className="cartao-sub">
                  <strong>Cidade:</strong> {nomeCidade(r.cidade_id)}
                </div>
                <div className="cartao-sub">
                  <strong>Bairro:</strong> {nomeBairro(r.bairro_id)}
                </div>
                <div className="cartao-sub">
                  <strong>Ponto de referência:</strong> {r.ponto_referencia || "—"}
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
