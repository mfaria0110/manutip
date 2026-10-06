import { useEffect, useState } from "react";
import { apiCategoriasMaterial, apiCidades, apiPrefeituras, relatorioPontosAtendidos } from "../api";
import logoSelles from "../assets/logo-selles.png";

function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function numeroOuTraco(v) {
  return v ? v.toString().replace(/\.0$/, "") : "—";
}

// Abreviações pra caber mais colunas na largura impressa — só muda o
// rótulo exibido, o código da categoria continua o mesmo.
const ABREVIACOES = {
  CONECTOR: "Conx",
  ISOLADOR: "Isol",
  CONDUTOR: "Cond",
  LAMPADA: "Lamp",
};

// Essas categorias entram somadas em Outros — viram colunas "visíveis" a
// menos na tabela, sem perder o valor lançado.
const CATEGORIAS_MESCLADAS_EM_OUTROS = ["ISOLANTES", "BRACO", "FERRAGENS", "ISOLADOR", "POSTE"];

// Lâmpada vira coluna própria (antes de Pot.(W)); as demais seguem esta ordem fixa.
const ORDEM_CATEGORIAS = ["RELE", "BASE", "CONDUTOR", "CONECTOR", "LUMINARIA", "OUTROS", "REFLETOR"];

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

  const categoriaLampada = categorias.find((c) => c.codigo === "LAMPADA");
  const categoriasVisiveis = categorias
    .filter((c) => !CATEGORIAS_MESCLADAS_EM_OUTROS.includes(c.codigo) && c.codigo !== "LAMPADA")
    .sort((a, b) => ORDEM_CATEGORIAS.indexOf(a.codigo) - ORDEM_CATEGORIAS.indexOf(b.codigo));

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
