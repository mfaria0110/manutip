import { Fragment, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAcesso } from "../AcessoContext";
import ComboCriavel from "../ComboCriavel";
import ConfirmDialog from "../ConfirmDialog";
import ModalNovaEquipe from "../ModalNovaEquipe";
import ModalNovoMaterial from "../ModalNovoMaterial";
import {
  apiBairros,
  apiCidades,
  apiEquipesDia,
  apiExecucoesReclamacao,
  apiItensExecucao,
  apiMateriais,
  apiPotenciasLampada,
  apiReclamacoes,
  apiTiposLampada,
  reabrirReclamacao,
} from "../api";

const LABEL_STATUS = {
  ABERTA: "Aberta",
  VALIDADA: "Validada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};

const rotuloCampo = { fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" };

function novoItem() {
  return {
    material_id: "",
    quantidade_instalada: 0,
    quantidade_retirada: 0,
    quantidade_substituida: 0,
    tipo_lampada_id: "",
    potencia_lampada_id: "",
  };
}

// total_pontos do item: cada quantidade (instalada/retirada/substituída)
// vezes o peso em pontos do material naquele tipo de movimento, somadas.
function totalPontosItem(item, mat) {
  const qi = Number(mat?.qde_pontos_inst) || 0;
  const qr = Number(mat?.qde_pontos_ret) || 0;
  const qs = Number(mat?.qde_pontos_subst) || 0;
  return (
    (Number(item.quantidade_instalada) || 0) * qi +
    (Number(item.quantidade_retirada) || 0) * qr +
    (Number(item.quantidade_substituida) || 0) * qs
  );
}

export default function ExecucaoReclamacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ehAdmin } = useAcesso();

  const [reclamacao, setReclamacao] = useState(null);
  const [execucoes, setExecucoes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [equipes, setEquipes] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [tiposLampada, setTiposLampada] = useState([]);
  const [potenciasLampada, setPotenciasLampada] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const [formAberto, setFormAberto] = useState(false);
  const [execucaoEditando, setExecucaoEditando] = useState(null); // null = criando nova
  const [dataExecucao, setDataExecucao] = useState("");
  const [equipeId, setEquipeId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState([novoItem()]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modalEquipeAberto, setModalEquipeAberto] = useState(false);
  const [modalMaterialIdx, setModalMaterialIdx] = useState(null); // índice do item que pediu o material novo

  const [itemExcluindo, setItemExcluindo] = useState(null);
  const [apagandoItem, setApagandoItem] = useState(false);
  const [validando, setValidando] = useState(false);

  const [modalReabrirAberto, setModalReabrirAberto] = useState(false);
  const [reabrirUsername, setReabrirUsername] = useState("");
  const [reabrirSenha, setReabrirSenha] = useState("");
  const [erroReabrir, setErroReabrir] = useState("");
  const [reabrindo, setReabrindo] = useState(false);

  function carregar() {
    setCarregando(true);
    setErroLista("");
    Promise.all([apiReclamacoes.obter(id), apiExecucoesReclamacao.listar(`?reclamacao_id=${id}`)])
      .then(([rec, execs]) => {
        setReclamacao(rec);
        setExecucoes(execs);
      })
      .catch((e) => setErroLista(e.message))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    apiMateriais.listar().then(setMateriais);
    apiEquipesDia.listar().then(setEquipes);
    apiBairros.listar().then(setBairros);
    apiCidades.listar().then(setCidades);
    apiTiposLampada.listar().then(setTiposLampada);
    apiPotenciasLampada.listar().then(setPotenciasLampada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const nomeBairro = (bid) => bairros.find((b) => b.id === bid)?.nome || "—";
  const nomeCidade = (cid) => cidades.find((c) => c.id === cid)?.nome || "—";
  const materialPorId = (mid) => materiais.find((m) => m.id === mid);
  const nomeTipoLampada = (tid) => tiposLampada.find((t) => t.id === tid)?.nome || "—";
  const labelPotenciaLampada = (pid) => {
    const p = potenciasLampada.find((x) => x.id === pid);
    return p ? `${p.valor_w}W` : "—";
  };
  const opcoesTiposLampada = tiposLampada.map((t) => ({ value: t.id, label: t.nome }));
  const opcoesPotenciasLampada = potenciasLampada.map((p) => ({ value: p.id, label: `${p.valor_w} W` }));
  const nomeEquipe = (eid) => {
    const eq = equipes.find((e) => e.id === eid);
    if (!eq) return "—";
    const membros = eq.membros.map((m) => m.funcionario_nome).join(", ");
    return `${eq.nome || eq.data} — ${membros || "sem membros"}`;
  };
  const composicaoEquipe = (eid) => {
    const eq = equipes.find((e) => e.id === eid);
    if (!eq || eq.membros.length === 0) return "Sem membros cadastrados.";
    return eq.membros.map((m) => (m.papel ? `${m.papel}: ${m.funcionario_nome}` : m.funcionario_nome)).join("\n");
  };

  function abrirNovaExecucao() {
    setExecucaoEditando(null);
    setDataExecucao(new Date().toISOString().slice(0, 10));
    setEquipeId("");
    setObservacoes("");
    setItens([novoItem()]);
    setErro("");
    setFormAberto(true);
  }

  // Edita a execução inteira (data/equipe/observações + todos os itens) —
  // aberta a partir do lápis de qualquer material daquela execução, já que
  // às vezes o que precisa corrigir é a data ou a equipe, não só o item.
  function abrirEdicaoExecucao(ex) {
    setExecucaoEditando(ex);
    setDataExecucao(ex.data_execucao);
    setEquipeId(ex.equipe_dia_id || "");
    setObservacoes(ex.observacoes || "");
    setItens(
      ex.itens.length > 0
        ? ex.itens.map((it) => ({
            material_id: it.material_id,
            quantidade_instalada: it.quantidade_instalada,
            quantidade_retirada: it.quantidade_retirada,
            quantidade_substituida: it.quantidade_substituida,
            tipo_lampada_id: it.tipo_lampada_id || "",
            potencia_lampada_id: it.potencia_lampada_id || "",
          }))
        : [novoItem()]
    );
    setErro("");
    setFormAberto(true);
  }

  function atualizarItem(idx, patch) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function adicionarItem() {
    setItens((prev) => [...prev, novoItem()]);
  }

  function removerItem(idx) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  function equipeCriada(nova) {
    setEquipes((prev) => [nova, ...prev]);
    setEquipeId(nova.id);
    setModalEquipeAberto(false);
  }

  function materialCriado(novo) {
    setMateriais((prev) => [...prev, novo]);
    selecionarMaterial(modalMaterialIdx, novo.id, novo);
    setModalMaterialIdx(null);
  }

  // Ao escolher um material de lâmpada, já pré-seleciona "LED" no tipo (se
  // o catálogo tiver), poupando um clique no caso mais comum.
  function selecionarMaterial(idx, materialId, materialObj) {
    const mat = materialObj || materiais.find((m) => m.id === materialId);
    const patch = { material_id: materialId };
    if (mat?.categoria === "LAMPADA") {
      const led = tiposLampada.find((t) => t.nome.toUpperCase() === "LED");
      if (led) patch.tipo_lampada_id = led.id;
    }
    atualizarItem(idx, patch);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const itensPayload = itens
        .filter((it) => it.material_id)
        .map((it) => ({
          material_id: it.material_id,
          quantidade_instalada: Number(it.quantidade_instalada) || 0,
          quantidade_retirada: Number(it.quantidade_retirada) || 0,
          quantidade_substituida: Number(it.quantidade_substituida) || 0,
          tipo_lampada_id: it.tipo_lampada_id || null,
          potencia_lampada_id: it.potencia_lampada_id || null,
        }));
      // pontos da execução não é mais digitado — o backend recalcula como a
      // soma do total_pontos de cada item (quantidade x peso em pontos do
      // material) sempre que os itens são salvos.
      if (execucaoEditando) {
        await apiExecucoesReclamacao.atualizar(execucaoEditando.id, {
          data_execucao: dataExecucao,
          equipe_dia_id: equipeId || null,
          observacoes: observacoes || null,
          itens: itensPayload,
        });
      } else {
        await apiExecucoesReclamacao.criar({
          reclamacao_id: id,
          data_execucao: dataExecucao,
          equipe_dia_id: equipeId || null,
          observacoes: observacoes || null,
          itens: itensPayload,
        });
      }
      setFormAberto(false);
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusaoItem() {
    setApagandoItem(true);
    setErroLista("");
    try {
      await apiItensExecucao.excluir(itemExcluindo.id);
      setItemExcluindo(null);
      carregar();
    } catch (err) {
      setErroLista(err.message);
      setItemExcluindo(null);
    } finally {
      setApagandoItem(false);
    }
  }

  async function validarLancamento() {
    setValidando(true);
    setErroLista("");
    try {
      const atualizado = await apiReclamacoes.atualizar(id, { status: "VALIDADA" });
      setReclamacao(atualizado);
    } catch (err) {
      setErroLista(err.message);
    } finally {
      setValidando(false);
    }
  }

  function abrirModalReabrir() {
    setReabrirUsername("");
    setReabrirSenha("");
    setErroReabrir("");
    setModalReabrirAberto(true);
  }

  async function confirmarReabrir(e) {
    e.preventDefault();
    setReabrindo(true);
    setErroReabrir("");
    try {
      const atualizado = await reabrirReclamacao(id, reabrirUsername, reabrirSenha);
      setReclamacao(atualizado);
      setModalReabrirAberto(false);
    } catch (err) {
      setErroReabrir(err.message);
    } finally {
      setReabrindo(false);
    }
  }

  if (carregando) {
    return (
      <>
        <header className="topbar">
          <h1>Execução</h1>
        </header>
        <div className="content">
          <div className="card empty-state">Carregando...</div>
        </div>
      </>
    );
  }

  if (!reclamacao) {
    return (
      <>
        <header className="topbar">
          <h1>Execução</h1>
        </header>
        <div className="content">
          <div className="card empty-state">{erroLista || "Reclamação não encontrada."}</div>
        </div>
      </>
    );
  }

  // Uma vez validada (ou além), a reclamação trava: Nova execução, editar e
  // excluir ficam desabilitados até um ADMIN reabrir com a própria senha.
  const bloqueado = reclamacao.status !== "ABERTA";

  // Agrupa por data + equipe — só abre um card novo quando a data ou a
  // equipe mudam; a equipe fica no cabeçalho do card, não repetida linha a
  // linha dentro da tabela.
  const gruposPorData = [];
  execucoes.forEach((ex) => {
    let grupo = gruposPorData.find((g) => g.data === ex.data_execucao && g.equipeId === (ex.equipe_dia_id || ""));
    if (!grupo) {
      grupo = { data: ex.data_execucao, equipeId: ex.equipe_dia_id || "", execucoes: [] };
      gruposPorData.push(grupo);
    }
    grupo.execucoes.push(ex);
  });

  // Total de pontos do formulário aberto — não é mais digitado, é a soma do
  // total_pontos de cada linha (recalculado pelo backend ao salvar).
  const totalPontosFormulario = itens.reduce(
    (acc, it) => acc + totalPontosItem(it, materialPorId(it.material_id)),
    0
  );

  return (
    <>
      <header className="topbar">
        <h1>Execução da reclamação</h1>
        <button className="btn" onClick={() => navigate("/reclamacoes")}>
          <i className="ti ti-arrow-left" aria-hidden="true" style={{ marginRight: 6 }} />
          Voltar
        </button>
      </header>

      <div className="content">
        <div className="card">
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}
          >
            <div>
              <h3 style={{ margin: "0 0 4px" }}>Reclamante: {reclamacao.nome_reclamante}</h3>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
                {reclamacao.logradouro || "—"}
                {reclamacao.numero ? `, ${reclamacao.numero}` : ""} — {nomeBairro(reclamacao.bairro_id)}, {nomeCidade(reclamacao.cidade_id)}
              </p>
              {reclamacao.ponto_referencia && (
                <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
                  Ponto de referência: {reclamacao.ponto_referencia}
                </p>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {bloqueado && (
                  <button
                    className="btn btn-ghost"
                    onClick={abrirModalReabrir}
                    title="Reabrir (requer senha de administrador)"
                  >
                    <i className="ti ti-lock-open" aria-hidden="true" />
                  </button>
                )}
                <span
                  className={`badge ${
                    ["CONCLUIDA", "VALIDADA"].includes(reclamacao.status) ? "badge-success" : "badge-muted"
                  }`}
                >
                  {LABEL_STATUS[reclamacao.status] || reclamacao.status}
                </span>
              </div>
              {reclamacao.status === "ABERTA" && execucoes.length > 0 && (
                <button className="btn btn-primary" onClick={validarLancamento} disabled={validando}>
                  {validando ? "Validando..." : "Validar lançamento"}
                </button>
              )}
            </div>
          </div>
        </div>

        {erroLista && <p className="erro-msg">{erroLista}</p>}

        <div
          className="table-header"
          style={{ marginTop: 20, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h3 style={{ margin: 0, fontSize: 15 }}>Execuções</h3>
          <button
            className="btn btn-primary"
            onClick={abrirNovaExecucao}
            disabled={bloqueado}
            title={bloqueado ? "Reabra a reclamação para lançar uma nova execução" : undefined}
          >
            <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 6 }} />
            Execução
          </button>
        </div>

        {execucoes.length === 0 ? (
          <div className="card empty-state">Nenhuma execução registrada ainda.</div>
        ) : (
          gruposPorData.map((grupo) => (
            <div className="card" key={`${grupo.data}|${grupo.equipeId}`} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <strong>
                  {grupo.data}
                  {grupo.equipeId ? ` — ${nomeEquipe(grupo.equipeId)}` : ""}
                </strong>
              </div>
              {grupo.execucoes.length === 1 && grupo.execucoes[0].observacoes && (
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                  {grupo.execucoes[0].observacoes}
                </p>
              )}
              {grupo.execucoes.some((ex) => ex.itens.length > 0) && (
                <table style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th style={{ textAlign: "center" }}>Qtd. Inst.</th>
                      <th style={{ textAlign: "center" }}>Qtd. Ret.</th>
                      <th style={{ textAlign: "center" }}>Qtd. Subst.</th>
                      <th style={{ textAlign: "center" }}>Pontos</th>
                      <th>Lâmpada</th>
                      <th style={{ width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.execucoes.map((ex) => (
                      <Fragment key={ex.id}>
                        {ex.itens.map((it) => {
                          const mat = materialPorId(it.material_id);
                          return (
                            <tr key={it.id}>
                              <td>{mat?.nome || "—"}</td>
                              <td style={{ textAlign: "center" }}>{it.quantidade_instalada || "—"}</td>
                              <td style={{ textAlign: "center" }}>{it.quantidade_retirada || "—"}</td>
                              <td style={{ textAlign: "center" }}>{it.quantidade_substituida || "—"}</td>
                              <td style={{ textAlign: "center" }}>{it.total_pontos || "—"}</td>
                              <td>
                                {it.tipo_lampada_id
                                  ? `${nomeTipoLampada(it.tipo_lampada_id)}${
                                      it.potencia_lampada_id ? ` — ${labelPotenciaLampada(it.potencia_lampada_id)}` : ""
                                    }`
                                  : "—"}
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button
                                    className="btn btn-ghost"
                                    onClick={() => abrirEdicaoExecucao(ex)}
                                    disabled={bloqueado}
                                    title="Editar execução"
                                  >
                                    <i className="ti ti-edit" aria-hidden="true" />
                                  </button>
                                  {ehAdmin && (
                                    <button
                                      className="btn btn-ghost"
                                      onClick={() => setItemExcluindo(it)}
                                      disabled={bloqueado}
                                      title="Excluir"
                                      style={{ color: "var(--danger)" }}
                                    >
                                      <i className="ti ti-trash" aria-hidden="true" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>

      {formAberto && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 980, maxWidth: "95vw" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>{execucaoEditando ? "Editar execução" : "Nova execução"}</h2>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {nomeCidade(reclamacao.cidade_id)} — {nomeBairro(reclamacao.bairro_id)} — {reclamacao.logradouro || "—"}
                {reclamacao.numero ? ` — ${reclamacao.numero}` : ""}
              </span>
            </div>
            <form onSubmit={salvar}>
              <div className="form-grid">
                <div className="form-field" style={{ "--span": 2 }}>
                  <label>Data da execução</label>
                  <input type="date" required value={dataExecucao} onChange={(e) => setDataExecucao(e.target.value)} />
                </div>
                <div className="form-field" style={{ "--span": 2 }}>
                  <label>Pontos</label>
                  <input
                    type="text"
                    disabled
                    title="Calculado automaticamente a partir dos materiais lançados"
                    style={{ textAlign: "center", background: "var(--bg-page)" }}
                    value={totalPontosFormulario}
                  />
                </div>
                <div className="form-field" style={{ "--span": 8 }}>
                  <label>Equipe</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select
                      required
                      style={{ flex: 1 }}
                      value={equipeId}
                      onChange={(e) => setEquipeId(e.target.value)}
                      title={equipeId ? composicaoEquipe(equipeId) : undefined}
                    >
                      <option value="">Selecione...</option>
                      {equipes.map((eq) => (
                        <option key={eq.id} value={eq.id} title={composicaoEquipe(eq.id)}>
                          {nomeEquipe(eq.id)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setModalEquipeAberto(true)}
                      title="Cadastrar nova equipe"
                      style={{ fontWeight: 700, fontSize: 15, padding: "4px 10px", flexShrink: 0 }}
                    >
                      <i className="ti ti-plus" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="form-field" style={{ "--span": 12 }}>
                  <label>Observações</label>
                  <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setModalMaterialIdx(-1)}
                    title="Cadastrar novo material"
                    style={{ fontWeight: 700, fontSize: 15, padding: "4px 10px" }}
                  >
                    <i className="ti ti-plus" aria-hidden="true" />
                  </button>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
                    Materiais instalados/retirados
                  </label>
                </div>

                {itens.map((item, idx) => {
                  const mat = materialPorId(item.material_id);
                  const ehLampada = mat?.categoria === "LAMPADA";
                  // Rótulos só aparecem na 1ª linha de cada tipo — a 1ª linha
                  // em geral, e a 1ª que for lâmpada (Tipo/Potência só existem
                  // nela), senão a coluna fica sem nenhum rótulo visível.
                  const primeiraLinhaLampada = itens.findIndex(
                    (it) => materialPorId(it.material_id)?.categoria === "LAMPADA"
                  );
                  return (
                    <div
                      key={idx}
                      className="linha-item-material"
                      style={{
                        display: "grid",
                        gridTemplateColumns: ehLampada
                          ? "1fr 110px 80px 180px 165px 70px 68px"
                          : "1fr 180px 165px 70px 68px",
                        gap: 8,
                        alignItems: "flex-end",
                        marginBottom: 0,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        {idx === 0 && <label style={rotuloCampo}>Material</label>}
                        <select
                          required
                          style={{ width: "100%", minWidth: 0 }}
                          value={item.material_id}
                          onChange={(e) => selecionarMaterial(idx, e.target.value)}
                        >
                          <option value="">Material...</option>
                          {materiais.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      {ehLampada && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          {idx === primeiraLinhaLampada && <label style={rotuloCampo}>Tipo</label>}
                          <ComboCriavel
                            value={item.tipo_lampada_id}
                            onChange={(valor) => atualizarItem(idx, { tipo_lampada_id: valor })}
                            options={opcoesTiposLampada}
                            placeholder="LED, vapor de sódio..."
                            onCriar={async (texto) => {
                              const novo = await apiTiposLampada.criar({ nome: texto });
                              setTiposLampada((prev) => [...prev, novo]);
                              return { value: novo.id, label: novo.nome };
                            }}
                          />
                        </div>
                      )}
                      {ehLampada && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          {idx === primeiraLinhaLampada && <label style={rotuloCampo}>Potência (W)</label>}
                          <ComboCriavel
                            value={item.potencia_lampada_id}
                            onChange={(valor) => atualizarItem(idx, { potencia_lampada_id: valor })}
                            options={opcoesPotenciasLampada}
                            placeholder="100 W"
                            onCriar={async (texto) => {
                              const numero = Number(texto.replace(",", ".").replace(/[^\d.]/g, ""));
                              if (!numero) throw new Error("Informe um número de potência válido.");
                              const novo = await apiPotenciasLampada.criar({ valor_w: numero });
                              setPotenciasLampada((prev) => [...prev, novo]);
                              return { value: novo.id, label: `${novo.valor_w} W` };
                            }}
                          />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Qtd. Inst.</label>}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: 60, minWidth: 0, textAlign: "center" }}
                            value={item.quantidade_instalada}
                            onChange={(e) => atualizarItem(idx, { quantidade_instalada: e.target.value })}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Qtd. Ret.</label>}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: 60, minWidth: 0, textAlign: "center" }}
                            value={item.quantidade_retirada}
                            onChange={(e) => atualizarItem(idx, { quantidade_retirada: e.target.value })}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Qtd. Subst.</label>}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: 60, minWidth: 0, textAlign: "center" }}
                            value={item.quantidade_substituida}
                            onChange={(e) => atualizarItem(idx, { quantidade_substituida: e.target.value })}
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Pts Inst.</label>}
                          <input
                            type="text"
                            disabled
                            title="Peso em pontos do material (cadastro de Materiais)"
                            style={{ width: 55, minWidth: 0, textAlign: "center" }}
                            value={mat?.qde_pontos_inst ?? 0}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Pts Ret.</label>}
                          <input
                            type="text"
                            disabled
                            title="Peso em pontos do material (cadastro de Materiais)"
                            style={{ width: 55, minWidth: 0, textAlign: "center" }}
                            value={mat?.qde_pontos_ret ?? 0}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Pts Subst.</label>}
                          <input
                            type="text"
                            disabled
                            title="Peso em pontos do material (cadastro de Materiais)"
                            style={{ width: 55, minWidth: 0, textAlign: "center" }}
                            value={mat?.qde_pontos_subst ?? 0}
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {idx === 0 && <label style={rotuloCampo}>Total</label>}
                        <input
                          type="text"
                          disabled
                          style={{ width: "100%", minWidth: 0, textAlign: "center", fontWeight: 600 }}
                          value={totalPontosItem(item, mat)}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {idx === itens.length - 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={adicionarItem}
                            title="Adicionar material"
                            style={{
                              color: "var(--primary)",
                              fontSize: 16,
                              width: 28,
                              height: 28,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                            }}
                          >
                            <i className="ti ti-plus" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => removerItem(idx)}
                          title="Remover"
                          style={{
                            color: "var(--danger)",
                            fontSize: 16,
                            width: 28,
                            height: 28,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                          }}
                        >
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {erro && <p className="erro-msg">{erro}</p>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setFormAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalNovaEquipe
        aberto={modalEquipeAberto}
        onFechar={() => setModalEquipeAberto(false)}
        onCriada={equipeCriada}
      />
      <ModalNovoMaterial
        aberto={modalMaterialIdx !== null}
        onFechar={() => setModalMaterialIdx(null)}
        onCriado={materialCriado}
      />

      <ConfirmDialog
        aberto={!!itemExcluindo}
        titulo="Excluir material"
        mensagem="Excluir este material lançado na execução? Essa ação não pode ser desfeita."
        confirmando={apagandoItem}
        onConfirmar={confirmarExclusaoItem}
        onCancelar={() => setItemExcluindo(null)}
      />

      {modalReabrirAberto && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 380 }}>
            <h2>Reabrir reclamação</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: -8 }}>
              Volta o status para "Aberta" e libera edição/exclusão. Exige a senha de um usuário administrador.
            </p>
            <form onSubmit={confirmarReabrir}>
              <div className="form-grid">
                <div className="form-field" style={{ "--span": 12 }}>
                  <label>Usuário administrador</label>
                  <input
                    required
                    autoFocus
                    value={reabrirUsername}
                    onChange={(e) => setReabrirUsername(e.target.value)}
                  />
                </div>
                <div className="form-field" style={{ "--span": 12 }}>
                  <label>Senha</label>
                  <input
                    type="password"
                    required
                    value={reabrirSenha}
                    onChange={(e) => setReabrirSenha(e.target.value)}
                  />
                </div>
              </div>
              {erroReabrir && <p className="erro-msg">{erroReabrir}</p>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setModalReabrirAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={reabrindo}>
                  {reabrindo ? "Verificando..." : "Reabrir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
