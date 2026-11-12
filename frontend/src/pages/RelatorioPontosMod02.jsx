import { useEffect, useState } from "react";
import { apiCidades, apiPrefeituras, baixarRelatorioExcel, relatorioPontosMod02 } from "../api";
import logoSelles from "../assets/logo-selles.png";
import { formatarData } from "../formatos";

/** Pontos atendidos - Mod-02: modelo do sistema da prefeitura (uma linha por
 * execução: Nº Atend., Etiqueta, Endereço, Tipo Ocorrência, Atendimento,
 * Motivo, Solução e Conclusão). */
export default function RelatorioPontosMod02() {
  const [prefeituras, setPrefeituras] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [prefeituraId, setPrefeituraId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [linhas, setLinhas] = useState(null); // null = ainda não gerado
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [exportando, setExportando] = useState(false);

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
      setLinhas(await relatorioPontosMod02(prefeituraId, dataInicio, dataFim));
    } catch (err) {
      setErro(err.message);
      setLinhas(null);
    } finally {
      setCarregando(false);
    }
  }

  const nomeBase = `Pontos_atendidos_${(prefeitura?.sigla || prefeitura?.nome || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")}_${formatarData(dataInicio).replace(/\//g, "-")}_a_${formatarData(dataFim).replace(/\//g, "-")}`;

  async function exportarExcel() {
    setExportando(true);
    setErro("");
    try {
      await baixarRelatorioExcel("pontos-atendidos-mod02", prefeituraId, dataInicio, dataFim, `${nomeBase}.xlsx`);
    } catch (err) {
      setErro(err.message);
    } finally {
      setExportando(false);
    }
  }

  // Conta Atendido + Já atendida (material lançado).
  const atendidos = (linhas || []).filter((l) => ["Atendido", "Já atendida"].includes(l.atendimento)).length;

  return (
    <>
      <header className="topbar no-print">
        <h1>Relatório de atendimentos</h1>
      </header>

      <div className="content">
        <div className="card no-print">
          <form onSubmit={gerar} className="form-grid form-filtro-relatorio">
            <div className="form-field" style={{ "--span": 5 }}>
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
            {/* Data início e Data fim lado a lado (sem o vão das colunas da grade). */}
            <div style={{ gridColumn: "span 4", display: "flex", gap: 12 }}>
              <div className="form-field">
              <label>Data início</label>
              <input
                type="date"
                required
                style={{ width: 130, textAlign: "center" }}
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
              <div className="form-field">
              <label>Data fim</label>
              <input
                type="date"
                required
                style={{ width: 130, textAlign: "center" }}
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
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
              <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button type="button" className="btn btn-primary" onClick={exportarExcel} disabled={exportando}>
                  <i className="ti ti-file-spreadsheet" aria-hidden="true" style={{ marginRight: 6 }} />
                  {exportando ? "Gerando..." : "Exportar Excel"}
                </button>
              </div>
            )}

            <div className="relatorio-cabecalho">
              <img src={logoSelles} alt="Selles" />
              <div className="relatorio-cidade">{nomeCidade(prefeitura?.cidade_id) || "—"}</div>
              <div className="relatorio-titulo">
                Atendimentos: {formatarData(dataInicio)} A {formatarData(dataFim)}
              </div>
            </div>

            {linhas.length === 0 ? (
              <div className="empty-state">Nenhuma execução encontrada no período.</div>
            ) : (
              <>
                <div className="mod02-resumo">
                  <span>
                    <strong>Tipo Ocorrência:</strong> Todos
                  </span>
                  <span>
                    <strong>{atendidos === 1 ? "Atendimento" : "Atendimentos"}:</strong> {atendidos}
                  </span>
                  <span>
                    <strong>Solução:</strong> Todos
                  </span>
                </div>
                <table className="tabela-relatorio tabela-mod02">
                  {/* Larguras: colunas curtas não cortam; Endereço/Tipo/Motivo dividem o resto. */}
                  <colgroup>
                    <col style={{ width: 72 }} />
                    <col style={{ width: 82 }} />
                    <col />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: 104 }} />
                    {/* Motivo ficou com a largura da antiga coluna Área. */}
                    <col style={{ width: "calc(14% + 50px)" }} />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 122 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Nº Atend.</th>
                      <th>Etiqueta</th>
                      <th>Endereço</th>
                      <th>Tipo Ocorrência</th>
                      <th>Atendimento</th>
                      <th>Motivo</th>
                      <th>Solução</th>
                      <th>Conclusão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => (
                      <tr key={i}>
                        <td style={{ textAlign: "center" }}>{l.n_atend}</td>
                        <td style={{ textAlign: "center" }}>{l.etiqueta}</td>
                        <td>{l.endereco}</td>
                        <td>{l.tipo_ocorrencia}</td>
                        <td style={{ textAlign: "center" }}>{l.atendimento}</td>
                        <td>{l.motivo}</td>
                        <td>{l.solucao}</td>
                        <td style={{ textAlign: "center" }}>{l.conclusao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
