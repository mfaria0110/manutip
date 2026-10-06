import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiExecucoesReclamacao, apiReclamacoes, obterFotoURL } from "../api";

function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function OcorrenciaReclamacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefeituraId = searchParams.get("prefeitura_id");
  const voltarParaLista = () => navigate(prefeituraId ? `/reclamacoes?prefeitura_id=${prefeituraId}` : "/reclamacoes");
  const [reclamacao, setReclamacao] = useState(null);
  const [execucoes, setExecucoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    Promise.all([apiReclamacoes.obter(id), apiExecucoesReclamacao.listar(`?reclamacao_id=${id}`)])
      .then(async ([rec, execs]) => {
        setReclamacao(rec);
        const comFotos = await Promise.all(
          execs.map(async (ex) => ({
            ...ex,
            fotos: await Promise.all(
              (ex.fotos || []).map(async (f) => ({ ...f, previewUrl: await obterFotoURL(f.url).catch(() => null) }))
            ),
          }))
        );
        setExecucoes(comFotos);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [id]);

  const comDados = execucoes.filter((ex) => (ex.latitude && ex.longitude) || ex.fotos.length > 0);

  return (
    <>
      <header className="topbar">
        <h1>Fotos e localização da ocorrência</h1>
        <button className="btn" onClick={voltarParaLista}>
          <i className="ti ti-arrow-left" aria-hidden="true" style={{ marginRight: 6 }} />
          Voltar
        </button>
      </header>

      <div className="content">
        {erro && <p className="erro-msg">{erro}</p>}
        {carregando && <div className="empty-state">Carregando...</div>}

        {!carregando && reclamacao && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 4px" }}>{reclamacao.codigo}</h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
              {reclamacao.logradouro || "—"}
              {reclamacao.numero ? `, ${reclamacao.numero}` : ""}
            </p>
          </div>
        )}

        {!carregando && comDados.length === 0 && (
          <div className="empty-state">Nenhuma execução com foto ou localização registrada ainda.</div>
        )}

        {comDados.map((ex) => (
          <div key={ex.id} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <strong>Execução de {formatarData(ex.data_execucao)}</strong>
              {ex.latitude && ex.longitude && (
                <a
                  className="btn btn-ghost"
                  href={`https://www.google.com/maps?q=${ex.latitude},${ex.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i className="ti ti-map-pin" aria-hidden="true" style={{ marginRight: 6 }} />
                  Ver localização no mapa
                </a>
              )}
            </div>

            {ex.fotos.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                {ex.fotos.map((f) => (
                  <a key={f.id} href={f.previewUrl} target="_blank" rel="noreferrer">
                    <img
                      src={f.previewUrl}
                      alt="Foto da execução"
                      style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
