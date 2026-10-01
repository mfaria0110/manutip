import { useEffect, useState } from "react";
import { useAcesso } from "../AcessoContext";
import ConfirmDialog from "../ConfirmDialog";
import { apiContratos, apiMateriais, apiOrdensServico, apiPrecosPonto } from "../api";

const STATUS_LABEL = {
  ABERTA: "Aberta",
  VALIDADA: "Validada",
  FECHADA: "Fechada",
  CANCELADA: "Cancelada",
};

function novoItem() {
  return { tipo_item: "PONTO", preco_ponto_id: "", material_id: "", quantidade: 1, valor_unitario: 0 };
}

export default function OrdensServico() {
  const { pode, ehAdmin } = useAcesso();
  const podeEditar = pode("ordens_servico", "edit");

  const [ordens, setOrdens] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [precos, setPrecos] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({});
  const [itens, setItens] = useState([novoItem()]);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setCarregando(true);
    apiOrdensServico
      .listar()
      .then(setOrdens)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }

  const [excluindo, setExcluindo] = useState(null);
  const [apagando, setApagando] = useState(false);

  async function confirmarExclusao() {
    setApagando(true);
    setErro("");
    try {
      await apiOrdensServico.excluir(excluindo.id);
      setExcluindo(null);
      carregar();
    } catch (err) {
      setErro(err.message);
      setExcluindo(null);
    } finally {
      setApagando(false);
    }
  }

  useEffect(() => {
    carregar();
    apiContratos.listar().then(setContratos);
    apiPrecosPonto.listar().then(setPrecos);
    apiMateriais.listar().then(setMateriais);
  }, []);

  const nomeContrato = (id) => {
    const c = contratos.find((c) => c.id === id);
    return c?.numero_contrato || c?.id?.slice(0, 8) || "—";
  };

  function abrirNova() {
    setForm({ contrato_id: "", tipo: "OSM", numero: "", data_abertura: new Date().toISOString().slice(0, 10) });
    setItens([novoItem()]);
    setErro("");
    setAberto(true);
  }

  function atualizarItem(i, campo, valor) {
    setItens((prev) => {
      const copia = [...prev];
      copia[i] = { ...copia[i], [campo]: valor };
      if (campo === "preco_ponto_id") {
        const preco = precos.find((p) => p.id === valor);
        if (preco) copia[i].valor_unitario = preco.valor;
      }
      if (campo === "material_id") {
        const mat = materiais.find((m) => m.id === valor);
        if (mat) copia[i].valor_unitario = mat.custo_unitario;
      }
      return copia;
    });
  }

  function adicionarItem() {
    setItens((prev) => [...prev, novoItem()]);
  }

  function removerItem(i) {
    setItens((prev) => prev.filter((_, idx) => idx !== i));
  }

  const totalForm = itens.reduce((acc, it) => acc + Number(it.quantidade || 0) * Number(it.valor_unitario || 0), 0);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const payload = {
        ...form,
        itens: itens
          .filter((it) => (it.tipo_item === "PONTO" ? it.preco_ponto_id : it.material_id))
          .map((it) => ({
            tipo_item: it.tipo_item,
            preco_ponto_id: it.tipo_item === "PONTO" ? it.preco_ponto_id : null,
            material_id: it.tipo_item === "MATERIAL" ? it.material_id : null,
            quantidade: Number(it.quantidade),
            valor_unitario: Number(it.valor_unitario),
          })),
      };
      await apiOrdensServico.criar(payload);
      setAberto(false);
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  const precosDoContrato = precos.filter((p) => p.contrato_id === form.contrato_id);

  return (
    <>
      <header className="topbar">
        <h1>Ordens de serviço (OSM/OSO)</h1>
        {podeEditar && (
          <button className="btn btn-primary" onClick={abrirNova}>
            <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 6 }} />
            Nova OS
          </button>
        )}
      </header>

      <div className="content">
        <div className="card">
          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : ordens.length === 0 ? (
            <div className="empty-state">Nenhuma OS ainda.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Tipo</th>
                  <th>Contrato</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Valor total</th>
                  {ehAdmin && <th style={{ width: 50 }} />}
                </tr>
              </thead>
              <tbody>
                {ordens.map((os) => (
                  <tr key={os.id}>
                    <td>{os.numero}</td>
                    <td>{os.tipo}</td>
                    <td>{nomeContrato(os.contrato_id)}</td>
                    <td>{os.data_abertura}</td>
                    <td>
                      <span className="badge badge-muted">{STATUS_LABEL[os.status] || os.status}</span>
                    </td>
                    <td>R$ {Number(os.valor_total || 0).toFixed(2)}</td>
                    {ehAdmin && (
                      <td>
                        <button
                          className="btn btn-ghost"
                          onClick={() => setExcluindo(os)}
                          title="Excluir"
                          style={{ color: "var(--danger)" }}
                        >
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {aberto && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 620 }}>
            <h2>Nova ordem de serviço</h2>
            <form onSubmit={salvar}>
              <div style={{ display: "flex", gap: 12 }}>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="OSM">OSM (Manutenção)</option>
                    <option value="OSO">OSO (Obras)</option>
                  </select>
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Número</label>
                  <input
                    required
                    value={form.numero || ""}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  />
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>Data de abertura</label>
                  <input
                    type="date"
                    required
                    value={form.data_abertura || ""}
                    onChange={(e) => setForm({ ...form, data_abertura: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Contrato</label>
                <select
                  required
                  value={form.contrato_id || ""}
                  onChange={(e) => setForm({ ...form, contrato_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {nomeContrato(c.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Itens (ponto ou material)</label>
                {itens.map((it, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <select
                      value={it.tipo_item}
                      onChange={(e) => atualizarItem(i, "tipo_item", e.target.value)}
                      style={{ width: 110 }}
                    >
                      <option value="PONTO">Ponto</option>
                      <option value="MATERIAL">Material</option>
                    </select>
                    {it.tipo_item === "PONTO" ? (
                      <select
                        value={it.preco_ponto_id}
                        onChange={(e) => atualizarItem(i, "preco_ponto_id", e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="">Selecione o preço...</option>
                        {precosDoContrato.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.categoria} - {p.descricao} (R$ {p.valor})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={it.material_id}
                        onChange={(e) => atualizarItem(i, "material_id", e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="">Selecione o material...</option>
                        {materiais.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome} (R$ {m.custo_unitario})
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="number"
                      step="0.01"
                      value={it.quantidade}
                      onChange={(e) => atualizarItem(i, "quantidade", e.target.value)}
                      style={{ width: 70 }}
                      title="Quantidade"
                    />
                    <button type="button" className="btn btn-ghost" onClick={() => removerItem(i)}>
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button type="button" className="btn" onClick={adicionarItem}>
                  <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 6 }} />
                  Adicionar item
                </button>
              </div>

              <p style={{ fontWeight: 600, textAlign: "right" }}>Total: R$ {totalForm.toFixed(2)}</p>

              {erro && <p className="erro-msg">{erro}</p>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar OS"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir ordem de serviço"
        mensagem={`Excluir a OS "${excluindo?.numero}"? Essa ação não pode ser desfeita.`}
        confirmando={apagando}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </>
  );
}
