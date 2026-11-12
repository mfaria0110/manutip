import { useEffect, useMemo, useState } from "react";
import { useAcesso } from "./AcessoContext";
import ComboCriavel from "./ComboCriavel";
import ConfirmDialog from "./ConfirmDialog";

// Texto visível de um valor renderizado (string, número ou elemento React com
// filhos) — usado pela busca para achar também colunas com selos/badges.
function textoDoNo(no) {
  if (no == null || typeof no === "boolean") return "";
  if (typeof no === "string" || typeof no === "number") return String(no);
  if (Array.isArray(no)) return no.map(textoDoNo).join(" ");
  if (typeof no === "object" && no.props) {
    return textoDoNo(no.props.children);
  }
  return "";
}

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
  moeda: (v) => formatarMoeda(v),
};

export function aplicarMascara(mascara, valor) {
  const fn = MASCARAS[mascara];
  return fn ? fn(valor) : valor;
}

// Formata dígitos como moeda BR (1234 -> "12,34"; nunca usa o valor como
// ponto flutuante direto, só os dígitos puros, pra evitar cursor pulando
// de lugar enquanto digita.
function formatarMoeda(v) {
  const digitos = String(v).replace(/\D/g, "");
  const numero = (parseInt(digitos || "0", 10) / 100).toFixed(2);
  const [inteiro, centavos] = numero.split(".");
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + centavos;
}

// Converte "1.234,56" (ou um número já puro) de volta pra float, pra mandar
// pro backend — que espera um número, não o texto formatado.
function moedaParaNumero(v) {
  if (typeof v !== "string") return v;
  const limpo = v.replace(/\./g, "").replace(",", ".");
  const num = Number(limpo);
  return Number.isNaN(num) ? v : num;
}

// Diferente de formatarMoeda (que trata a entrada como dígitos puros
// enquanto o usuário digita): aqui o valor JÁ é um número de verdade (vindo
// do backend ou de valoresPadrao), então formata direto, sem tratar como
// centavos.
function numeroParaMoeda(valor) {
  const num = Number(valor);
  if (Number.isNaN(num)) return "0,00";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  moeda: 3,
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
  acaoAposFiltro,
  // A página ocupa a altura da tela e só a listagem rola (cabeçalho da tabela fixo).
  rolagemNaLista,
  // Chamado depois de salvar com o registro devolvido pelo servidor (ex.: abrir a execução).
  aoSalvar,
  // (registro) => mensagem | null: com mensagem, o registro abre só para consulta.
  somenteLeitura,
  exigirSenhaParaExcluir,
  mensagemExclusao,
  queryExtra,
  exigeFiltro,
  valoresPadrao,
  obterValoresPadrao,
  autoAbrirNovo,
  acoesExtras,
  alturaModal,
  larguraModal,
  classeTabela,
  notaModal,
}) {
  const { pode } = useAcesso();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null); // null = fechado; {} = novo; {...} = editar
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erroLista, setErroLista] = useState("");
  const [excluindo, setExcluindo] = useState(null); // item pendente de confirmação
  const [apagando, setApagando] = useState(false);
  // Com exigirSenhaParaExcluir, o diálogo pede a senha do admin logado e fica aberto se ela estiver errada.
  const [senhaExclusao, setSenhaExclusao] = useState("");
  const [erroExclusao, setErroExclusao] = useState("");
  const [avisoLista, setAvisoLista] = useState("");
  const [busca, setBusca] = useState("");

  const podeCriar = pode(`${modulo}.criar`);
  const podeEditar = pode(`${modulo}.editar`);
  const podeExcluir = pode(`${modulo}.excluir`);

  // Campos com mask "moeda" guardam no form o texto já formatado ("1.234,56"),
  // não o número — então todo valor vindo de fora (registro do backend,
  // valoresPadrao) precisa passar por aqui antes de entrar no form.
  function formatarCamposMoeda(valores) {
    const resultado = { ...valores };
    campos.forEach((c) => {
      if (c.mask === "moeda" && resultado[c.name] !== "" && resultado[c.name] != null) {
        resultado[c.name] = numeroParaMoeda(resultado[c.name]);
      }
    });
    return resultado;
  }

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
      base[c.name] = c.type === "checkbox" ? true : c.type === "simnao" ? false : "";
    });
    setForm(formatarCamposMoeda({ ...base, ...valoresPadrao }));
    setEditando({});
    setErro("");
    // Sugestão calculada sob demanda (ex.: próximo código) — chega depois e
    // só atualiza o form, sem travar a abertura da modal.
    if (obterValoresPadrao) {
      obterValoresPadrao()
        .then((extra) => setForm((f) => ({ ...f, ...extra })))
        .catch(() => {});
    }
  }

  // Abre o formulário de "Novo" automaticamente ao montar — usado quando a
  // página já define um contexto (ex.: prefeitura escolhida antes) e quer
  // ir direto pro cadastro, sem passar pela listagem primeiro.
  useEffect(() => {
    if (autoAbrirNovo) abrirNovo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAbrirNovo]);

  function abrirEdicao(item) {
    // Campos vazios herdam o valor padrão do contexto atual (ex.: prefeitura
    // selecionada na tela anterior) em vez de ficar em branco — registros
    // antigos sem esse dado passam a ser corrigidos ao serem reabertos.
    const mesclado = { ...item };
    Object.entries(valoresPadrao || {}).forEach(([campo, valor]) => {
      if (mesclado[campo] === "" || mesclado[campo] === null || mesclado[campo] === undefined) {
        mesclado[campo] = valor;
      }
    });
    setForm(formatarCamposMoeda(mesclado));
    setEditando(item);
    setErro("");
  }

  function fechar() {
    setEditando(null);
  }

