import { useCallback, useEffect, useState } from "react";
import ComboCriavel from "../ComboCriavel";
import { apiFuncionarios, apiPerfis, apiUsuarios } from "../api";
import { useAcesso } from "../AcessoContext";

// Usuários e perfis de acesso — mesma lógica do PodAPS. O PERFIL diz o que a
// pessoa pode fazer (permissões por módulo, editáveis na aba Perfis de acesso;
// "Ler" de um módulo = item no menu e a tela abre).
// Mesma hierarquia do servidor: só se mostra perfil do mesmo nível ou abaixo do meu.
const NIVEL_PERFIL = { superadmin: 0, admin: 1, usuario: 2, operacional: 2 };
const nivelDe = (codigo) => NIVEL_PERFIL[codigo] ?? 1;
const lerAba = () => {
  try {
    return sessionStorage.getItem("usuarios_aba") || "usuarios";
  } catch {
    return "usuarios";
  }
};

function useCarregar(fn, ativo = true) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const recarregar = useCallback(() => {
    if (!ativo) return;
    fn()
      .then((d) => {
        setDados(d);
        setErro("");
      })
      .catch((e) => setErro(e.message));
  }, [fn, ativo]);
  useEffect(() => {
    recarregar();
  }, [recarregar]);
  return [dados, erro, recarregar];
}

export default function Usuarios() {
  const { pode } = useAcesso();
  // Aba Usuários: permissão de Usuários. Aba Perfis: superadmin (ou só leitura, se ele liberar "Perfis de acesso → Ler").
  const abas = [pode("usuarios.acesso") && ["usuarios", "Usuários"], pode("perfis.acesso") && ["perfis", "Perfis de acesso"]].filter(Boolean);
  const [escolhida, setAba] = useState(lerAba);
  const aba = abas.some(([v]) => v === escolhida) ? escolhida : abas[0]?.[0];
  const escolher = (a) => {
    setAba(a);
    try {
      sessionStorage.setItem("usuarios_aba", a);
    } catch {
      /* sem armazenamento */
    }
  };
  return (
    <>
      <header className="topbar">
        <h1>Usuários</h1>
      </header>
      <div className="abas" role="tablist">
        {abas.map(([v, t]) => (
          <button key={v} type="button" role="tab" aria-selected={aba === v} className={aba === v ? "ativo" : ""} onClick={() => escolher(v)}>
            {t}
          </button>
        ))}
      </div>
      {aba === "usuarios" && <ListaUsuarios />}
      {aba === "perfis" && <Perfis />}
      {!aba && <div className="card"><div className="empty-state">Sem permissão.</div></div>}
    </>
  );
}

// ---------------------------------------------------------------- usuários

