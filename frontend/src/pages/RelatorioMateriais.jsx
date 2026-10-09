import { useEffect, useState } from "react";
import { apiCidades, apiPrefeituras, baixarRelatorioExcel, relatorioMateriaisGastos } from "../api";
import logoSelles from "../assets/logo-selles.png";
import { formatarData } from "../formatos";

function numero(v) {
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

// Mesmo modelo do Relatório de Pontos Atendidos (cabeçalho com logo, cidade e
// período), mas lista os materiais instalados com a quantidade somada no
// período — não quebra por reclamação.
export default function RelatorioMateriais() {
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
      setLinhas(await relatorioMateriaisGastos(prefeituraId, dataInicio, dataFim));
    } catch (err) {
      setErro(err.message);
      setLinhas(null);
    } finally {
      setCarregando(false);
    }
  }

  // Nome sugerido ao salvar (PDF ou Excel): Materiais_gastos_<prefeitura>_<início>_a_<fim>.
  const nomeBase = `Materiais_gastos_${(prefeitura?.sigla || prefeitura?.nome || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_")}_${formatarData(dataInicio).replace(/\//g, "-")}_a_${formatarData(dataFim).replace(/\//g, "-")}`;

  async function exportarExcel() {
    setExportando(true);
    setErro("");
    try {
      await baixarRelatorioExcel("materiais-gastos", prefeituraId, dataInicio, dataFim, `${nomeBase}.xlsx`);
    } catch (err) {
      setErro(err.message);
    } finally {
      setExportando(false);
    }
  }

  // Imprimir/PDF: o navegador sugere o título da página como nome do arquivo.
  function imprimir() {
    const tituloOriginal = document.title;
    document.title = nomeBase;
    const restaurar = () => {
      document.title = tituloOriginal;
      window.removeEventListener("afterprint", restaurar);
    };
    window.addEventListener("afterprint", restaurar);
    window.print();
  }

  return (
    <>
      <header className="topbar no-print">
        <h1>Relatório de materiais gastos</h1>
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
              <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button type="button" className="btn btn-primary" onClick={imprimir}>
                  <i className="ti ti-printer" aria-hidden="true" style={{ marginRight: 6 }} />
                  Imprimir
                </button>
                <button type="button" className="btn" onClick={exportarExcel} disabled={exportando}>
                  <i className="ti ti-file-spreadsheet" aria-hidden="true" style={{ marginRight: 6 }} />
                  {exportando ? "Gerando..." : "Exportar Excel"}
                </button>
              </div>
            )}

            <div className="relatorio-cabecalho">
              <img src={logoSelles} alt="Selles" />
              <div className="relatorio-cidade">{nomeCidade(prefeitura?.cidade_id) || "—"}</div>
              <div className="relatorio-titulo">
                RELATÓRIO DE MATERIAIS GASTOS: {formatarData(dataInicio)} A {formatarData(dataFim)}
              </div>
            </div>

            {linhas.length === 0 ? (
              <div className="empty-state">Nenhum material lançado no período.</div>
            ) : (
              <table className="tabela-relatorio">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Material</th>
                    <th>Categoria</th>
                    <th style={{ textAlign: "center" }}>Unid.</th>
                    <th style={{ textAlign: "center" }}>Qtd. instalada</th>
                    <th style={{ textAlign: "center" }}>Qtd. retirada</th>
                    <th style={{ textAlign: "center" }}>Qtd. substituída</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i}>
                      <td>{l.codigo}</td>
                      <td>{l.material}</td>
                      <td>{l.categoria}</td>
                      <td style={{ textAlign: "center" }}>{l.unidade}</td>
                      <td style={{ textAlign: "center" }}>{numero(l.quantidade)}</td>
                      <td style={{ textAlign: "center" }}>{numero(l.quantidade_retirada)}</td>
                      <td style={{ textAlign: "center" }}>{numero(l.quantidade_substituida)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}
