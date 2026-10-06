import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiReclamacoes } from "../api";
import { useFluxo } from "../FluxoContext";
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
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!prefeituraId) {
      navigate("/prefeitura", { replace: true });
      return;
    }
    apiReclamacoes
      .listar(`?prefeitura_id=${prefeituraId}&status=ABERTA`)
      .then(setLista)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [prefeituraId, navigate]);

  return (
    <div className="tela">
      <Topo titulo="Reclamações abertas" subtitulo={`${lista.length} encontrada(s)`} voltar={() => navigate("/prefeitura")} />
      <div className="conteudo">
        {erro && <p className="erro-msg">{erro}</p>}
        {carregando && <div className="vazio">Carregando...</div>}
        {!carregando && lista.length === 0 && <div className="vazio">Nenhuma reclamação aberta nessa prefeitura.</div>}
        {lista.map((r) => (
          <div key={r.id} className="cartao cartao-toque" onClick={() => navigate(`/execucao/${r.id}`)}>
            <div>
              <div className="cartao-titulo">{r.codigo}</div>
              <div className="cartao-sub">
                {r.logradouro || "—"}
                {r.numero ? `, ${r.numero}` : ""}
              </div>
              <div className="cartao-sub">{formatarData(r.data_reclamacao)}</div>
            </div>
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}