function cancelarExclusao() {
    setExcluindo(null);
    setSenhaExclusao("");
    setErroExclusao("");
  }

async function confirmarExclusao() {
    setApagando(true);
    setErroLista("");
    setErroExclusao("");
    try {
      const resposta = await (exigirSenhaParaExcluir
        ? api.excluir(excluindo[idKey], senhaExclusao)
        : api.excluir(excluindo[idKey]));
      cancelarExclusao();
      // O backend pode recusar apagar e só desativar (ex.: material com histórico) — avisa.
      setAvisoLista(resposta?.mensagem || "");
      carregar();
    } catch (err) {
      // Mantém o diálogo aberto mostrando o motivo (senha errada, registro em uso...).
      setErroExclusao(err.message);
    } finally {
      setApagando(false);
    }
  }

  // Campos com `unico: true`: avisa já no formulário se o valor (sem espaços,
  // maiúsculas) repete o de outro registro da lista — o backend também barra.
  const normalizarUnico = (v) => String(v ?? "").trim().toUpperCase();
  const duplicadoDe = (c) => {
    if (!c.unico || !editando) return null;
    const valor = normalizarUnico(form[c.name]);
    if (!valor) return null;
    return itens.find((it) => it[idKey] !== editando[idKey] && normalizarUnico(it[c.name]) === valor) || null;
  };
  const camposDuplicados = campos.filter((c) => duplicadoDe(c));

  // Registro aberto só para consulta (ex.: reclamação concluída/validada).
  const travaLeitura = editando && editando[idKey] && somenteLeitura ? somenteLeitura(editando) : null;

  // Enter num campo não salva o formulário: vai para o próximo campo (e o
  // "sair do campo" roda — ex.: o CEP busca o endereço). Salvar só pelo botão.
  function enterVaiParaProximoCampo(e) {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT" || e.target.type === "submit") return;
    e.preventDefault();
    const campos = [...e.currentTarget.querySelectorAll("input, select, textarea")].filter(
      (el) => !el.disabled && el.type !== "hidden" && el.tabIndex !== -1 && el.offsetParent !== null
    );
    const proximo = campos[campos.indexOf(e.target) + 1];
    if (proximo) proximo.focus();
    else e.target.blur();
  }

  async function salvar(e) {
    e.preventDefault();
    if (travaLeitura) return;
    if (camposDuplicados.length) return;
    setSalvando(true);
    setErro("");
    let salvo = null;
    try {
      // Selects de FK (convenção "*_id") e campos numéricos (type "number" ou
      // mask "ano") sem valor ficam como "" no form, mas o backend espera
      // UUID/número válido ou null — nunca string vazia. Outros campos de
      // texto continuam aceitando "" normalmente.
      const camposNumericos = new Set(
        campos.filter((c) => c.type === "number" || c.mask === "ano").map((c) => c.name)
      );
      const camposMoeda = new Set(campos.filter((c) => c.mask === "moeda").map((c) => c.name));
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => {
          if (camposMoeda.has(k)) return [k, v === "" ? null : moedaParaNumero(v)];
          return [k, v === "" && (k.endsWith("_id") || camposNumericos.has(k)) ? null : v];
        })
      );
      if (editando && editando[idKey]) {
        salvo = await api.atualizar(editando[idKey], payload);
      } else {
        salvo = await api.criar(payload);
      }
      fechar();
      carregar();
      if (aoSalvar && salvo) aoSalvar(salvo);
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
        // Colunas com selo/elemento (Código, Status...) entram pelo texto visível.
        return textoDoNo(valor).toLowerCase().includes(termo);
      })
    );
  }, [itens, busca, colunasFinal]);

  return (
    <>
      <header className="topbar">
        <h1>{titulo}</h1>
        {podeCriar && (
          <button className="btn btn-primary" onClick={abrirNovo}>
            <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 6 }} />
            Novo
          </button>
        )}
      </header>

      <div className={"content" + (rolagemNaLista ? " content-lista-fixa" : "")}>
        {erroLista && <p className="erro-msg">{erroLista}</p>}
        {avisoLista && (
          <p className="aviso-msg">
            <i className="ti ti-info-circle" aria-hidden="true" style={{ marginRight: 6 }} />
            {avisoLista}
            <button type="button" className="btn btn-ghost" onClick={() => setAvisoLista("")} title="Fechar aviso">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </p>
        )}
        <div className="filtros-linha">
          {filtroTopo}
          {/* Com ação após o filtro (ex.: Designar equipe), busca + ação vão para a direita. */}
          <div
            className={acaoAposFiltro ? "filtros-direita" : undefined}
            style={
              acaoAposFiltro ? { marginLeft: "auto", display: "flex", gap: 12, alignItems: "flex-start" } : { display: "contents" }
            }
          >
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
            {acaoAposFiltro}
          </div>
        </div>
        <div className={"card" + (rolagemNaLista ? " card-lista-rolavel" : "")}>
          {carregando ? (
            <div className="empty-state">Carregando...</div>
          ) : exigeFiltro && !queryExtra ? (
            <div className="empty-state">Selecione um município para ver os bairros.</div>
          ) : itens.length === 0 ? (
            <div className="empty-state">Nenhum registro ainda.</div>
          ) : itensFiltrados.length === 0 ? (
            <div className="empty-state">Nenhum resultado para "{busca}".</div>
          ) : (
            <table className={classeTabela}>
              <thead>
                <tr>
                  {colunasFinal.map((c) => (
                    <th
                      key={c.key}
                      style={{ ...(c.width ? { width: c.width } : {}), ...(c.centro ? { textAlign: "center" } : {}) }}
                    >
                      {c.label}
                    </th>
                  ))}
                  {(podeEditar || podeExcluir || acoesExtras) && <th style={{ width: 90 }}>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map((item) => (
                  <tr key={item[idKey]}>
                    {colunasFinal.map((c) => (
                      <td key={c.key} style={c.centro ? { textAlign: "center" } : undefined}>
                        {c.render ? c.render(item) : String(item[c.key] ?? "")}
                      </td>
                    ))}
                    {(podeEditar || podeExcluir || acoesExtras) && (
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {acoesExtras && acoesExtras(item)}
                          {podeEditar && (
                            <button className="btn btn-ghost" onClick={() => abrirEdicao(item)} title="Editar">
                              <i className="ti ti-edit" aria-hidden="true" />
                            </button>
                          )}
                          {podeExcluir && (
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
          <div
            className="modal"
            style={{
              ...(alturaModal ? { minHeight: alturaModal } : undefined),
              ...(larguraModal ? { width: larguraModal } : undefined),
            }}
          >
            <h2>{travaLeitura ? "Consultar" : editando[idKey] ? "Editar" : "Novo"} registro</h2>
            {notaModal && <p className="aviso-msg">{notaModal}</p>}
            {travaLeitura && (
              <p className="aviso-msg">
                <i className="ti ti-lock" aria-hidden="true" style={{ marginRight: 6 }} />
                {travaLeitura}
              </p>
            )}
            <form onSubmit={salvar} onKeyDown={enterVaiParaProximoCampo}>
              <fieldset disabled={Boolean(travaLeitura)} className="fieldset-limpo">
              <div className="form-grid">
              {campos.filter((c) => !c.visivel || c.visivel(form) || c.reservarEspaco).map((c) =>
                c.visivel && !c.visivel(form) ? (
                  <div style={{ gridColumn: `span ${tamanhoDoCampo(c)}` }} key={c.name} aria-hidden="true" />
                ) : (
                <div className="form-field" style={{ "--span": tamanhoDoCampo(c) }} key={c.name}>
                  <label>{c.label}</label>
                  {duplicadoDe(c) && (
                    <span className="erro-campo-unico">
                      Já existe {c.rotuloUnico || "um registro"} com este valor. Não pode repetir.
                    </span>
                  )}
                  {c.type === "simnao" ? (
                    <select
                      className="select-simnao"
                      disabled={c.disabled}
                      value={form[c.name] ? "S" : "N"}
                      onChange={(e) => {
                        const sim = e.target.value === "S";
                        setForm((f) => (c.aoMudar ? c.aoMudar(sim, { ...f, [c.name]: sim }) : { ...f, [c.name]: sim }));
                      }}
                    >
                      <option value="N">Não</option>
                      <option value="S">Sim</option>
                    </select>
                  ) : c.type === "select" ? (
                    <select
                      required={typeof c.required === "function" ? c.required(form) : c.required}
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
                      required={typeof c.required === "function" ? c.required(form) : c.required}
                      value={form[c.name] ?? ""}
                      onChange={(valor) =>
                        c.aoSelecionar
                          ? setForm((f) => c.aoSelecionar(valor, f))
                          : setForm((f) => ({ ...f, [c.name]: valor }))
                      }
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
                      required={typeof c.required === "function" ? c.required(form) : c.required}
                      rows={c.rows || 4}
                      value={form[c.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [c.name]: e.target.value })}
                    />
                  ) : (
                    <input
                      type={c.type || "text"}
                      step={c.step}
                      required={typeof c.required === "function" ? c.required(form) : c.required}
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
                )
              )}
              </div>
              </fieldset>
              {erro && <p className="erro-msg">{erro}</p>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={fechar}>
                  Fechar
                </button>
                {!travaLeitura && (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={salvando || camposDuplicados.length > 0}
                    title={camposDuplicados.length ? "Corrija o campo repetido para salvar" : undefined}
                  >
                    {salvando ? "Salvando..." : "Salvar"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir registro"
        mensagem={
          mensagemExclusao && excluindo
            ? mensagemExclusao(excluindo)
            : `Excluir "${excluindo?.nome || excluindo?.numero || excluindo?.placa || excluindo?.codigo || "este registro"}"? Essa ação não pode ser desfeita.`
        }
        confirmando={apagando}
        onConfirmar={confirmarExclusao}
        onCancelar={cancelarExclusao}
        senha={exigirSenhaParaExcluir ? senhaExclusao : undefined}
        onSenhaChange={exigirSenhaParaExcluir ? setSenhaExclusao : undefined}
        erro={erroExclusao}
      />
    </>
  );
}
