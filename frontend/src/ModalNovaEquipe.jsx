import { useEffect, useState } from "react";
import { aplicarMascara } from "./CadastroPage";
import { hojeLocal } from "./formatos";
import { apiCargos, apiEquipesDia, apiFuncionarios, apiVeiculos, proximoNomeEquipe } from "./api";

/** Modal de cadastro rápido de equipe, usado a partir de outras
 * telas (ex.: execução de reclamação) sem sair do fluxo atual. */
export default function ModalNovaEquipe({ aberto, onFechar, onCriada }) {
  const [funcionarios, setFuncionarios] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [nome, setNome] = useState("");
  const [sugestaoNome, setSugestaoNome] = useState("");
  const [data, setData] = useState("");
  const [celular, setCelular] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [membrosLista, setMembrosLista] = useState([]); // [{ funcionario_id, papel }]
  const [novoMembroId, setNovoMembroId] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    apiFuncionarios.listar().then(setFuncionarios);
    apiVeiculos.listar().then(setVeiculos);
    apiCargos.listar().then(setCargos);
    setNome("");
    setSugestaoNome("");
    setData(hojeLocal());
    setCelular("");
    setVeiculoId("");
    setMembrosLista([]);
    setNovoMembroId("");
    setErro("");
    proximoNomeEquipe()
      // Já preenche o nome com o próximo SELxxx (maior número + 1); segue editável.
      .then((r) => {
        setSugestaoNome(r.nome);
        setNome((atual) => atual || r.nome);
      })
      .catch(() => {});
  }, [aberto]);

  if (!aberto) return null;

  const nomeCargo = (id) => cargos.find((c) => c.id === id)?.nome;
  const nomeFuncionario = (id) => funcionarios.find((f) => f.id === id)?.nome || "—";
  const nomeFuncionarioComCargo = (f) => `${f.nome}${nomeCargo(f.cargo_id) ? ` — ${nomeCargo(f.cargo_id)}` : ""}`;
  const funcionariosDisponiveis = funcionarios.filter(
    (f) => !membrosLista.some((m) => m.funcionario_id === f.id)
  );

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
        data_cadastro: data,
        celular,
        veiculo_id: veiculoId || null,
        membros: membrosLista.map((m) => ({ funcionario_id: m.funcionario_id, papel: m.papel || null })),
      };
      const nova = await apiEquipesDia.criar(payload);
      onCriada(nova);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Nova equipe</h2>
        <form onSubmit={salvar}>
          <div className="form-grid">
            <div className="form-field" style={{ "--span": 3 }}>
              <label>Nome da equipe</label>
              <input
                required
                placeholder={sugestaoNome ? `Sugestão: ${sugestaoNome}` : ""}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ "--span": 3 }}>
              <label>Data de cadastro</label>
              <input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="form-field" style={{ "--span": 3 }}>
              <label>Celular</label>
              <input
                required
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                minLength={15}
                maxLength={15}
                title="Celular com DDD: (24) 99999-9999"
                style={{ textAlign: "center" }}
                value={celular}
                onChange={(e) => setCelular(aplicarMascara("telefone", e.target.value))}
              />
            </div>
            <div className="form-field" style={{ "--span": 3 }}>
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
                <select style={{ width: "50%" }} value={novoMembroId} onChange={(e) => setNovoMembroId(e.target.value)}>
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
            <button type="button" className="btn" onClick={onFechar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
