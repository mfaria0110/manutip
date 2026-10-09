import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiExecucoesReclamacao, apiReclamacoes, obterFotoBlob } from "../api";
import { formatarData } from "../formatos";

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
  const [marcadas, setMarcadas] = useState(new Set()); // ids das fotos marcadas pra baixar
  const [baixando, setBaixando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    Promise.all([apiReclamacoes.obter(id), apiExecucoesReclamacao.listar(`?reclamacao_id=${id}`)])
      .then(async ([rec, execs]) => {
        setReclamacao(rec);
        const comFotos = await Promise.all(
          execs.map(async (ex) => ({
            ...ex,
            fotos: await Promise.all(
              (ex.fotos || []).map(async (f) => {
                const blob = await obterFotoBlob(f.url).catch(() => null);
                return { ...f, blob, previewUrl: blob ? URL.createObjectURL(blob) : null };
              })
            ),
          }))
        );
        setExecucoes(comFotos);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [id]);

  const comDados = execucoes.filter((ex) => (ex.latitude && ex.longitude) || ex.fotos.length > 0);

  // Nome de cada foto: <código da reclamação>_<data>_<nº>.<extensão>, com o
  // número contando as fotos do mesmo dia (execuções do mesmo dia não repetem nome).
  const nomesFotos = (() => {
    const nomes = new Map();
    const contagemPorData = {};
    comDados.forEach((ex) => {
      ex.fotos.forEach((f) => {
        const data = formatarData(ex.data_execucao).replace(/\//g, "-");
        contagemPorData[data] = (contagemPorData[data] || 0) + 1;
        const ext = (f.blob?.type || "image/jpeg").split("/")[1]?.replace("jpeg", "jpg") || "jpg";
        nomes.set(f.id, `${reclamacao?.codigo || "foto"}_${data}_${String(contagemPorData[data]).padStart(2, "0")}.${ext}`);
      });
    });
    return nomes;
  })();
  const todasFotos = comDados.flatMap((ex) => ex.fotos).filter((f) => f.blob);
  const todasMarcadas = todasFotos.length > 0 && todasFotos.every((f) => marcadas.has(f.id));

  function alternarFoto(fotoId) {
    setMarcadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(fotoId)) novo.delete(fotoId);
      else novo.add(fotoId);
      return novo;
    });
  }

  function alternarTodas() {
    setMarcadas(todasMarcadas ? new Set() : new Set(todasFotos.map((f) => f.id)));
  }

  // Salva as fotos marcadas no computador. Chrome/Edge deixam escolher uma pasta
  // e gravam todas nela; em outros navegadores cada foto vira um download normal
  // (vai para a pasta de Downloads).
  async function baixarMarcadas() {
    const fotos = todasFotos.filter((f) => marcadas.has(f.id));
    if (fotos.length === 0) return;
    setErro("");
    setAviso("");
    setBaixando(true);
    try {
      if (window.showDirectoryPicker) {
        const pasta = await window.showDirectoryPicker({ mode: "readwrite" });
        for (const f of fotos) {
          const arquivo = await pasta.getFileHandle(nomesFotos.get(f.id), { create: true });
          const escrita = await arquivo.createWritable();
          await escrita.write(f.blob);
          await escrita.close();
        }
        setAviso(`${fotos.length} foto(s) salva(s) na pasta "${pasta.name}".`);
      } else {
        for (const f of fotos) {
          const a = document.createElement("a");
          a.href = f.previewUrl;
          a.download = nomesFotos.get(f.id);
          document.body.appendChild(a);
          a.click();
          a.remove();
          await new Promise((r) => setTimeout(r, 300)); // evita o navegador barrar downloads em rajada
        }
        setAviso(`${fotos.length} foto(s) baixada(s) para a pasta de Downloads.`);
      }
    } catch (e) {
      if (e?.name !== "AbortError") setErro(e.message || "Não foi possível salvar as fotos.");
    } finally {
      setBaixando(false);
    }
  }

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

        {todasFotos.length > 0 && (
          <div className="card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={todasMarcadas}
                onChange={alternarTodas}
                style={{ width: 16, height: 16, padding: 0 }}
              />
              {todasMarcadas ? "Desmarcar todas" : "Marcar todas"}
            </label>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {marcadas.size} de {todasFotos.length} foto(s) marcada(s)
            </span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={baixarMarcadas}
              disabled={marcadas.size === 0 || baixando}
              style={{ marginLeft: "auto" }}
            >
              <i className="ti ti-download" aria-hidden="true" style={{ marginRight: 6 }} />
              {baixando ? "Salvando..." : "Baixar marcadas"}
            </button>
          </div>
        )}
        {aviso && <p style={{ color: "var(--success, #15803d)", fontSize: 13 }}>{aviso}</p>}

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
                  href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ex.latitude},${ex.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i className="ti ti-map-pin" aria-hidden="true" style={{ marginRight: 6 }} />
                  Ver no Street View
                </a>
              )}
            </div>

            {ex.fotos.length > 0 && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
                {ex.fotos.map((f) => (
                  <div key={f.id} style={{ width: 140 }}>
                    <div style={{ position: "relative" }}>
                      <a href={f.previewUrl} target="_blank" rel="noreferrer">
                        <img
                          src={f.previewUrl}
                          alt={nomesFotos.get(f.id)}
                          style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                        />
                      </a>
                      <input
                        type="checkbox"
                        checked={marcadas.has(f.id)}
                        onChange={() => alternarFoto(f.id)}
                        title="Marcar para baixar"
                        style={{ position: "absolute", top: 6, left: 6, width: 18, height: 18, padding: 0 }}
                      />
                    </div>
                    <div
                      title={nomesFotos.get(f.id)}
                      style={{ fontSize: 11, marginTop: 4, wordBreak: "break-all", color: "var(--text-secondary)" }}
                    >
                      {nomesFotos.get(f.id)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
