import { useEffect, useState } from "react";
import ComboCriavel from "./ComboCriavel";
import { apiCategoriasMaterial, apiMateriais } from "./api";

const VAZIO = { codigo: "", nome: "", unidade: "", categoria: "OUTROS", custo_unitario: "" };

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
    }
  }, [aberto]);

  if (!aberto) return null;

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const novo = await apiMateriais.criar({ ...form, custo_unitario: Number(form.custo_unitario) || 0 });
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
            <div className="form-field" style={{ "--span": 4 }}>
              <label>Código</label>
              <input required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div className="form-field" style={{ "--span": 8 }}>
              <label>Nome</label>
              <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="form-field" style={{ "--span": 4 }}>
              <label>Unidade (UN, M, KG...)</label>
              <input required value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
            </div>
            <div className="form-field" style={{ "--span": 4 }}>
              <label>Categoria</label>
              <ComboCriavel
                value={form.categoria}
                onChange={(valor) => setForm((f) => ({ ...f, categoria: valor }))}
                options={categorias}
                placeholder="Digite para buscar ou criar..."
                onCriar={async (texto) => {
                  const novo = await apiCategoriasMaterial.criar({ codigo: texto, nome: texto });
                  setCategorias((prev) => [...prev, { value: novo.codigo, label: novo.nome }]);
                  return { value: novo.codigo, label: novo.nome };
                }}
              />
            </div>
            <div className="form-field" style={{ "--span": 4 }}>
              <label>Custo unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.custo_unitario}
                onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })}
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
