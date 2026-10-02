import { useEffect, useState } from "react";
import { apiCidades, apiPrefeituras, relatorioPontosAtendidos } from "../api";
import logoSelles from "../assets/logo-selles.png";

function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function numeroOuTraco(v) {
  return v ? v.toString().replace(/\.0$/, "") : "—";
}

export default function RelatorioPontos() {
  const [prefeituras, setPrefeituras] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [prefeituraId, setPrefeituraId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [linhas, setLinhas] = useState(null); // null = ainda não gerado
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    apiPrefeituras.listar().then(setPrefeituras);
    apiCidades.listar().then(setCidades);
  }, []);

  const prefeitura = prefeituras.find((p) => p.id === prefeituraId);
  const nomeCidade = (id) => cidades.find((c) => c.id === id)?.nome || "";

  async function gerar(e) {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    try {
      const dados = await relatorioPontosAtendidos(prefeituraId, dataInicio, dataFim);
      setLinhas(dados);
    } catch (err) {
      setErro(err.message);
      setLinhas(null);
    } finally {
      setCarregando(false);
    }
  }

  const totais = (linhas || []).reduce(
    (acc, l) => ({
      rele: acc.rele + Number(l.rele || 0),
      base: acc.base + Number(l.base || 0),
      perfurante: acc.perfurante + Number(l.perfurante || 0),
      conx: acc.conx + Number(l.conx || 0),
      pontos: acc.pontos + Number(l.pontos || 0),
    }),
    { rele: 0, base: 0, perfurante: 0, conx: 0, pontos: 0 }
  );

  return (
    <>
      <header className="topbar no-print">
        <h1>Relatório de pontos atendidos</h1>
      </header>

      <div className="content">
        <div className="card no-print">
          <form onSubmit={gerar} className="form-grid">
            <div className="form-field" style={{ "--span": 6 }}>
              <label>Prefeitura</label>
              <select required value={prefeituraId} onChange={(e) => setPrefeituraId(e.target.value)}>
                <option value="">Selecione...</option>
                {prefeituras.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ "--span": 2 }}>
              <label>Data início</label>
              <input
                type="date"
                required
                style={{ width: 130, textAlign: "center" }}
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ "--span": 2 }}>
              <label>Data fim</label>
              <input
                type="date"
                required
                style={{ width: 130, textAlign: "center" }}
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ "--span": 2, display: "flex", alignItems: "flex-end", paddingTop: 14 }}>
              <button type="submit" className="btn btn-primary" disabled={carregando} style={{ width: "100%" }}>
                {carregando ? "..." : "Gerar"}
              </button>
            </div>
          </form>
          {erro && <p className="erro-msg">{erro}</p>}
        </div>

        {linhas !== null && (
          <div className="card" style={{ marginTop: 16 }}>
            {linhas.length > 0 && (
              <button type="button" className="btn btn-primary no-print" style={{ marginBottom: 14 }} onClick={() => window.print()}>
                <i className="ti ti-printer" aria-hidden="true" style={{ marginRight: 6 }} />
                Imprimir
              </button>
            )}

            <div className="relatorio-cabecalho">
              <img src={logoSelles} alt="Selles" />
              <div className="relatorio-cidade">{nomeCidade(prefeitura?.cidade_id) || "—"}</div>
              <div className="relatorio-titulo">
                RELATÓRIO DE PONTOS ATENDIDOS: {formatarData(dataInicio)} A {formatarData(dataFim)}
              </div>
            </div>

            {linhas.length === 0 ? (
              <div className="empty-state">Nenhuma execução encontrada no período.</div>
            ) : (
              <table className="tabela-relatorio">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Bairro</th>
                    <th>Logradouro</th>
                    <th>Luminárias (W)</th>
                    <th>Relê</th>
                    <th>Base</th>
                    <th>Perfurante</th>
                    <th>Conx</th>
                    <th>Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i}>
                      <td>{formatarData(l.data)}</td>
                      <td>{l.bairro}</td>
                      <td>{l.logradouro}</td>
                      <td>{l.luminarias_w || "—"}</td>
                      <td style={{ textAlign: "center" }}>{numeroOuTraco(l.rele)}</td>
                      <td style={{ textAlign: "center" }}>{numeroOuTraco(l.base)}</td>
                      <td style={{ textAlign: "center" }}>{numeroOuTraco(l.perfurante)}</td>
                      <td style={{ textAlign: "center" }}>{numeroOuTraco(l.conx)}</td>
                      <td style={{ textAlign: "center" }}>{numeroOuTraco(l.pontos)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>
                      <strong>Totais</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <strong>{numeroOuTraco(totais.rele)}</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <strong>{numeroOuTraco(totais.base)}</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <strong>{numeroOuTraco(totais.perfurante)}</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <strong>{numeroOuTraco(totais.conx)}</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <strong>{numeroOuTraco(totais.pontos)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}
