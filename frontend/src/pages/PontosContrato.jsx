import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiContratos, apiPontosMaterialContrato, apiPrefeituras } from "../api";

export default function PontosContrato() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contrato, setContrato] = useState(null);
  const [prefeituras, setPrefeituras] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    Promise.all([apiContratos.obter(id), apiPrefeituras.listar(), apiPontosMaterialContrato.matriz(id)])
      .then(([c, prefs, matriz]) => {
        setContrato(c);
        setPrefeituras(prefs);
        setLinhas(matriz);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [id]);

  const nomePrefeitura = (prefeituraId) => prefeituras.find((p) => p.id === prefeituraId)?.nome || "—";

  function atualizarLinha(idx, patch) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    setSucesso(false);
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const atualizado = await apiPontosMaterialContrato.salvarMatriz(id, linhas);
      setLinhas(atualizado);
      setSucesso(true);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <>
        <header className="topbar">
          <h1>Pontos de materiais do contrato</h1>
        </header>
        <div className="content">
          <div className="card empty-state">Carregando...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <h1>Pontos de materiais do contrato</h1>
        <button className="btn" onClick={() => navigate("/contratos")}>
          <i className="ti ti-arrow-left" aria-hidden="true" style={{ marginRight: 6 }} />
          Voltar
        </button>
      </header>

      <div className="content">
        <div className="card">
          {contrato && (
            <p style={{ margin: "0 0 12px", color: "var(--text-secondary)", fontSize: 14 }}>
              {nomePrefeitura(contrato.prefeitura_id)}
              {contrato.numero_contrato ? ` — ${contrato.numero_contrato}` : ""}
            </p>
          )}

          {erro && <p className="erro-msg">{erro}</p>}
          {sucesso && <span className="badge badge-success">Pontos salvos.</span>}

          <table className="tabela-compacta">
            <thead>
              <tr>
                <th style={{ padding: "6px 12px" }}>Material</th>
                <th style={{ padding: "6px 12px" }}>Pts Instalação</th>
                <th style={{ padding: "6px 12px" }}>Pts Retirada</th>
                <th style={{ padding: "6px 12px" }}>Pts Substituição</th>
                <th style={{ padding: "6px 12px" }}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, idx) => (
                <tr key={linha.material_id}>
                  <td style={{ padding: "2px 12px" }}>{linha.material_nome}</td>
                  <td style={{ padding: "2px 12px", textAlign: "center" }}>
                    <input
                      type="number"
                      step="0.01"
                      style={{ width: 90, height: 24, textAlign: "center" }}
                      value={linha.qde_pontos_inst}
                      onChange={(e) => atualizarLinha(idx, { qde_pontos_inst: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td style={{ padding: "2px 12px", textAlign: "center" }}>
                    <input
                      type="number"
                      step="0.01"
                      style={{ width: 90, height: 24, textAlign: "center" }}
                      value={linha.qde_pontos_ret}
                      onChange={(e) => atualizarLinha(idx, { qde_pontos_ret: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td style={{ padding: "2px 12px", textAlign: "center" }}>
                    <input
                      type="number"
                      step="0.01"
                      style={{ width: 90, height: 24, textAlign: "center" }}
                      value={linha.qde_pontos_subst}
                      onChange={(e) => atualizarLinha(idx, { qde_pontos_subst: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td style={{ padding: "2px 12px", textAlign: "center" }}>
                    {linha.cadastrado ? (
                      <span className="badge badge-success">Cadastrado</span>
                    ) : (
                      <span className="badge" style={{ background: "#fef2f2", color: "var(--danger, #dc2626)" }}>
                        Faltando
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
