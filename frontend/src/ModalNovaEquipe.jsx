import { useEffect, useState } from "react";
import { apiEquipesDia, apiFuncionarios, apiVeiculos } from "./api";

/** Modal de cadastro rápido de equipe do dia, usado a partir de outras
 * telas (ex.: execução de reclamação) sem sair do fluxo atual. */
export default function ModalNovaEquipe({ aberto, onFechar, onCriada }) {
  const [funcionarios, setFuncionarios] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [data, setData] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [membros, setMembros] = useState({});
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    apiFuncionarios.listar().then(setFuncionarios);
    apiVeiculos.listar().then(setVeiculos);
    setData("");
    setVeiculoId("");
    setMembros({});
    setErro("");
  }, [aberto]);

  if (!aberto) return null;

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
        <h2>Nova equipe do dia</h2>
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
