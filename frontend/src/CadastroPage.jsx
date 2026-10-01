import { useEffect, useMemo, useState } from "react";
import { useAcesso } from "./AcessoContext";

/** Página de cadastro genérica: tabela + modal de formulário.
 *
 * campos: [{ name, label, type: 'text'|'number'|'select'|'checkbox'|'date',
 *            required?, options?: [{value,label}] | (valoresForm) => options,
 *            step? }]
 * colunas: [{ key, label, render?: (item) => node }]
 * api: { listar: () => Promise<[]>, criar: (dados) => Promise, atualizar: (id, dados) => Promise }
 */
export default function CadastroPage({ titulo, modulo, campos, colunas, api, idKey = "id" }) {
  const { pode } = useAcesso();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null); // null = fechado; {} = novo; {...} = editar
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  const podeEditar = pode(modulo, "edit");

  function carregar() {
    setCarregando(true);
    api
      .listar()
      .then(setItens)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, []);

  function abrirNovo() {
    const base = {};
    campos.forEach((c) => {
      base[c.name] = c.type === "checkbox" ? true : "";
    });
    setForm(base);
    setEditando({});
    setErro("");
  }

  function abrirEdicao(item) {
    setForm({ ...item });
    setEditando(item);
    setErro("");
  }

  function fechar() {
    setEditando(null);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (editando && editando[idKey]) {
        await api.atualizar(editando[idKey], form);
      } else {
        await api.criar(form);
      }
      fechar();
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  const colunasFinal = useMemo(() => colunas, [colunas]);

  return (
    <>
      <header className="topbar">
        <h1>{titulo}</h1>
        {podeEditar && (
          <button className="btn btn-primary" onClick={abrirNovo}>
            <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 6 }} />
            Novo
          </button>
        )}
      </header>

      <div className="content">
        <div className="card">
          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : itens.length === 0 ? (
            <div className="empty-state">Nenhum registro ainda.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  {colunasFinal.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  {podeEditar && <th style={{ width: 70 }} />}
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item[idKey]}>
                    {colunasFinal.map((c) => (
                      <td key={c.key}>{c.render ? c.render(item) : String(item[c.key] ?? "")}</td>
                    ))}
                    {podeEditar && (
                      <td>
                        <button className="btn btn-ghost" onClick={() => abrirEdicao(item)}>
                          <i className="ti ti-edit" aria-hidden="true" />
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

      {editando !== null && (
        <div className="modal-overlay" onClick={fechar}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editando[idKey] ? "Editar" : "Novo"} registro</h2>
            <form onSubmit={salvar}>
              {campos.map((c) => (
                <div className="form-field" key={c.name}>
                  <label>{c.label}</label>
                  {c.type === "select" ? (
                    <select
                      required={c.required}
                      value={form[c.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [c.name]: e.target.value })}
                    >
                      <option value="">Selecione...</option>
                      {(typeof c.options === "function" ? c.options(form) : c.options || []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : c.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      checked={!!form[c.name]}
                      onChange={(e) => setForm({ ...form, [c.name]: e.target.checked })}
                      style={{ width: 18, height: 18 }}
                    />
                  ) : (
                    <input
                      type={c.type || "text"}
                      step={c.step}
                      required={c.required}
                      value={form[c.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [c.name]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              {erro && <p className="erro-msg">{erro}</p>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={fechar}>
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
    </>
  );
}
