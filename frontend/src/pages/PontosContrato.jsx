import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiContratos, apiPontosMaterialContrato, apiPrefeituras } from "../api";
import { useAcesso } from "../AcessoContext";
import ConfirmDialog from "../ConfirmDialog";

export default function PontosContrato() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ehAdmin, ehSuperadmin, carregando: carregandoAcesso } = useAcesso();
  const [contrato, setContrato] = useState(null);
  const [prefeituras, setPrefeituras] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  // Linha aguardando confirmação de "Remover pontos".
  const [removendo, setRemovendo] = useState(null);
  const [apagando, setApagando] = useState(false);
  const [erroRemover, setErroRemover] = useState("");

  useEffect(() => {
    // Contrato primeiro: Por ponto só o Superadmin vê a tabela (o backend também barra).
    Promise.all([apiContratos.obter(id), apiPrefeituras.listar()])
      .then(async ([c, prefs]) => {
        setContrato(c);
        setPrefeituras(prefs);
        if (c.tipo_contrato === "POR_PONTO" && !ehSuperadmin) return;
        setLinhas(await apiPontosMaterialContrato.matriz(id));
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [id, ehSuperadmin]);

  const nomePrefeitura = (prefeituraId) => prefeituras.find((p) => p.id === prefeituraId)?.nome || "—";

  function atualizarLinha(idx, patch) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    setSucesso(false);
  }

  async function confirmarRemocao() {
    setApagando(true);
    setErroRemover("");
    try {
      const atualizado = await apiPontosMaterialContrato.remover(id, removendo.material_id);
      // Mantém o que foi digitado (e não salvo) nas outras linhas.
      setLinhas((prev) =>
        atualizado.map((nova) =>
          nova.material_id === removendo.material_id ? nova : prev.find((l) => l.material_id === nova.material_id) || nova
        )
      );
      setRemovendo(null);
    } catch (e) {
      setErroRemover(e.message);
    } finally {
      setApagando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const atualizado = await apiPontosMaterialContrato.salvarMatriz(id, linhas);
      setLinhas(atualizado);
      setSucesso(true);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  // Pontos de materiais: só Superadmin e Administrador (inclusive por endereço direto).
  const restrito =
    !carregandoAcesso && (!ehAdmin || (contrato?.tipo_contrato === "POR_PONTO" && !ehSuperadmin));
  if (restrito) {
    return (
      <>
        <header className="topbar">
          <h1>Pontos de materiais do contrato</h1>
        </header>
        <div className="content">
          <div className="card empty-state">
            {ehAdmin
              ? "Contrato Por ponto: os pontos de materiais só podem ser vistos pelo Superadmin."
              : "Acesso restrito a Superadmin e Administrador."}
          </div>
        </div>
      </>
    );
  }

  if (carregando) {
    return (
      <>
        <header className="topbar">
          <h1>Pontos de materiais do contrato</h1>
        </header>
        <div className="content">
          <div className="card empty-state">Carregando...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <h1>Pontos de materiais do contrato</h1>
        <button className="btn" onClick={() => navigate("/contratos")}>
          <i className="ti ti-arrow-left" aria-hidden="true" style={{ marginRight: 6 }} />
          Voltar
        </button>
      </header>

      <div className="content">
        <div className="card">
          {contrato && (
            <p style={{ margin: "0 0 12px", color: "var(--text-secondary)", fontSize: 14 }}>
              {nomePrefeitura(contrato.prefeitura_id)}
              {contrato.numero_contrato ? ` — ${contrato.numero_contrato}` : ""}
            </p>
          )}

          {contrato?.tipo_contrato === "POR_PONTO" && (
            <p className="aviso-msg">
              <i className="ti ti-info-circle" aria-hidden="true" style={{ marginRight: 6 }} />
              Este contrato é <strong>Por ponto</strong>: cada atendimento vale 1 ponto e esta tabela não entra no
              cálculo. Os pontos cadastrados aqui podem ser removidos (é preciso removê-los para excluir um material).
            </p>
          )}

          {erro && <p className="erro-msg">{erro}</p>}
          {sucesso && <span className="badge badge-success">Pontos salvos.</span>}

          <table className="tabela-compacta">
            <thead>
              <tr>
                <th style={{ padding: "6px 12px" }}>Material</th>
                <th style={{ padding: "6px 12px" }}>Pts Instalação</th>
                <th style={{ padding: "6px 12px" }}>Pts Retirada</th>
                <th style={{ padding: "6px 12px" }}>Pts Substituição</th>
                <th style={{ padding: "6px 12px" }}>Situação</th>
                <th style={{ padding: "6px 12px", width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, idx) => (
                <tr key={linha.material_id}>
                  <td style={{ padding: "2px 12px" }}>{linha.material_nome}</td>
                  <td style={{ padding: "2px 12px", textAlign: "center" }}>
                    <input
                      type="number"
                      step="0.01"
                      style={{ width: 90, height: 24, textAlign: "center" }}
                      value={linha.qde_pontos_inst}
                      onChange={(e) => atualizarLinha(idx, { qde_pontos_inst: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td style={{ padding: "2px 12px", textAlign: "center" }}>
                    <input
                      type="number"
                      step="0.01"
                      style={{ width: 90, height: 24, textAlign: "center" }}
                      value={linha.qde_pontos_ret}
                      onChange={(e) => atualizarLinha(idx, { qde_pontos_ret: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td style={{ padding: "2px 12px", textAlign: "center" }}>
                    <input
                      type="number"
                      step="0.01"
                      style={{ width: 90, height: 24, textAlign: "center" }}
                      value={linha.qde_pontos_subst}
                      onChange={(e) => atualizarLinha(idx, { qde_pontos_subst: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td style={{ padding: "2px 12px", textAlign: "center" }}>
                    {linha.cadastrado ? (
                      <span className="badge badge-success">Cadastrado</span>
                    ) : (
                      <span className="badge" style={{ background: "#fef2f2", color: "var(--danger, #dc2626)" }}>
                        Faltando
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "2px 12px", textAlign: "center" }}>
                    {linha.cadastrado && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ color: "var(--danger)" }}
                        title="Remover os pontos deste material neste contrato"
                        onClick={() => {
                          setErroRemover("");
                          setRemovendo(linha);
                        }}
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        aberto={Boolean(removendo)}
        titulo="Remover pontos do material"
        mensagem={
          removendo &&
          `Remover os pontos de "${removendo.material_nome}" neste contrato? A linha volta a ficar como "Faltando".`
        }
        confirmando={apagando}
        erro={erroRemover}
        textoConfirmar="Remover"
        textoConfirmando="Removendo..."
        onConfirmar={confirmarRemocao}
        onCancelar={() => setRemovendo(null)}
      />
    </>
  );
}
