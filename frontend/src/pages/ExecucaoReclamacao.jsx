import { useEffect, useState } from "react";
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
  apiMateriais,
  apiPotenciasLampada,
  apiReclamacoes,
  apiTiposLampada,
} from "../api";

const LABEL_STATUS = { ABERTA: "Aberta", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída" };

const rotuloCampo = { fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" };

function novoItem() {
  return {
    material_id: "",
    quantidade_instalada: "",
    quantidade_retirada: "",
    tipo_lampada_id: "",
    potencia_lampada_id: "",
  };
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
  const [dataExecucao, setDataExecucao] = useState("");
  const [equipeId, setEquipeId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState([novoItem()]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(null);
  const [apagando, setApagando] = useState(false);
  const [modalEquipeAberto, setModalEquipeAberto] = useState(false);
  const [modalMaterialIdx, setModalMaterialIdx] = useState(null); // índice do item que pediu o material novo

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
    return `${eq.data} — ${membros || "sem membros"}`;
  };

  function abrirNovaExecucao() {
    setDataExecucao(new Date().toISOString().slice(0, 10));
    setEquipeId("");
    setObservacoes("");
    setItens([novoItem()]);
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
      const payload = {
        reclamacao_id: id,
        data_execucao: dataExecucao,
        equipe_dia_id: equipeId || null,
        observacoes: observacoes || null,
        itens: itens
          .filter((it) => it.material_id)
          .map((it) => ({
            material_id: it.material_id,
            quantidade_instalada: Number(it.quantidade_instalada) || 0,
            quantidade_retirada: Number(it.quantidade_retirada) || 0,
            tipo_lampada_id: it.tipo_lampada_id || null,
            potencia_lampada_id: it.potencia_lampada_id || null,
          })),
      };
      await apiExecucoesReclamacao.criar(payload);
      setFormAberto(false);
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    setApagando(true);
    setErroLista("");
    try {
      await apiExecucoesReclamacao.excluir(excluindo.id);
      setExcluindo(null);
      carregar();
    } catch (err) {
      setErroLista(err.message);
      setExcluindo(null);
    } finally {
      setApagando(false);
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
            <span className={`badge ${reclamacao.status === "CONCLUIDA" ? "badge-success" : "badge-muted"}`}>
              {LABEL_STATUS[reclamacao.status] || reclamacao.status}
            </span>
          </div>
        </div>

        {erroLista && <p className="erro-msg">{erroLista}</p>}

        <div
          className="table-header"
          style={{ marginTop: 20, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h3 style={{ margin: 0, fontSize: 15 }}>Execuções</h3>
          <button className="btn btn-primary" onClick={abrirNovaExecucao}>
            <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 6 }} />
            Nova execução
          </button>
        </div>

        {execucoes.length === 0 ? (
          <div className="card empty-state">Nenhuma execução registrada ainda.</div>
        ) : (
          execucoes.map((ex) => (
            <div className="card" key={ex.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <strong>{ex.data_execucao}</strong>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{nomeEquipe(ex.equipe_dia_id)}</span>
                  {ehAdmin && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => setExcluindo(ex)}
                      title="Excluir execução"
                      style={{ color: "var(--danger)" }}
                    >
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              {ex.observacoes && (
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>{ex.observacoes}</p>
              )}
              {ex.itens.length > 0 && (
                <table style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Qtd. Inst.</th>
                      <th>Qtd. Ret.</th>
                      <th>Lâmpada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.itens.map((it) => {
                      const mat = materialPorId(it.material_id);
                      return (
                        <tr key={it.id}>
                          <td>{mat?.nome || "—"}</td>
                          <td>{it.quantidade_instalada || "—"}</td>
                          <td>{it.quantidade_retirada || "—"}</td>
                          <td>
                            {it.tipo_lampada_id
                              ? `${nomeTipoLampada(it.tipo_lampada_id)}${
                                  it.potencia_lampada_id ? ` — ${labelPotenciaLampada(it.potencia_lampada_id)}` : ""
                                }`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
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
              <h2 style={{ margin: 0 }}>Nova execução</h2>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {nomeCidade(reclamacao.cidade_id)} — {nomeBairro(reclamacao.bairro_id)} — {reclamacao.logradouro || "—"}
                {reclamacao.numero ? ` — ${reclamacao.numero}` : ""}
              </span>
            </div>
            <form onSubmit={salvar}>
              <div className="form-grid">
                <div className="form-field" style={{ "--span": 4 }}>
                  <label>Data da execução</label>
                  <input type="date" required value={dataExecucao} onChange={(e) => setDataExecucao(e.target.value)} />
                </div>
                <div className="form-field" style={{ "--span": 8 }}>
                  <label>Equipe</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select style={{ flex: 1 }} value={equipeId} onChange={(e) => setEquipeId(e.target.value)}>
                      <option value="">Selecione...</option>
                      {equipes.map((eq) => (
                        <option key={eq.id} value={eq.id}>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
                    Materiais instalados/retirados
                  </label>
                  <button type="button" className="btn btn-primary" onClick={adicionarItem}>
                    <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 4 }} />
                    Adicionar material
                  </button>
                </div>

                {itens.map((item, idx) => {
                  const mat = materialPorId(item.material_id);
                  const ehLampada = mat?.categoria === "LAMPADA";
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: ehLampada
                          ? "1fr 90px 100px 90px 90px 40px"
                          : "1fr 90px 90px 40px",
                        gap: 8,
                        alignItems: "flex-end",
                        marginBottom: 30,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <label style={rotuloCampo}>Material</label>
                        <div style={{ display: "flex", gap: 6, minWidth: 0, alignItems: "center" }}>
                          <select
                            required
                            style={{ flex: 1, minWidth: 0 }}
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
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => setModalMaterialIdx(idx)}
                            title="Cadastrar novo material"
                            style={{ fontWeight: 700, fontSize: 15, padding: "4px 10px", flexShrink: 0 }}
                          >
                            <i className="ti ti-plus" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      {ehLampada && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <label style={rotuloCampo}>Tipo</label>
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
                          <label style={rotuloCampo}>Potência (W)</label>
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <label style={rotuloCampo}>Qtd. Inst.</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          style={{ width: "100%", minWidth: 0, textAlign: "center" }}
                          value={item.quantidade_instalada}
                          onChange={(e) => atualizarItem(idx, { quantidade_instalada: e.target.value })}
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <label style={rotuloCampo}>Qtd. Ret.</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          style={{ width: "100%", minWidth: 0, textAlign: "center" }}
                          value={item.quantidade_retirada}
                          onChange={(e) => atualizarItem(idx, { quantidade_retirada: e.target.value })}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => removerItem(idx)}
                        title="Remover"
                        style={{ color: "var(--danger)", fontSize: 24, padding: "6px 10px", marginTop: 20 }}
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
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

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir execução"
        mensagem="Excluir esta execução e os materiais lançados nela? Essa ação não pode ser desfeita."
        confirmando={apagando}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />

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
    </>
  );
}
