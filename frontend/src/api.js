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

export function login(email, senha) {
  return req("/login", { method: "POST", body: JSON.stringify({ email, senha }) }).then((r) => {
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

export function listarUsuarios() {
  return req("/usuarios");
}

export function criarUsuario(dados) {
  return req("/usuarios", { method: "POST", body: JSON.stringify(dados) });
}

export function atualizarUsuario(id, dados) {
  return req(`/usuarios/${id}`, { method: "PUT", body: JSON.stringify(dados) });
}
