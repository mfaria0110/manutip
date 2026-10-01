import { useEffect, useState } from "react";
import { useAcesso } from "../AcessoContext";
import ConfirmDialog from "../ConfirmDialog";
import { apiEquipesDia, apiFuncionarios, apiVeiculos } from "../api";

export default function EquipesDia() {
  const { pode, ehAdmin } = useAcesso();
  const podeEditar = pode("equipes", "edit");

  const [itens, setItens] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const [editando, setEditando] = useState(null); // null fechado, {} novo, {...} editar
  const [data, setData] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [membros, setMembros] = useState({}); // { funcionario_id: { marcado, papel } }
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
  }, []);

  const nomeVeiculo = (id) => {
    const v = veiculos.find((x) => x.id === id);
    return v ? `${v.placa} — ${v.modelo}` : "—";
  };

  function abrirNovo() {
    setData("");
    setVeiculoId("");
    setMembros({});
    setErro("");
    setEditando({});
  }

  function abrirEdicao(item) {
    setData(item.data);
    setVeiculoId(item.veiculo_id || "");
    const mapa = {};
    item.membros.forEach((m) => {
      mapa[m.funcionario_id] = { marcado: true, papel: m.papel || "" };
    });
    setMembros(mapa);
    setErro("");
    setEditando(item);
  }

  function alternarMembro(funcionarioId) {
    setMembros((prev) => ({
      ...prev,
      [funcionarioId]: { marcado: !prev[funcionarioId]?.marcado, papel: prev[funcionarioId]?.papel || "" },
    }));
  }

  function mudarPapel(funcionarioId, papel) {
    setMembros((prev) => ({ ...prev, [funcionarioId]: { ...prev[funcionarioId], papel } }));
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const payload = {
        data,
        veiculo_id: veiculoId || null,
        membros: Object.entries(membros)
          .filter(([, v]) => v.marcado)
          .map(([funcionario_id, v]) => ({ funcionario_id, papel: v.papel || null })),
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
                  <th>Data</th>
                  <th>Veículo</th>
                  <th>Membros</th>
                  {(podeEditar || ehAdmin) && <th style={{ width: 90 }} />}
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id}>
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
                  <label>Data</label>
                  <input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div className="form-field" style={{ "--span": 8 }}>
                  <label>Veículo</label>
                  <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {funcionarios.map((f) => (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          style={{ width: 18, height: 18 }}
                          checked={!!membros[f.id]?.marcado}
                          onChange={() => alternarMembro(f.id)}
                        />
                        <span style={{ minWidth: 180 }}>{f.nome}</span>
                        {membros[f.id]?.marcado && (
                          <input
                            placeholder="Papel (encarregado, auxiliar...)"
                            style={{ flex: 1 }}
                            value={membros[f.id]?.papel || ""}
                            onChange={(e) => mudarPapel(f.id, e.target.value)}
                          />
                        )}
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
