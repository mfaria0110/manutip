import { useEffect, useState } from "react";
import { apiCategoriasMaterial, apiMateriais, proximoCodigoMaterial } from "./api";

const VAZIO = {
  codigo: "",
  nome: "",
  unidade: "",
  categoria: "",
  custo_unitario: "0",
  qde_pontos_inst: "0",
  qde_pontos_ret: "0",
  qde_pontos_subst: "0",
};

/** Modal de cadastro rápido de material, usado a partir de outras telas
 * (ex.: execução de reclamação) sem sair do fluxo atual. */
export default function ModalNovoMaterial({ aberto, onFechar, onCriado }) {
  const [form, setForm] = useState(VAZIO);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    if (aberto) {
      setForm(VAZIO);
      setErro("");
      apiCategoriasMaterial
        .listar()
        .then((lista) => setCategorias(lista.map((c) => ({ value: c.codigo, label: c.nome }))))
        .catch(() => {});
      // Sugestão calculada sob demanda (próximo código) — chega depois e só
      // atualiza o form, sem travar a abertura da modal.
      proximoCodigoMaterial()
        .then(({ codigo }) => setForm((f) => ({ ...f, codigo })))
        .catch(() => {});
    }
  }, [aberto]);

  if (!aberto) return null;

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const novo = await apiMateriais.criar({
        ...form,
        custo_unitario: Number(form.custo_unitario) || 0,
        qde_pontos_inst: Number(form.qde_pontos_inst) || 0,
        qde_pontos_ret: Number(form.qde_pontos_ret) || 0,
        qde_pontos_subst: Number(form.qde_pontos_subst) || 0,
      });
      onCriado(novo);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Novo material</h2>
        <form onSubmit={salvar}>
          <div className="form-grid">
            <div className="form-field" style={{ "--span": 3 }}>
              <label>Código</label>
              <input required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div className="form-field" style={{ "--span": 6 }}>
              <label>Nome</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="form-field" style={{ "--span": 3 }}>
              <label>Unidade (UN, M, KG...)</label>
              <input required value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
            </div>
            <div className="form-field" style={{ "--span": 3 }}>
              <label>Categoria</label>
              <select
                required
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ "--span": 3 }}>
              <label>Custo unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                style={{ textAlign: "center" }}
                value={form.custo_unitario}
                onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })}
              />
            </div>
            <div className="form-field" style={{ "--span": 2 }}>
              <label>Pts Instalação</label>
              <input
                type="number"
                step="0.01"
                style={{ textAlign: "center" }}
                value={form.qde_pontos_inst}
                onChange={(e) => setForm({ ...form, qde_pontos_inst: e.target.value })}
              />
            </div>
            <div className="form-field" style={{ "--span": 2 }}>
              <label>Pts Retirada</label>
              <input
                type="number"
                step="0.01"
                style={{ textAlign: "center" }}
                value={form.qde_pontos_ret}
                onChange={(e) => setForm({ ...form, qde_pontos_ret: e.target.value })}
              />
            </div>
            <div className="form-field" style={{ "--span": 2 }}>
              <label>Pts Substituição</label>
              <input
                type="number"
                step="0.01"
                style={{ textAlign: "center" }}
                value={form.qde_pontos_subst}
                onChange={(e) => setForm({ ...form, qde_pontos_subst: e.target.value })}
              />
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
