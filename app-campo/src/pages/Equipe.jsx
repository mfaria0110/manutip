import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  apiCargos,
  apiEquipesDia,
  apiFuncionarios,
  apiVeiculos,
  logout,
  proximoNomeEquipe,
  validarEquipe,
} from "../api";
import { useAcesso } from "../AcessoContext";
import { useFluxo } from "../FluxoContext";
import Topo from "../Topo";

const hoje = () => new Date().toISOString().slice(0, 10);

export default function Equipe() {
  const navigate = useNavigate();
  const { recarregar } = useAcesso();
  const { definirEquipe, limpar } = useFluxo();

  async function sair() {
    await logout();
    limpar();
    await recarregar();
  }

  const [equipes, setEquipes] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [equipeAtual, setEquipeAtual] = useState(null); // objeto completo em edição
  const [veiculoId, setVeiculoId] = useState("");
  const [membros, setMembros] = useState([]); // [{funcionario_id, papel}]
  const [novoMembroId, setNovoMembroId] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    Promise.all([apiEquipesDia.listar(), apiFuncionarios.listar(), apiVeiculos.listar(), apiCargos.listar()])
      .then(([eq, func, vei, carg]) => {
        setEquipes(eq.filter((e) => e.data === hoje()));
        setFuncionarios(func);
        setVeiculos(vei);
        setCargos(carg);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  function abrirEquipe(eq) {
    setEquipeAtual(eq);
    setVeiculoId(eq.veiculo_id || "");
    setMembros(eq.membros.map((m) => ({ funcionario_id: m.funcionario_id, papel: m.papel || "" })));
  }

  async function criarNova() {
    setErro("");
    try {
      const { nome } = await proximoNomeEquipe();
      const nova = await apiEquipesDia.criar({ nome, data: hoje(), veiculo_id: null, membros: [] });
      setEquipes((prev) => [nova, ...prev]);
      abrirEquipe(nova);
    } catch (e) {
      setErro(e.message);
    }
  }

  const nomeCargo = (id) => cargos.find((c) => c.id === id)?.nome;
  const nomeFuncionario = (id) => funcionarios.find((f) => f.id === id)?.nome || "—";
  const funcionariosDisponiveis = funcionarios.filter((f) => !membros.some((m) => m.funcionario_id === f.id));

  function adicionarMembro() {
    if (!novoMembroId) return;
    const func = funcionarios.find((f) => f.id === novoMembroId);
    setMembros((prev) => [...prev, { funcionario_id: novoMembroId, papel: nomeCargo(func?.cargo_id) || "" }]);
    setNovoMembroId("");
  }

  function removerMembro(id) {
    setMembros((prev) => prev.filter((m) => m.funcionario_id !== id));
  }

  async function salvarComposicao() {
    setSalvando(true);
    setErro("");
    try {
      const atualizada = await apiEquipesDia.atualizar(equipeAtual.id, {
        veiculo_id: veiculoId || null,
        membros: membros.map((m) => ({ funcionario_id: m.funcionario_id, papel: m.papel || null })),
      });
      setEquipeAtual(atualizada);
      setEquipes((prev) => prev.map((e) => (e.id === atualizada.id ? atualizada : e)));
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function validar() {
    setSalvando(true);
    setErro("");
    try {
      await salvarComposicao();
      const validada = await validarEquipe(equipeAtual.id);
      setEquipeAtual(validada);
      setEquipes((prev) => prev.map((e) => (e.id === validada.id ? validada : e)));
      definirEquipe(validada.id);
      navigate("/prefeitura");
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="tela">
        <Topo titulo="Equipe do dia" />
        <div className="conteudo vazio">Carregando...</div>
      </div>
    );
  }

  if (equipeAtual) {
    const jaValidada = !!equipeAtual.validada_em;
    return (
      <div className="tela">
        <Topo titulo={equipeAtual.nome} subtitulo={hoje().split("-").reverse().join("/")} voltar={() => setEquipeAtual(null)} />
        <div className="conteudo">
          {erro && <p className="erro-msg">{erro}</p>}
          {jaValidada && <div className="badge" style={{ marginBottom: 14 }}>Equipe validada</div>}

          <div className="campo">
            <label>Veículo</label>
            <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} disabled={jaValidada}>
              <option value="">Selecione...</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} — {v.modelo}
                </option>
              ))}
            </select>
          </div>

          <label>Membros</label>
          {!jaValidada && (
            <div className="linha" style={{ marginBottom: 10 }}>
              <select value={novoMembroId} onChange={(e) => setNovoMembroId(e.target.value)}>
                <option value="">Adicionar funcionário...</option>
                {funcionariosDisponiveis.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-primario btn-pequeno" onClick={adicionarMembro} disabled={!novoMembroId}>
                <i className="ti ti-plus" aria-hidden="true" />
              </button>
            </div>
          )}
          {membros.length === 0 && <p className="cartao-sub">Nenhum membro adicionado.</p>}
          {membros.map((m) => (
            <div key={m.funcionario_id} className="cartao linha-entre" style={{ marginBottom: 8, padding: 12 }}>
              <span>{nomeFuncionario(m.funcionario_id)}</span>
              {!jaValidada && (
                <button type="button" className="btn-perigo" style={{ border: "none", background: "none" }} onClick={() => removerMembro(m.funcionario_id)}>
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {!jaValidada && (
              <button type="button" className="btn btn-secundario" onClick={salvarComposicao} disabled={salvando}>
                Salvar composição
              </button>
            )}
            <button type="button" className="btn btn-primario" onClick={jaValidada ? () => { definirEquipe(equipeAtual.id); navigate("/prefeitura"); } : validar} disabled={salvando}>
              {jaValidada ? "Continuar" : salvando ? "Validando..." : "Validar equipe do dia"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tela">
      <Topo
        titulo="Equipe do dia"
        subtitulo={hoje().split("-").reverse().join("/")}
        acao={
          <button type="button" onClick={sair} style={{ background: "none", border: "none", color: "#fff" }}>
            <i className="ti ti-logout" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
        }
      />
      <div className="conteudo">
        {erro && <p className="erro-msg">{erro}</p>}
        {equipes.length === 0 && <p className="vazio">Nenhuma equipe cadastrada hoje ainda.</p>}
        {equipes.map((eq) => (
          <div key={eq.id} className="cartao cartao-toque" onClick={() => abrirEquipe(eq)}>
            <div>
              <div className="cartao-titulo">{eq.nome}</div>
              <div className="cartao-sub">{eq.membros.length} membro(s){eq.validada_em ? " · validada" : ""}</div>
            </div>
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </div>
        ))}
        <button type="button" className="btn btn-secundario" style={{ marginTop: 10 }} onClick={criarNova}>
          <i className="ti ti-plus" aria-hidden="true" /> Nova equipe
        </button>
      </div>
    </div>
  );
}
