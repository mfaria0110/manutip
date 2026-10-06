import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPrefeituras } from "../api";
import { useFluxo } from "../FluxoContext";
import Topo from "../Topo";

export default function Prefeitura() {
  const navigate = useNavigate();
  const { definirPrefeitura, equipeDiaId } = useFluxo();
  const [prefeituras, setPrefeituras] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!equipeDiaId) {
      navigate("/equipe", { replace: true });
      return;
    }
    apiPrefeituras
      .listar()
      .then(setPrefeituras)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [equipeDiaId, navigate]);

  function escolher(id) {
    definirPrefeitura(id);
    navigate("/reclamacoes");
  }

  return (
    <div className="tela">
      <Topo titulo="Prefeitura" subtitulo="Escolha onde vai trabalhar hoje" voltar={() => navigate("/equipe")} />
      <div className="conteudo">
        {erro && <p className="erro-msg">{erro}</p>}
        {carregando && <div className="vazio">Carregando...</div>}
        {prefeituras.map((p) => (
          <div key={p.id} className="cartao cartao-toque" onClick={() => escolher(p.id)}>
            <div className="cartao-titulo">{p.nome}</div>
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}
