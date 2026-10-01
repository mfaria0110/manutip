import { useEffect, useMemo, useState } from "react";
import { useAcesso } from "./AcessoContext";
import ComboCriavel from "./ComboCriavel";
import ConfirmDialog from "./ConfirmDialog";

// Máscaras simples de entrada — formata o texto enquanto o usuário digita.
const MASCARAS = {
  cep: (v) =>
    v
      .replace(/\D/g, "")
      .slice(0, 8)
      .replace(/^(\d{5})(\d)/, "$1-$2"),
  telefone: (v) =>
    v
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4,5})(\d{4})$/, "$1-$2"),
  cnpj: (v) =>
    v
      .replace(/\D/g, "")
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d{2})$/, "$1-$2"),
  cpf: (v) =>
    v
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2"),
  placa: (v) =>
    v
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7)
      .replace(/^([A-Z]{3})(\d)/, "$1-$2"),
  uf: (v) => v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2),
  renavam: (v) => v.replace(/\D/g, "").slice(0, 11),
  ano: (v) => v.replace(/\D/g, "").slice(0, 4),
};

function aplicarMascara(mascara, valor) {
  const fn = MASCARAS[mascara];
  return fn ? fn(valor) : valor;
}

// Largura padrão (em colunas de 12) por tipo/máscara de campo, usada quando
// o campo não define `size` explicitamente — assim CEP/UF/data ficam
// estreitos e texto livre fica médio, sem precisar configurar um por um.
const TAMANHO_PADRAO = {
  cep: 3,
  telefone: 3,
  cnpj: 4,
  cpf: 4,
  placa: 3,
  uf: 2,
  renavam: 3,
  ano: 2,
};

function tamanhoDoCampo(c) {
  if (c.size) return c.size;
  if (c.type === "textarea" || c.fullWidth) return 12;
  if (c.type === "checkbox") return 3;
  if (c.type === "date") return 3;
  if (c.mask && TAMANHO_PADRAO[c.mask]) return TAMANHO_PADRAO[c.mask];
  if (c.type === "select") return 4;
  return 4;
}

/** Página de cadastro genérica: tabela + modal de formulário.
 *
 * campos: [{ name, label, type: 'text'|'number'|'select'|'checkbox'|'date'|'textarea',
 *            required?, options?: [{value,label}] | (valoresForm) => options,
 *            step?, mask?: 'cep'|'telefone'|'cnpj'|'cpf'|'placa'|'uf', rows? (textarea),
 *            fullWidth? (ocupa a linha toda), size? (1-12, largura explícita no
 *            grid de 12 colunas — sobrepõe o tamanho padrão por tipo) }]
 * colunas: [{ key, label, render?: (item) => node }]
 * api: { listar: () => Promise<[]>, criar: (dados) => Promise, atualizar: (id, dados) => Promise }
 */