function ListaUsuarios() {
  const { pode } = useAcesso();
  const [lista, erro, recarregar] = useCarregar(apiUsuarios.listar);
  const [perfis] = useCarregar(apiPerfis.listar);
  const [funcionarios] = useCarregar(apiFuncionarios.listar);
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState("");
  const perfilDe = (codigo) => (perfis || []).find((p) => p.codigo === codigo);
  const termo = busca.trim().toLowerCase();
  const filtrados = (lista || []).filter(
    (u) => !termo || [u.nome, u.username, u.cpf, perfilDe(u.perfil)?.nome].some((x) => (x || "").toLowerCase().includes(termo))
  );

  return (
    <>
      <div className="topo-aba">
        {pode("usuarios.criar") && (
          <button className="btn btn-primary" onClick={() => setEditando({ perfil: "" })}>
            <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 6 }} />
            Novo usuário
          </button>
        )}
        <p className="muted">
          O <strong>perfil</strong> diz o que a pessoa pode fazer: quais telas abre e o que pode inserir, editar ou excluir
          (defina na aba Perfis de acesso). Clique no usuário para editar.
        </p>
      </div>
      {erro && <p className="erro-msg">{erro}</p>}
      <div className="card">
        <div className="table-header">
          <input placeholder="Buscar por nome, login, CPF ou perfil..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <table className="tabela-clicavel">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Usuário</th>
              <th>Perfil (o que faz)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((u) => (
              <tr
                key={u.id}
                onClick={() => (pode("usuarios.editar") || pode("usuarios.excluir")) && setEditando(u)}
                className={u.ativo ? "" : "linha-inativa"}
              >
                <td>{u.nome}</td>
                <td>{u.cpf || "—"}</td>
                <td>{u.username}</td>
                <td>{perfilDe(u.perfil)?.nome || u.perfil}</td>
                <td>
                  <span className={`badge ${u.ativo ? "badge-success" : "badge-muted"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && perfis && funcionarios && (
        <EditorUsuario
          usuario={editando}
          perfis={perfis}
          funcionarios={funcionarios}
          fechar={(ok) => {
            setEditando(null);
            if (ok) recarregar();
          }}
        />
      )}
    </>
  );
}

// Gera uma senha provisória (letras e números, sem caracteres que se confundem).
function gerarSenha() {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "23456789";
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  const cs = [...Array.from({ length: 6 }, () => pick(letras)), ...Array.from({ length: 3 }, () => pick(nums))];
  return cs.sort(() => Math.random() - 0.5).join("");
}

function EditorUsuario({ usuario, perfis, funcionarios, fechar }) {
  const { perfil: eu, pode, ehSuperadmin, recarregar } = useAcesso();
  const [catalogo] = useCarregar(apiPerfis.catalogo, pode("perfis.acesso"));
  const novo = !usuario.id;
  const proprio = !novo && String(usuario.id) === String(eu?.id);
  // O superadmin tem acesso a tudo — inclusive ao próprio perfil, login e CPF.
  const travado = proprio && !ehSuperadmin;
  const podeEditar = novo || pode("usuarios.editar");
  const podeExcluir = !novo && !proprio && pode("usuarios.excluir");
  // Só perfis que não dão mais do que eu tenho (o servidor confere também).
  const disponiveis = perfis.filter(
    (p) =>
      ehSuperadmin ||
      (!p.sistema &&
        nivelDe(p.codigo) >= nivelDe(eu?.perfil) &&
        (p.operacional ? pode("usuarios.criar_campo") : p.permissoes.every((x) => pode(x))))
  );
  const [d, setD] = useState({
    cpf: usuario.cpf || "",
    nome: usuario.nome || "",
    username: usuario.username || "",
    email: usuario.email || "",
    perfil: usuario.perfil || "",
    ativo: usuario.ativo !== false,
    senha: "",
  });
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const perfil = perfis.find((p) => p.codigo === d.perfil);
  const opcoesFuncionarios = funcionarios.filter((f) => f.cpf).map((f) => ({ value: f.cpf, label: `${f.nome} — ${f.cpf}` }));

  const menuDoPerfil = (p) => {
    if (!p) return "";
    if (p.sistema) return "Acesso total ao sistema.";
    if (p.operacional) return "Usa o app de campo (equipe do dia, reclamações e execuções).";
    if (!catalogo) return "";
    const lidos = catalogo.filter((m) => p.permissoes.includes(`${m.modulo}.acesso`));
    const cad = lidos.filter((m) => m.grupo).length;
    const itens = [...lidos.filter((m) => !m.grupo).map((m) => m.nome), ...(cad ? ["Cadastros"] : [])];
    return itens.length ? `Menu: ${itens.join(", ")}.` : "";
  };

  async function salvar(ev) {
    ev.preventDefault();
    setErro("");
    if (!d.cpf) return setErro("Escolha o funcionário (CPF).");
    if (!d.perfil) return setErro("Escolha o perfil.");
    const corpo = { nome: d.nome, email: d.email || null, cpf: d.cpf };
    if (!travado) Object.assign(corpo, { perfil: d.perfil, ativo: d.ativo });
    if (d.senha) corpo.senha = d.senha;
    setSalvando(true);
    try {
      if (novo) {
        await apiUsuarios.criar({ ...corpo, username: d.username, senha: d.senha, perfil: d.perfil });
      } else {
        if (d.username !== usuario.username) {
          if (
            !window.confirm(
              `Trocar o login de "${usuario.username}" para "${d.username}"?\n\nA pessoa passa a entrar com o login novo (a senha continua a mesma).`
            )
          ) {
            setSalvando(false);
            return;
          }
          corpo.username = d.username;
        }
        await apiUsuarios.atualizar(usuario.id, corpo);
        if (proprio) await recarregar();
      }
      fechar(true);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  // Sem histórico no sistema, o usuário sai de vez; com histórico, fica desativado (o servidor decide).
  async function excluir() {
    if (!window.confirm(`Excluir o usuário "${usuario.nome}"?\n\nSe ele já tiver registros no sistema, será só desativado.`)) return;
    try {
      const r = await apiUsuarios.excluir(usuario.id);
      if (r?.desativado) window.alert(`"${usuario.nome}" tem histórico no sistema e foi desativado.`);
      fechar(true);
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" style={{ width: 760 }} onSubmit={salvar}>
        <h2>{novo ? "Novo usuário" : `Editar · ${usuario.nome}`}</h2>
        {travado && (
          <div className="aviso-msg">
            Este é o seu próprio usuário: perfil e situação só a administração altera. Para trocar nome, e-mail ou senha, use
            "Meu cadastro" (clique no seu nome no topo).
          </div>
        )}

        <h3 className="passo">
          <span className="passo-num">1</span> Quem é a pessoa
        </h3>
        <div className="form-grid">
          <div className="form-field" style={{ "--span": 7 }}>
            <label>Funcionário (busque por nome ou CPF) *</label>
            <ComboCriavel
              required
              value={d.cpf}
              options={opcoesFuncionarios}
              onChange={(cpf) =>
                setD((x) => ({ ...x, cpf, nome: funcionarios.find((f) => f.cpf === cpf)?.nome || x.nome }))
              }
              onCriar={() =>
                Promise.reject(new Error("Funcionário não encontrado no cadastro. Cadastre-o em Funcionários primeiro."))
              }
            />
          </div>
          <div className="form-field" style={{ "--span": 5 }}>
            <label>Nome *</label>
            <input required value={d.nome} onChange={(e) => set("nome")(e.target.value)} />
          </div>
          <div className="form-field" style={{ "--span": 4 }}>
            <label>E-mail</label>
            <input type="email" value={d.email} onChange={(e) => set("email")(e.target.value)} />
          </div>
          <div className="form-field" style={{ "--span": 3 }}>
            <label>Usuário (login) *</label>
            <input
              required
              disabled={!novo && !podeEditar}
              value={d.username}
              autoComplete="off"
              onChange={(e) => set("username")(e.target.value.toLowerCase().replace(/\s/g, ""))}
            />
          </div>
          <div className="form-field" style={{ "--span": 5 }}>
            <label>{novo ? "Senha *" : "Nova senha (vazio = manter)"}</label>
            <span className="campo-com-botao">
              <input
                type={verSenha ? "text" : "password"}
                required={novo}
                minLength={8}
                autoComplete="new-password"
                value={d.senha}
                onChange={(e) => set("senha")(e.target.value)}
              />
              <button type="button" className="btn" onClick={() => setVerSenha(!verSenha)}>
                {verSenha ? "Ocultar" : "Mostrar"}
              </button>
              <button
                type="button"
                className="btn"
                title="Gera uma senha provisória (e mostra)"
                onClick={() => {
                  set("senha")(gerarSenha());
                  setVerSenha(true);
                }}
              >
                Gerar
              </button>
            </span>
          </div>
        </div>
        <p className="muted">
          Senha com pelo menos 8 caracteres, com letras e números. Passe a senha para a pessoa; depois ela pode trocar em "Meu
          cadastro".
        </p>

        <h3 className="passo">
          <span className="passo-num">2</span> O que ela pode fazer
        </h3>
        <div className="form-grid">
          <div className="form-field" style={{ "--span": 7 }}>
            <label>Perfil *</label>
            <select value={d.perfil} disabled={travado} onChange={(e) => set("perfil")(e.target.value)}>
              {!d.perfil && <option value="">Escolha o perfil…</option>}
              {(travado ? perfis.filter((p) => p.codigo === d.perfil) : disponiveis).map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.nome}
                  {p.operacional && !/campo/i.test(p.nome) ? " — app de campo" : ""}
                </option>
              ))}
            </select>
          </div>
          {!novo && (
            <div className="form-field" style={{ "--span": 5 }}>
              <label>Situação</label>
              <label className="check">
                <input
                  type="checkbox"
                  disabled={travado || !pode("usuarios.excluir")}
                  checked={d.ativo}
                  onChange={(e) => set("ativo")(e.target.checked)}
                />
                Ativo
              </label>
            </div>
          )}
        </div>
        {perfil && menuDoPerfil(perfil) && <p className="muted">{menuDoPerfil(perfil)}</p>}

        {erro && <p className="erro-msg">{erro}</p>}
        <div className="modal-actions">
          {podeExcluir && (
            <button type="button" className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={excluir}>
              Excluir
            </button>
          )}
          <button type="button" className="btn" onClick={() => fechar(false)}>
            Cancelar
          </button>
          {podeEditar && (
            <button className="btn btn-primary" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- perfis de acesso

// Colunas fixas da grade: Ler (= acesso: menu e tela), Inserir, Editar, Excluir; o resto vai em "Outras".
const COLUNAS = [
  ["acesso", "Ler"],
  ["criar", "Inserir"],
  ["editar", "Editar"],
  ["excluir", "Excluir"],
];

function Perfis() {
  const { ehSuperadmin } = useAcesso();
  const [perfis, erro, recarregar] = useCarregar(apiPerfis.listar);
  const [catalogo] = useCarregar(apiPerfis.catalogo);
  const [editando, setEditando] = useState(null);
  const [msg, setMsg] = useState("");
  // Menu do perfil: as telas que ele lê; os cadastros aparecem juntos ("Cadastros (3 de 9)").
  const menu = (p) => {
    const lidos = (catalogo || []).filter((m) => p.permissoes.includes(`${m.modulo}.acesso`));
    const cad = lidos.filter((m) => m.grupo).length;
    const total = (catalogo || []).filter((m) => m.grupo).length;
    return [...lidos.filter((m) => !m.grupo).map((m) => m.nome), ...(cad ? [`Cadastros (${cad} de ${total})`] : [])];
  };

  return (
    <>
      <div className="topo-aba">
        {ehSuperadmin && (
          <button className="btn btn-primary" onClick={() => setEditando({ nome: "", permissoes: [], operacional: false })}>
            <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 6 }} />
            Novo perfil
          </button>
        )}
        <p className="muted">
          Marque, para cada perfil, o que ele pode fazer em cada módulo. <strong>Ler</strong> = o item aparece no menu e a tela
          abre. Mudanças valem na hora para todos os usuários do perfil.
          {!ehSuperadmin && <> Somente leitura: criar, editar e excluir perfis é exclusivo do superadmin.</>}
        </p>
      </div>
      {erro && <p className="erro-msg">{erro}</p>}
      {msg && <div className="ok-msg">{msg}</div>}
      <div className="card">
        <table className="tabela-clicavel">
          <thead>
            <tr>
              <th>Perfil</th>
              <th>Tipo</th>
              <th>Menu (telas com acesso)</th>
              <th style={{ textAlign: "center" }}>Usuários</th>
            </tr>
          </thead>
          <tbody>
            {(perfis || []).map((p) => (
              <tr key={p.id} onClick={() => setEditando(p)}>
                <td>
                  <strong>{p.nome}</strong>
                  {p.sistema && <span className="muted"> · do sistema</span>}
                </td>
                <td>{p.sistema ? "Tudo" : p.operacional ? "Operacional (app de campo)" : "Gestão"}</td>
                <td>{p.sistema ? "Todas" : menu(p).join(", ") || "—"}</td>
                <td style={{ textAlign: "center" }}>{p.usuarios}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && catalogo && (
        <EditorPerfil
          perfil={editando}
          catalogo={catalogo}
          fechar={(texto) => {
            setEditando(null);
            if (texto) {
              setMsg(texto);
              recarregar();
            }
          }}
          copiar={(p) => setEditando({ nome: `${p.nome} (cópia)`, permissoes: [...p.permissoes], operacional: p.operacional })}
        />
      )}
    </>
  );
}

function EditorPerfil({ perfil, catalogo, fechar, copiar }) {
  const { ehSuperadmin } = useAcesso();
  const novo = !perfil.id;
  const editavel = ehSuperadmin && !perfil.sistema;
  const [nome, setNome] = useState(perfil.nome);
  const [operacional, setOperacional] = useState(!!perfil.operacional);
  const [marcadas, setMarcadas] = useState(() => new Set(perfil.permissoes));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const alternar = (x) =>
    setMarcadas((s) => {
      const n = new Set(s);
      n.has(x) ? n.delete(x) : n.add(x);
      return n;
    });

  async function salvar(ev) {
    ev.preventDefault();
    setErro("");
    // Módulo sem "Ler" não leva as demais permissões.
    const permissoes = [...marcadas].filter((x) =>
      catalogo.some(
        (m) => x.startsWith(`${m.modulo}.`) && (!m.acoes.some((a) => a.acao === "acesso") || marcadas.has(`${m.modulo}.acesso`))
      )
    );
    setSalvando(true);
    try {
      if (novo) await apiPerfis.criar({ nome, permissoes, operacional });
      else await apiPerfis.atualizar(perfil.id, { nome, permissoes, operacional });
      fechar(novo ? `Perfil "${nome}" criado.` : `Perfil "${nome}" salvo.`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!window.confirm(`Excluir o perfil "${perfil.nome}"?`)) return;
    try {
      await apiPerfis.excluir(perfil.id);
      fechar(`Perfil "${perfil.nome}" excluído.`);
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <div className="modal-overlay">
      <form className="modal modal-perfil" onSubmit={salvar}>
        <h2>{novo ? "Novo perfil de acesso" : `Perfil · ${perfil.nome}`}</h2>
        <div className="form-grid">
          <div className="form-field" style={{ "--span": 6 }}>
            <label>Nome do perfil *</label>
            <input required disabled={!editavel} value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="form-field" style={{ "--span": 6, justifyContent: "flex-end" }}>
            <label className="check" title={perfil.usuarios ? "O perfil já tem usuários: o tipo não muda" : ""}>
              <input
                type="checkbox"
                disabled={!editavel || !!perfil.usuarios}
                checked={operacional}
                onChange={(e) => setOperacional(e.target.checked)}
              />
              Operacional (usuário do app de campo)
            </label>
          </div>
        </div>
        {perfil.sistema && <div className="aviso-msg">Perfil do sistema: tem todas as permissões e não pode ser alterado.</div>}
        <div className="perfil-grade-caixa">
          <table className="perfil-grade">
            <thead>
              <tr>
                <th>Módulo</th>
                {COLUNAS.map(([, rot]) => (
                  <th key={rot} className="centro">
                    {rot}
                  </th>
                ))}
                <th>Outras permissões</th>
              </tr>
            </thead>
            <tbody>
              {catalogo.map((m, i) => {
                const acesso = m.acoes.find((a) => a.acao === "acesso");
                const temAcesso = !acesso || marcadas.has(acesso.permissao);
                const doGrupo = m.grupo && catalogo.filter((x) => x.grupo === m.grupo);
                const caixa = (a, inativa) => (
                  <input
                    type="checkbox"
                    aria-label={`${a.nome} · ${m.nome}`}
                    disabled={!editavel || inativa}
                    checked={perfil.sistema || marcadas.has(a.permissao)}
                    onChange={() => alternar(a.permissao)}
                  />
                );
                return [
                  // Cabeçalho do grupo (Cadastros): marca/desmarca a coluna inteira do grupo.
                  m.grupo && catalogo.findIndex((x) => x.grupo === m.grupo) === i && (
                    <tr key={`g-${m.grupo}`} className="perfil-grupo">
                      <td>
                        <strong>{m.grupo}</strong> <span className="muted">(marque a coluna inteira aqui ou cada cadastro abaixo)</span>
                      </td>
                      {COLUNAS.map(([acao, rot]) => {
                        const perms = doGrupo.map((x) => `${x.modulo}.${acao}`);
                        const todas = perms.every((x) => perfil.sistema || marcadas.has(x));
                        return (
                          <td key={acao} className="centro">
                            <input
                              type="checkbox"
                              aria-label={`${rot} em todos os ${m.grupo}`}
                              disabled={!editavel}
                              checked={todas}
                              onChange={() =>
                                setMarcadas((s0) => {
                                  const n = new Set(s0);
                                  perms.forEach((x) => (todas ? n.delete(x) : n.add(x)));
                                  if (!todas && acao !== "acesso") doGrupo.forEach((x) => n.add(`${x.modulo}.acesso`)); // inserir/editar/excluir pede ler
                                  return n;
                                })
                              }
                            />
                          </td>
                        );
                      })}
                      <td />
                    </tr>
                  ),
                  <tr key={m.modulo} className={`${temAcesso ? "" : "perfil-sem-acesso"}${m.grupo ? " perfil-subitem" : ""}`}>
                    <td>{m.grupo ? m.nome : <strong>{m.nome}</strong>}</td>
                    {COLUNAS.map(([acao]) => {
                      const a = m.acoes.find((x) => x.coluna === acao);
                      // Ação que o módulo não tem: caixa cinza, sem marcar (não se aplica).
                      return (
                        <td key={acao} className="centro" title={a ? a.nome : `Não se aplica: ${m.nome} não tem esta ação`}>
                          {a ? (
                            caixa(a, acao !== "acesso" && !temAcesso)
                          ) : (
                            <input type="checkbox" className="perfil-nao-aplica" disabled checked={false} readOnly aria-label={`${m.nome}: não se aplica`} />
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <div className="perfil-acoes">
                        {m.acoes
                          .filter((a) => !a.coluna)
                          .map((a) => (
                            <label key={a.permissao} className="check">
                              {caixa(a, !temAcesso)}
                              {a.nome}
                            </label>
                          ))}
                      </div>
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Sem <strong>Ler</strong>, o módulo não aparece no menu e as demais permissões dele ficam inativas. Caixa cinza = o módulo
          não tem essa ação (não se aplica). A senha pedida para reabrir uma reclamação é de quem tem{" "}
          <strong>Reclamações → Autorizar reabertura com senha</strong>.
        </p>
        {erro && <p className="erro-msg">{erro}</p>}
        <div className="modal-actions">
          {!novo && ehSuperadmin && !perfil.sistema && !perfil.usuarios && (
            <button type="button" className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={excluir}>
              Excluir
            </button>
          )}
          {!novo && ehSuperadmin && (
            <button type="button" className="btn" onClick={() => copiar(perfil)}>
              Copiar como novo
            </button>
          )}
          <button type="button" className="btn" onClick={() => fechar(null)}>
            Fechar
          </button>
          {editavel && (
            <button className="btn btn-primary" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar perfil"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
