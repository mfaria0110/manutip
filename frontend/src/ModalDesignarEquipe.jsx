import { useEffect, useMemo, useState } from "react";
import { apiCategoriasMaterial, apiDesignacoes, apiEquipesDia, apiReclamacoes, apiVeiculos } from "./api";
import logoSelles from "./assets/logo-selles.png";
import ModalNovaEquipe from "./ModalNovaEquipe";
import { formatarData, hojeLocal } from "./formatos";
import { ABREVIACOES, colunasDoRelatorio } from "./relatorioColunas";

// Reclamações que ainda podem ser designadas (espelha STATUS_DESIGNAVEIS do backend).
const STATUS_DESIGNAVEIS = ["ABERTA", "EM_ANDAMENTO"];

/** Roteiro do dia: lista as reclamações abertas da prefeitura e, ao marcar
 * uma, atribui a ela a equipe escolhida no topo. Desmarcar tira a equipe e
 * libera a reclamação para outra. Salva em /api/designacoes. */
// onFechar(salvou): salvou=true quando o roteiro foi gravado (a lista de reclamações precisa recarregar).
export default function ModalDesignarEquipe({ prefeitura, nomeBairro, nomeCidade, onFechar }) {
  const [data, setData] = useState(hojeLocal());
  const [equipes, setEquipes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [categorias, setCategorias] = useState([]); // colunas de material do relatório impresso
  const [reclamacoes, setReclamacoes] = useState([]);
  const [equipeId, setEquipeId] = useState(""); // equipe que será atribuída ao marcar
  // reclamacao_id -> equipe_dia_id (o que está atribuído no momento, ainda não salvo)
  const [atribuicoes, setAtribuicoes] = useState(new Map());
  // O que está gravado no servidor (pra saber se há alterações não salvas).
  const [salvas, setSalvas] = useState(new Map());
  const [salvouAlgo, setSalvouAlgo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [novaEquipeAberta, setNovaEquipeAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("TODAS"); // TODAS | SEM_EQUIPE | COM_EQUIPE
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    Promise.all([
      apiEquipesDia.listar(),
      apiVeiculos.listar(),
      apiReclamacoes.listar(`?prefeitura_id=${prefeitura.id}`),
      apiCategoriasMaterial.listar(),
    ])
      .then(([eqs, vs, recs, cats]) => {
        setCategorias(cats);
        setEquipes(eqs);
        setVeiculos(vs);
        // Aberta com execução lançada ("Já atendida") não precisa mais de equipe.
        setReclamacoes(recs.filter((r) => STATUS_DESIGNAVEIS.includes(r.status) && !r.tem_execucao));
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [prefeitura.id]);

  // O que já está designado na data escolhida (ao trocar a data, recarrega).
  useEffect(() => {
    if (!data) return;
    apiDesignacoes
      .listar(`?data=${data}&prefeitura_id=${prefeitura.id}`)
      .then((lista) => {
        const mapa = new Map(lista.map((d) => [d.reclamacao_id, d.equipe_dia_id]));
        setAtribuicoes(mapa);
        setSalvas(new Map(mapa));
        setAviso("");
      })
      .catch((e) => setErro(e.message));
  }, [data, prefeitura.id]);

  // Só equipes ativas no seletor, em ordem de nome.
  const equipesOrdenadas = equipes
    .filter((e) => e.ativa !== false)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  const nomeVeiculo = (id) => {
    const v = veiculos.find((x) => x.id === id);
    return v ? `${v.placa} ${v.modelo}` : "sem viatura";
  };
  const rotuloEquipe = (eq) => {
    const membros = eq.membros.map((m) => m.funcionario_nome).join(", ") || "sem membros";
    return `${eq.nome || "Equipe"} — ${nomeVeiculo(eq.veiculo_id)} — ${membros}`;
  };
  // Composição curta pra coluna da lista: nome, viatura e membros.
  const composicaoEquipe = (id) => {
    const eq = equipes.find((e) => e.id === id);
    if (!eq) return "—";
    const membros = eq.membros.map((m) => m.funcionario_nome).join(", ") || "sem membros";
    return `${eq.nome || "Equipe"} — ${nomeVeiculo(eq.veiculo_id)} — ${membros}`;
  };

  const nomeEquipe = (id) => equipes.find((e) => e.id === id)?.nome || "Equipe";
  // Partes da equipe pro cabeçalho do relatório/mensagem.
  const detalhesEquipe = (id) => {
    const eq = equipes.find((e) => e.id === id);
    return {
      nome: eq?.nome || "Equipe",
      viatura: eq ? nomeVeiculo(eq.veiculo_id) : "—",
      membros: eq?.membros.map((m) => m.funcionario_nome).join(", ") || "sem membros",
      celular: eq?.celular || "",
    };
  };

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return reclamacoes.filter((r) => {
      const atribuida = atribuicoes.has(r.id);
      if (situacao === "SEM_EQUIPE" && atribuida) return false;
      if (situacao === "COM_EQUIPE" && !atribuida) return false;
      if (situacao.startsWith("EQ:") && atribuicoes.get(r.id) !== situacao.slice(3)) return false;
      if (!termo) return true;
      // A busca de texto também olha a equipe atribuída (nome, viatura e membros).
      const equipeAtribuida = atribuicoes.has(r.id) ? composicaoEquipe(atribuicoes.get(r.id)) : "";
      const texto = [r.codigo, r.nome_reclamante, r.logradouro, r.numero, nomeBairro(r.bairro_id), equipeAtribuida]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return texto.includes(termo);
    });
  }, [reclamacoes, atribuicoes, busca, situacao, nomeBairro]);

  // Equipes que já têm alguma reclamação atribuída — viram opções do filtro.
  const equipesComReclamacao = equipes.filter((eq) => [...atribuicoes.values()].includes(eq.id));

  // Imprimir/WhatsApp só valem para a lista de UMA equipe (tudo o que está
  // listado é da mesma equipe) e com a seleção já salva.
  const equipesNaLista = new Set(visiveis.map((r) => atribuicoes.get(r.id) || ""));
  const equipeDaLista = equipesNaLista.size === 1 && !equipesNaLista.has("") ? [...equipesNaLista][0] : "";
  const idsAbertas = new Set(reclamacoes.map((r) => r.id));
  const sujo =
    [...atribuicoes.entries()].some(([rid, eid]) => idsAbertas.has(rid) && salvas.get(rid) !== eid) ||
    [...salvas.keys()].some((rid) => idsAbertas.has(rid) && !atribuicoes.has(rid));
  const celularDaEquipe = equipeDaLista ? equipes.find((e) => e.id === equipeDaLista)?.celular || "" : "";
  const podeExportar = visiveis.length > 0 && !!equipeDaLista && !sujo;
  const motivoSemExportar =
    visiveis.length === 0
      ? "Não há reclamações listadas para imprimir ou enviar."
      : !equipeDaLista
        ? 'Antes de imprimir ou enviar, filtre a lista por uma única equipe (seletor "Por equipe").'
        : sujo
          ? "Salve a seleção antes de imprimir ou enviar."
          : "";

  // Os botões ficam clicáveis (só esmaecidos) pra poder avisar o motivo.
  function aoExportar(acao) {
    if (!podeExportar) {
      setAviso("");
      setErro(motivoSemExportar);
      return;
    }
    setErro("");
    acao();
  }

  const todasVisiveisAtribuidas = visiveis.length > 0 && visiveis.every((r) => atribuicoes.has(r.id));

  function alternar(r) {
    setAtribuicoes((prev) => {
      const novo = new Map(prev);
      if (novo.has(r.id)) novo.delete(r.id);
      else novo.set(r.id, equipeId);
      return novo;
    });
  }

  function alternarVisiveis() {
    setAtribuicoes((prev) => {
      const novo = new Map(prev);
      if (todasVisiveisAtribuidas) visiveis.forEach((r) => novo.delete(r.id));
      else visiveis.forEach((r) => !novo.has(r.id) && novo.set(r.id, equipeId));
      return novo;
    });
  }

  const escapar = (t) =>
    String(t ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // Imprime (ou salva em PDF pelo diálogo do navegador) a lista da equipe, no
  // mesmo modelo do Relatório de Pontos Atendidos (cabeçalho com logo, cidade
  // e título + tabela com totais). Usa um iframe invisível na própria página
  // (e não window.open), que não é barrado como pop-up, e copia os estilos do
  // app pra herdar o visual do relatório.
  function imprimir() {
    const quadro = document.createElement("iframe");
    quadro.setAttribute("aria-hidden", "true");
    quadro.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(quadro);
    const janela = quadro.contentWindow;
    const doc = janela.document;
    const logo = new URL(logoSelles, window.location.href).href;
    const eq = detalhesEquipe(equipeDaLista);
    const cidade = nomeCidade(prefeitura.cidade_id);
    // Nome sugerido ao salvar em PDF (o navegador usa o título da página):
    // Reclamação_<nome da equipe>_<data>, sem caracteres proibidos em arquivo.
    const nomeArquivo = `Reclamação_${eq.nome}_${formatarData(data).replace(/\//g, "-")}`
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_");
    // Mesmas colunas do Relatório de Pontos Atendidos (sem Pontos e sem Ponto de
    // referência); Lamp até Refletor saem em branco e com borda, pra preencher
    // à mão em campo.
    const { categoriaLampada, categoriasVisiveis } = colunasDoRelatorio(categorias);
    const vazio = '<td class="caixa" style="height:26px"></td>';
    const celulasVazias = (categoriaLampada ? 1 : 0) + 1 + categoriasVisiveis.length;
    const linhas = visiveis
      .map(
        (r) => `<tr>
          <td>${escapar(r.codigo)}</td>
          <td>${escapar(formatarData(r.data_reclamacao))}</td>
          <td>${escapar(nomeBairro(r.bairro_id))}</td>
          <td>${escapar([r.logradouro || "—", r.numero ? `Nº ${r.numero}` : ""].filter(Boolean).join(", "))}</td>
          ${vazio.repeat(celulasVazias)}
        </tr>`
      )
      .join("");
    const cabecalhoCategorias = categoriasVisiveis
      .map((c) => `<th class="caixa" style="text-align:center">${escapar(ABREVIACOES[c.codigo] || c.nome)}</th>`)
      .join("");

    doc.open();
    doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>${escapar(nomeArquivo)}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { background: #fff; margin: 0; padding: 4mm; }
        .tabela-relatorio .caixa { border: 1px solid #444; }
        .roteiro-equipe { border: 1px solid var(--border); border-radius: 10px; padding: 8px 18px; margin-bottom: 14px; font-size: 12.5px; line-height: 1.6; }
      </style></head><body>
      <div class="relatorio-cabecalho">
        <img src="${logo}" alt="Selles">
        <div class="relatorio-cidade">${escapar(cidade && cidade !== "—" ? cidade : prefeitura.nome)}</div>
        <div class="relatorio-titulo">ROTEIRO DO DIA: ${escapar(formatarData(data))}</div>
      </div>
      <div class="roteiro-equipe">
        <div><strong>Equipe:</strong> ${escapar(eq.nome)}</div>
        <div><strong>Viatura:</strong> ${escapar(eq.viatura)}</div>
        <div><strong>Componentes:</strong> ${escapar(eq.membros)}</div>
      </div>
      <table class="tabela-relatorio">
        <thead><tr>
          <th>Código</th><th>Data_Rec</th><th>Bairro</th><th>Logradouro</th>
          ${categoriaLampada ? '<th class="caixa" style="text-align:center">Lamp</th>' : ""}
          <th class="caixa">Pot.(W)</th>
          ${cabecalhoCategorias}
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      </body></html>`);
    doc.close();

    // Copia os estilos do app (links e <style>) pro quadro e espera carregar
    // (estilos + logo) antes de abrir o diálogo; limita a espera a 3 s.
    const esperas = [];
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((no) => {
      if (no.tagName === "LINK") {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        esperas.push(
          new Promise((resolve) => {
            link.onload = resolve;
            link.onerror = resolve;
          })
        );
        link.href = no.href;
        doc.head.appendChild(link);
      } else {
        doc.head.appendChild(no.cloneNode(true));
      }
    });
    const img = doc.querySelector("img");
    if (img && !img.complete) {
      esperas.push(
        new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        })
      );
    }
    Promise.race([Promise.all(esperas), new Promise((resolve) => setTimeout(resolve, 3000))]).then(() => {
      // Chrome/Edge sugerem o título da página principal como nome do PDF:
      // troca enquanto o diálogo está aberto e restaura depois.
      const tituloOriginal = document.title;
      document.title = nomeArquivo;
      const restaurar = () => {
        document.title = tituloOriginal;
        window.removeEventListener("afterprint", restaurar);
      };
      window.addEventListener("afterprint", restaurar);
      janela.focus();
      janela.print();
      setTimeout(() => {
        restaurar();
        quadro.remove();
      }, 60000);
    });
  }

  // O WhatsApp não aceita anexar arquivo por link: monta o roteiro em texto
  // (equipe, viatura e componentes no cabeçalho) e abre o WhatsApp com a
  // mensagem pronta — o usuário escolhe o contato. Respeita o filtro.
  function enviarWhatsApp() {
    const eq = detalhesEquipe(equipeDaLista);
    const linhas = [
      `*Roteiro do dia ${formatarData(data)}*`,
      prefeitura.nome,
      `*Equipe:* ${eq.nome}`,
      `*Viatura:* ${eq.viatura}`,
      `*Componentes:* ${eq.membros}`,
      "",
    ];
    visiveis.forEach((r, i) => {
      const endereco = [r.logradouro, r.numero].filter(Boolean).join(", ") || "endereço não informado";
      const bairro = nomeBairro(r.bairro_id);
      linhas.push(`${i + 1}. ${r.codigo} — ${endereco}${bairro && bairro !== "—" ? ` — ${bairro}` : ""}`);
      if (r.ponto_referencia) linhas.push(`    Ref.: ${r.ponto_referencia}`);
    });
    // Equipe com celular cadastrado: abre a conversa direto com ela (DDI 55 +
    // DDD + número). Sem celular, abre o WhatsApp pra escolher o contato.
    const digitos = eq.celular.replace(/\D/g, "");
    const base = digitos.length === 11 ? `https://wa.me/55${digitos}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(linhas.join("\n"))}`, "_blank", "noopener");
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      const itens = [...atribuicoes.entries()]
        .filter(([rid]) => idsAbertas.has(rid))
        .map(([reclamacao_id, equipe_dia_id]) => ({ reclamacao_id, equipe_dia_id }));
      await apiDesignacoes.salvarDoDia(prefeitura.id, data, itens);
      // Fica aberto pra poder imprimir/enviar em seguida; a lista de trás
      // recarrega ao fechar (onFechar(true)).
      setSalvas(new Map(itens.map((i) => [i.reclamacao_id, i.equipe_dia_id])));
      setSalvouAlgo(true);
      setAviso("Roteiro salvo.");
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const semEquipeEscolhida = !equipeId;

  return (
    <div className="modal-overlay">
      <div className="modal modal-compacto" style={{ width: 1200, maxWidth: "95vw" }}>
        <h2>Designar reclamações às equipes</h2>
        <div className="form-grid">
          <div className="form-field" style={{ "--span": 4 }}>
            <label>Prefeitura</label>
            <input type="text" disabled value={prefeitura.nome} style={{ background: "var(--bg-page)" }} />
          </div>
          <div className="form-field" style={{ "--span": 2 }}>
            <label>Data Roteiro</label>
            <input
              type="date"
              required
              value={data}
              onChange={(e) => setData(e.target.value)}
              style={{ width: 140, textAlign: "center" }}
            />
          </div>
          <div className="form-field" style={{ "--span": 6 }}>
            <label>Equipe a atribuir às reclamações marcadas</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select style={{ flex: 1, minWidth: 0 }} value={equipeId} onChange={(e) => setEquipeId(e.target.value)}>
                <option value="">{equipesOrdenadas.length ? "Selecione..." : "Nenhuma equipe cadastrada"}</option>
                {equipesOrdenadas.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {rotuloEquipe(eq)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setNovaEquipeAberta(true)}
                title="Cadastrar nova equipe (troca de carro ou de membro)"
                style={{ fontWeight: 700, fontSize: 15, padding: "0 10px", height: 28, flexShrink: 0 }}
              >
                <i className="ti ti-plus" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Mesmas 12 colunas do cabeçalho: filtro na largura da Prefeitura, seletor na da Data. */}
        <div className="form-grid" style={{ marginTop: 14, alignItems: "center" }}>
          <div className="filtro-wrap" style={{ gridColumn: "span 4", maxWidth: "none", minWidth: 0, marginBottom: 0 }}>
            <i className="ti ti-search" aria-hidden="true" />
            <input
              placeholder="Filtrar por código, reclamante, logradouro, bairro ou equipe..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            style={{ gridColumn: "span 2", width: "100%", height: 30, margin: 0 }}
          >
            <option value="TODAS">Todas</option>
            <option value="SEM_EQUIPE">Sem equipe</option>
            <option value="COM_EQUIPE">Com equipe</option>
            {equipesComReclamacao.length > 0 && (
              <optgroup label="Por equipe">
                {equipesComReclamacao.map((eq) => (
                  <option key={eq.id} value={`EQ:${eq.id}`}>
                    {eq.nome || "Equipe"}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <span style={{ gridColumn: "span 6", fontSize: 13, color: "var(--text-secondary)" }}>
            {atribuicoes.size} de {reclamacoes.length} reclamações com equipe
            {semEquipeEscolhida ? " — escolha uma equipe para poder marcar" : ""}
          </span>
        </div>

        <div style={{ marginTop: 8 }}>
          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : reclamacoes.length === 0 ? (
            <div className="empty-state">Nenhuma reclamação aberta nesta prefeitura.</div>
          ) : visiveis.length === 0 ? (
            <div className="empty-state">Nenhuma reclamação encontrada com esse filtro.</div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              <table className="tabela-compacta">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={todasVisiveisAtribuidas}
                        disabled={semEquipeEscolhida && !todasVisiveisAtribuidas}
                        onChange={alternarVisiveis}
                        title="Marcar/desmarcar todas as listadas"
                      />
                    </th>
                    <th style={{ width: 130 }}>Código</th>
                    <th style={{ width: 80 }}>Data_Rec</th>
                    <th>Reclamante</th>
                    <th>Logradouro</th>
                    <th style={{ width: 50 }}>Núm.</th>
                    <th>Bairro</th>
                    <th>Equipe / viatura / componentes</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((r) => {
                    const atribuida = atribuicoes.get(r.id);
                    return (
                      <tr key={r.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={atribuicoes.has(r.id)}
                            disabled={semEquipeEscolhida && !atribuicoes.has(r.id)}
                            onChange={() => alternar(r)}
                            title={atribuicoes.has(r.id) ? "Desmarcar para liberar a reclamação" : "Atribuir a equipe escolhida"}
                          />
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{r.codigo}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{formatarData(r.data_reclamacao)}</td>
                        <td>{r.nome_reclamante}</td>
                        <td>{r.logradouro || "—"}</td>
                        <td>{r.numero || "—"}</td>
                        <td>{nomeBairro(r.bairro_id)}</td>
                        <td
                          title={atribuida ? composicaoEquipe(atribuida) : undefined}
                          style={{ maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {atribuida ? composicaoEquipe(atribuida) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {erro && <p className="erro-msg">{erro}</p>}
        {aviso && <p style={{ color: "var(--success, #15803d)", fontSize: 13, margin: "8px 0 0" }}>{aviso}</p>}

        <ModalNovaEquipe
          aberto={novaEquipeAberta}
          onFechar={() => setNovaEquipeAberta(false)}
          onCriada={(nova) => {
            // Já entra na lista e vem selecionada, pronta pra designar.
            setEquipes((prev) => [nova, ...prev]);
            setEquipeId(nova.id);
            setNovaEquipeAberta(false);
          }}
        />
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() => aoExportar(imprimir)}
            aria-disabled={!podeExportar}
            title={motivoSemExportar || "Imprimir ou salvar em PDF a lista da equipe"}
            style={{ marginRight: "auto", opacity: podeExportar ? 1 : 0.55 }}
          >
            <i className="ti ti-printer" aria-hidden="true" style={{ marginRight: 6 }} />
            Imprimir
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => aoExportar(enviarWhatsApp)}
            aria-disabled={!podeExportar}
            title={
              motivoSemExportar ||
              (celularDaEquipe
                ? `Enviar o roteiro para ${celularDaEquipe} (celular da equipe)`
                : "Abrir o WhatsApp com o roteiro da equipe em texto")
            }
            style={{ color: "#15803d", opacity: podeExportar ? 1 : 0.55 }}
          >
            <i className="ti ti-brand-whatsapp" aria-hidden="true" style={{ marginRight: 6 }} />
            WhatsApp
          </button>
          <button type="button" className="btn" onClick={() => onFechar(salvouAlgo)} disabled={salvando}>
            {salvouAlgo ? "Fechar" : "Cancelar"}
          </button>
          <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando || carregando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