export default function CadastroPage({
  titulo,
  modulo,
  campos,
  colunas,
  api,
  idKey = "id",
  filtroTopo,
  queryExtra,
  exigeFiltro,
  valoresPadrao,
  autoAbrirNovo,
  acoesExtras,
}) {
  const { pode, ehAdmin } = useAcesso();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null); // null = fechado; {} = novo; {...} = editar
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erroLista, setErroLista] = useState("");
  const [excluindo, setExcluindo] = useState(null); // item pendente de confirmação
  const [apagando, setApagando] = useState(false);
  const [busca, setBusca] = useState("");

  const podeEditar = pode(modulo, "edit");

  function carregar() {
    if (exigeFiltro && !queryExtra) {
      setItens([]);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    api
      .listar(queryExtra || "")
      .then(setItens)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, [queryExtra]);

  function abrirNovo() {
    const base = {};
    campos.forEach((c) => {
      base[c.name] = c.type === "checkbox" ? true : "";
    });
    setForm({ ...base, ...valoresPadrao });
    setEditando({});
    setErro("");
  }

  // Abre o formulário de "Novo" automaticamente ao montar — usado quando a
  // página já define um contexto (ex.: prefeitura escolhida antes) e quer
  // ir direto pro cadastro, sem passar pela listagem primeiro.
  useEffect(() => {
    if (autoAbrirNovo) abrirNovo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAbrirNovo]);

  function abrirEdicao(item) {
    setForm({ ...item });
    setEditando(item);
    setErro("");
  }

  function fechar() {
    setEditando(null);
  }

async function confirmarExclusao() {
    setApagando(true);
    setErroLista("");
    try {
      await api.excluir(excluindo[idKey]);
      setExcluindo(null);
      carregar();
    } catch (err) {
      setErroLista(err.message);
      setExcluindo(null);
    } finally {
      setApagando(false);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      // Selects de FK (convenção "*_id") sem seleção ficam como "" no form,
      // mas o backend espera UUID válido ou null — nunca string vazia.
      // Outros campos de texto continuam aceitando "" normalmente.
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === "" && k.endsWith("_id") ? null : v])
      );
      if (editando && editando[idKey]) {
        await api.atualizar(editando[idKey], payload);
      } else {
        await api.criar(payload);
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

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter((item) =>
      colunasFinal.some((c) => {
        const valor = c.render ? c.render(item) : item[c.key];
        return String(valor ?? "").toLowerCase().includes(termo);
      })
    );
  }, [itens, busca, colunasFinal]);

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
        {erroLista && <p className="erro-msg">{erroLista}</p>}
        <div className="filtros-linha">
          {filtroTopo}
          {itens.length > 0 && (
            <div className="filtro-wrap">
              <i className="ti ti-search" aria-hidden="true" />
              <input
                placeholder="Buscar..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="card">
          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : exigeFiltro && !queryExtra ? (
            <div className="empty-state">Selecione um município para ver os bairros.</div>
          ) : itens.length === 0 ? (
            <div className="empty-state">Nenhum registro ainda.</div>
          ) : itensFiltrados.length === 0 ? (
            <div className="empty-state">Nenhum resultado para "{busca}".</div>
          ) : (
            <table>
              <thead>
                <tr>
                  {colunasFinal.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  {(podeEditar || ehAdmin || acoesExtras) && <th style={{ width: 90 }} />}
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map((item) => (
                  <tr key={item[idKey]}>
                    {colunasFinal.map((c) => (
                      <td key={c.key}>{c.render ? c.render(item) : String(item[c.key] ?? "")}</td>
                    ))}
                    {(podeEditar || ehAdmin || acoesExtras) && (
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {acoesExtras && acoesExtras(item)}
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
            <h2>{editando[idKey] ? "Editar" : "Novo"} registro</h2>
            <form onSubmit={salvar}>
              <div className="form-grid">
              {campos.map((c) => (
                <div className="form-field" style={{ "--span": tamanhoDoCampo(c) }} key={c.name}>
                  <label>{c.label}</label>
                  {c.type === "select" ? (
                    <select
                      required={c.required}
                      disabled={c.disabled}
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
                  ) : c.type === "combo" ? (
                    <ComboCriavel
                      value={form[c.name] ?? ""}
                      onChange={(valor) => setForm((f) => ({ ...f, [c.name]: valor }))}
                      options={typeof c.options === "function" ? c.options(form) : c.options || []}
                      onCriar={(texto) => c.onCriar(texto, form)}
                      placeholder={c.placeholder}
                    />
                  ) : c.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      checked={!!form[c.name]}
                      onChange={(e) => setForm({ ...form, [c.name]: e.target.checked })}
                      style={{ width: 18, height: 18 }}
                    />
                  ) : c.type === "textarea" ? (
                    <textarea
                      required={c.required}
                      rows={c.rows || 4}
                      value={form[c.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [c.name]: e.target.value })}
                    />
                  ) : (
                    <input
                      type={c.type || "text"}
                      step={c.step}
                      required={c.required}
                      disabled={c.disabled}
                      placeholder={c.placeholder}
                      style={c.center ? { textAlign: "center" } : undefined}
                      value={c.valorCalculado ? c.valorCalculado(form) : form[c.name] ?? ""}
                      maxLength={c.maxLength}
                      onChange={(e) => {
                        let valor = c.mask ? aplicarMascara(c.mask, e.target.value) : e.target.value;
                        if (c.uppercase) valor = valor.toUpperCase();
                        setForm({ ...form, [c.name]: valor });
                      }}
                      onBlur={
                        c.onBlur
                          ? (e) => c.onBlur(e.target.value, (patch) => setForm((f) => ({ ...f, ...patch })))
                          : undefined
                      }
                    />
                  )}
                </div>
              ))}
              </div>
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

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir registro"
        mensagem={`Excluir "${excluindo?.nome || excluindo?.numero || excluindo?.placa || excluindo?.codigo || "este registro"}"? Essa ação não pode ser desfeita.`}
        confirmando={apagando}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </>
  );
}
