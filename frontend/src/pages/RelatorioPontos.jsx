import { useEffect, useState } from "react";
import {
  apiCategoriasMaterial,
  apiCidades,
  apiPrefeituras,
  baixarRelatorioExcel,
  relatorioPontosAtendidos,
} from "../api";
import logoSelles from "../assets/logo-selles.png";
import { formatarData } from "../formatos";
import { ABREVIACOES, CATEGORIAS_MESCLADAS_EM_OUTROS, colunasDoRelatorio } from "../relatorioColunas";

function numeroOuTraco(v) {
  return v ? v.toString().replace(/\.0$/, "") : "—";
}

export default function RelatorioPontos() {
  const [prefeituras, setPrefeituras] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [categorias, setCategorias] = useState([]);
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
    apiCategoriasMaterial.listar().then(setCategorias);
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

  const { categoriaLampada, categoriasVisiveis } = colunasDoRelatorio(categorias);

  // Nome sugerido ao salvar o Excel: Pontos_atendidos_<prefeitura>_<início>_a_<fim>.
  const nomeBase = `Pontos_atendidos_${(prefeitura?.sigla || prefeitura?.nome || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_")}_${formatarData(dataInicio).replace(/\//g, "-")}_a_${formatarData(dataFim).replace(/\//g, "-")}`;

  async function exportarExcel() {
    setExportando(true);
    setErro("");
    try {
      await baixarRelatorioExcel("pontos-atendidos", prefeituraId, dataInicio, dataFim, `${nomeBase}.xlsx`);
    } catch (err) {
      setErro(err.message);
    } finally {
      setExportando(false);
    }
  }

  // Outros soma com as categorias mescladas; as demais usam o próprio valor.
  function valorCategoria(linha, codigo) {
    const base = Number(linha.por_categoria?.[codigo] || 0);
    if (codigo === "OUTROS") {
      return CATEGORIAS_MESCLADAS_EM_OUTROS.reduce(
        (acc, mesclada) => acc + Number(linha.por_categoria?.[mesclada] || 0),
        base
      );
    }
    return base;
  }

  // Cond mostra quantidade-descrição em vez de só a soma numérica.
  const TEXTO_POR_CATEGORIA = {
    CONDUTOR: (l) => l.condutores || "—",
  };

  const totalPontos = (linhas || []).reduce((acc, l) => acc + Number(l.pontos || 0), 0);
  const totalPorCategoria = (linhas || []).reduce((acc, l) => {
    categoriasVisiveis.forEach((c) => {
      acc[c.codigo] = (acc[c.codigo] || 0) + valorCategoria(l, c.codigo);
    });
    return acc;
  }, {});

  return (
    <>
      <header className="topbar no-print">
        <h1>Relatório de pontos atendidos</h1>
      </header>

      <div className="content">
        <div className="card no-print">
          <form onSubmit={gerar} className="form-grid">
            <div className="form-field" style={{ "--span": 4 }}>
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
                RELATÓRIO DE PONTOS ATENDIDOS: {formatarData(dataInicio)} A {formatarData(dataFim)}
              </div>
            </div>

            {linhas.length === 0 ? (
              <div className="empty-state">Nenhuma execução encontrada no período.</div>
            ) : (
              <table className="tabela-relatorio">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Data</th>
                    <th>Bairro</th>
                    <th>Logradouro</th>
                    {categoriaLampada && <th style={{ textAlign: "center" }}>Lamp</th>}
                    <th>Pot.(W)</th>
                    {categoriasVisiveis.map((c) => (
                      <th key={c.codigo} style={{ textAlign: "center" }}>
                        {ABREVIACOES[c.codigo] || c.nome}
                      </th>
                    ))}
                    <th>Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i}>
                      <td>{l.codigo_reclamacao}</td>
                      <td>{formatarData(l.data)}</td>
                      <td>{l.bairro}</td>
                      <td>{l.logradouro}</td>
                      {categoriaLampada && (
                        <td style={{ textAlign: "center", whiteSpace: "normal", wordBreak: "break-word", maxWidth: 90 }}>
                          {l.lampadas_tipo || "—"}
                        </td>
                      )}
                      <td style={{ whiteSpace: "normal", wordBreak: "break-word", maxWidth: 90 }}>
                        {l.luminarias_w || "—"}
                      </td>
                      {categoriasVisiveis.map((c) => (
                        <td
                          key={c.codigo}
                          style={
                            TEXTO_POR_CATEGORIA[c.codigo]
                              ? { textAlign: "center", whiteSpace: "normal", wordBreak: "break-word", maxWidth: 90 }
                              : { textAlign: "center" }
                          }
                        >
                          {TEXTO_POR_CATEGORIA[c.codigo]
                            ? TEXTO_POR_CATEGORIA[c.codigo](l)
                            : numeroOuTraco(valorCategoria(l, c.codigo))}
                        </td>
                      ))}
                      <td style={{ textAlign: "center" }}>{numeroOuTraco(l.pontos)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={categoriaLampada ? 6 : 5}>
                      <strong>Totais</strong>
                    </td>
                    {categoriasVisiveis.map((c) => (
                      <td key={c.codigo} style={{ textAlign: "center" }}>
                        <strong>{TEXTO_POR_CATEGORIA[c.codigo] ? "—" : numeroOuTraco(totalPorCategoria[c.codigo])}</strong>
                      </td>
                    ))}
                    <td style={{ textAlign: "center" }}>
                      <strong>{numeroOuTraco(totalPontos)}</strong>
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
