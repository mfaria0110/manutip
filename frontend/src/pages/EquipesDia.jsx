import { useEffect, useState } from "react";
import { useAcesso } from "../AcessoContext";
import ConfirmDialog from "../ConfirmDialog";
import { apiCargos, apiEquipesDia, apiFuncionarios, apiVeiculos, proximoNomeEquipe } from "../api";

export default function EquipesDia() {
  const { pode, ehAdmin } = useAcesso();
  const podeEditar = pode("equipes", "edit");

  const [itens, setItens] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const [editando, setEditando] = useState(null); // null fechado, {} novo, {...} editar
  const [nome, setNome] = useState("");
  const [sugestaoNome, setSugestaoNome] = useState("");
  const [data, setData] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [membrosLista, setMembrosLista] = useState([]); // [{ funcionario_id, papel }]
  const [novoMembroId, setNovoMembroId] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(null);
  const [apagando, setApagando] = useState(false);

  function carregar() {
    setCarregando(true);
    apiEquipesDia
      .listar()
      .then(setItens)
      .catch((e) => setErroLista(e.message))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
    apiFuncionarios.listar().then(setFuncionarios);
    apiVeiculos.listar().then(setVeiculos);
    apiCargos.listar().then(setCargos);
  }, []);

  const nomeVeiculo = (id) => {
    const v = veiculos.find((x) => x.id === id);
    return v ? `${v.placa} — ${v.modelo}` : "—";
  };
  const nomeCargo = (id) => cargos.find((c) => c.id === id)?.nome;
  const nomeFuncionario = (id) => funcionarios.find((f) => f.id === id)?.nome || "—";
  const nomeFuncionarioComCargo = (f) => `${f.nome}${nomeCargo(f.cargo_id) ? ` — ${nomeCargo(f.cargo_id)}` : ""}`;
  const funcionariosDisponiveis = funcionarios.filter(
    (f) => !membrosLista.some((m) => m.funcionario_id === f.id)
  );

  function abrirNovo() {
    setNome("");
    setSugestaoNome("");
    setData(new Date().toISOString().slice(0, 10));
    setVeiculoId("");
    setMembrosLista([]);
    setNovoMembroId("");
    setErro("");
    setEditando({});
    proximoNomeEquipe()
      .then((r) => setSugestaoNome(r.nome))
      .catch(() => {});
  }

  function abrirEdicao(item) {
    setNome(item.nome || "");
    setData(item.data);
    setVeiculoId(item.veiculo_id || "");
    setMembrosLista(item.membros.map((m) => ({ funcionario_id: m.funcionario_id, papel: m.papel || "" })));
    setNovoMembroId("");
    setErro("");
    setEditando(item);
  }

  function adicionarMembro() {
    if (!novoMembroId) return;
    const funcionario = funcionarios.find((f) => f.id === novoMembroId);
    const papelPadrao = nomeCargo(funcionario?.cargo_id) || "";
    setMembrosLista((prev) => [...prev, { funcionario_id: novoMembroId, papel: papelPadrao }]);
    setNovoMembroId("");
  }

  function removerMembro(funcionarioId) {
    setMembrosLista((prev) => prev.filter((m) => m.funcionario_id !== funcionarioId));
  }

  function mudarPapel(funcionarioId, papel) {
    setMembrosLista((prev) => prev.map((m) => (m.funcionario_id === funcionarioId ? { ...m, papel } : m)));
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const payload = {
        nome,
        data,
        veiculo_id: veiculoId || null,
        membros: membrosLista.map((m) => ({ funcionario_id: m.funcionario_id, papel: m.papel || null })),
      };
      if (editando && editando.id) {
        await apiEquipesDia.atualizar(editando.id, payload);
      } else {
        await apiEquipesDia.criar(payload);
      }
      setEditando(null);
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
      await apiEquipesDia.excluir(excluindo.id);
      setExcluindo(null);
      carregar();
    } catch (err) {
      setErroLista(err.message);
      setExcluindo(null);
    } finally {
      setApagando(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <h1>Equipes do dia</h1>
        {podeEditar && (
          <button className="btn btn-primary" onClick={abrirNovo}>
            <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 6 }} />
            Novo
          </button>
        )}
      </header>

      <div className="content">
        {erroLista && <p className="erro-msg">{erroLista}</p>}
        <div className="card">
          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : itens.length === 0 ? (
            <div className="empty-state">Nenhuma equipe cadastrada ainda.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Data</th>
                  <th>Veículo</th>
                  <th>Membros</th>
                  {(podeEditar || ehAdmin) && <th style={{ width: 90 }} />}
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome || "—"}</td>
                    <td>{item.data}</td>
                    <td>{nomeVeiculo(item.veiculo_id)}</td>
                    <td>{item.membros.map((m) => m.funcionario_nome).join(", ") || "—"}</td>
                    {(podeEditar || ehAdmin) && (
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {podeEditar && (
                            <button className="btn btn-ghost" onClick={() => abrirEdicao(item)} title="Editar">
                              <i className="ti ti-edit" aria-hidden="true" />
                            </button>
                          )}
                          {ehAdmin && (
                            <button
                              className="btn btn-ghost"
                              onClick={() => setExcluindo(item)}
                              title="Excluir"
                              style={{ color: "var(--danger)" }}
                            >
                              <i className="ti ti-trash" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editando !== null && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editando.id ? "Editar" : "Nova"} equipe do dia</h2>
            <form onSubmit={salvar}>
              <div className="form-grid">
                <div className="form-field" style={{ "--span": 4 }}>
                  <label>Nome da equipe</label>
                  <input
                    required
                    placeholder={sugestaoNome ? `Sugestão: ${sugestaoNome}` : ""}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <div className="form-field" style={{ "--span": 4 }}>
                  <label>Data</label>
                  <input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div className="form-field" style={{ "--span": 4 }}>
                  <label>Veículo</label>
                  <select required value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {veiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.placa} — {v.modelo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field" style={{ "--span": 12 }}>
                  <label>Membros</label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <select
                      style={{ width: "50%" }}
                      value={novoMembroId}
                      onChange={(e) => setNovoMembroId(e.target.value)}
                    >
                      <option value="">Selecione um funcionário...</option>
                      {funcionariosDisponiveis.map((f) => (
                        <option key={f.id} value={f.id}>
                          {nomeFuncionarioComCargo(f)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={adicionarMembro}
                      disabled={!novoMembroId}
                      style={{ height: 30, padding: "0 8px", fontSize: 12 }}
                    >
                      <i className="ti ti-plus" aria-hidden="true" />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {membrosLista.length === 0 && (
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Nenhum membro adicionado.</span>
                    )}
                    {membrosLista.map((m) => (
                      <div key={m.funcionario_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ flex: 1 }}>{nomeFuncionario(m.funcionario_id)}</span>
                        <select
                          style={{ width: 280, flexShrink: 0 }}
                          value={m.papel}
                          onChange={(e) => mudarPapel(m.funcionario_id, e.target.value)}
                        >
                          <option value="">Papel...</option>
                          {cargos.map((c) => (
                            <option key={c.id} value={c.nome}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => removerMembro(m.funcionario_id)}
                          title="Remover"
                          style={{ color: "var(--danger)" }}
                        >
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {erro && <p className="erro-msg">{erro}</p>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setEditando(null)}>
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
        titulo="Excluir equipe"
        mensagem='Excluir esta equipe do dia? Essa ação não pode ser desfeita.'
        confirmando={apagando}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </>
  );
}
