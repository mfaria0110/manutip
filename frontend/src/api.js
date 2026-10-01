const BASE = "/api";

function token() {
  return localStorage.getItem("manutip_token");
}

async function req(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const resp = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail || `Erro ${resp.status}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

export function login(username, senha) {
  return req("/login", { method: "POST", body: JSON.stringify({ username, senha }) }).then((r) => {
    localStorage.setItem("manutip_token", r.token);
    return r;
  });
}

export function logout() {
  localStorage.removeItem("manutip_token");
}

export function meuPerfil() {
  return req("/me");
}

export function salvarTema(tema) {
  return req("/me/tema", { method: "PUT", body: JSON.stringify({ tema }) });
}

// Fábrica de um client CRUD padrão para os cadastros simples.
function crud(path) {
  return {
    listar: (query = "") => req(`${path}${query}`),
    obter: (id) => req(`${path}/${id}`),
    criar: (dados) => req(path, { method: "POST", body: JSON.stringify(dados) }),
    atualizar: (id, dados) => req(`${path}/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
    excluir: (id) => req(`${path}/${id}`, { method: "DELETE" }),
  };
}

export const apiUsuarios = crud("/usuarios");
export const apiCidades = crud("/cidades");
export const apiBairros = crud("/bairros");
export const apiPrefeituras = crud("/prefeituras");
export const apiAtividades = crud("/atividades");
export const apiCargos = crud("/cargos");
export const apiMaoObra = crud("/mao-obra");
export const apiMateriais = crud("/materiais");
export const apiVeiculos = crud("/veiculos");
export const apiFuncionarios = crud("/funcionarios");
export const apiContratos = crud("/contratos");
export const apiPrecosPonto = crud("/precos-ponto");
export const apiOrdensServico = crud("/ordens-servico");

// Mantidos para compatibilidade com código existente.
export const listarUsuarios = apiUsuarios.listar;
export const criarUsuario = apiUsuarios.criar;
export const atualizarUsuario = apiUsuarios.atualizar;
