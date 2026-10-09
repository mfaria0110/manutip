const BASE = "/api";
// Chave própria (diferente de "manutip_token" do site de escritório) —
// mesmo domínio, mas sessões independentes: um dispositivo de campo não
// deve herdar nem disputar sessão com uma aba do site aberta no mesmo navegador.
const CHAVE_TOKEN = "manutip_campo_token";

function token() {
  return localStorage.getItem(CHAVE_TOKEN);
}

async function req(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let resp;
  try {
    resp = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    const generico =
      resp.status >= 500
        ? "O servidor está indisponível no momento. Tente novamente em instantes."
        : `Erro ${resp.status}`;
    let mensagem = generico;
    if (typeof body.detail === "string") {
      mensagem = body.detail;
    } else if (Array.isArray(body.detail)) {
      mensagem = body.detail.map((e) => e.msg || JSON.stringify(e)).join("; ");
    }
    throw new Error(mensagem);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

export function login(username, senha) {
  return req("/login", { method: "POST", body: JSON.stringify({ username, senha }) }).then((r) => {
    localStorage.setItem(CHAVE_TOKEN, r.token);
    return r;
  });
}

export async function logout() {
  try {
    await req("/logout", { method: "POST" });
  } catch {
    // mesmo se o servidor estiver fora, limpa o token local
  }
  localStorage.removeItem(CHAVE_TOKEN);
}

export function heartbeat() {
  return req("/heartbeat", { method: "POST" });
}

export function meuPerfil() {
  return req("/me");
}

function crud(path) {
  return {
    listar: (query = "") => req(`${path}${query}`),
    obter: (id) => req(`${path}/${id}`),
    criar: (dados) => req(path, { method: "POST", body: JSON.stringify(dados) }),
    atualizar: (id, dados) => req(`${path}/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  };
}

export const apiPrefeituras = crud("/prefeituras");
export const apiCidades = crud("/cidades");
export const apiBairros = crud("/bairros");
export const apiFuncionarios = crud("/funcionarios");
export const apiVeiculos = crud("/veiculos");
export const apiCargos = crud("/cargos");
export const apiMateriais = crud("/materiais");
export const apiCategoriasMaterial = crud("/categorias-material");
export const apiTiposLampada = crud("/tipos-lampada");
export const apiPotenciasLampada = crud("/potencias-lampada");
export const apiReclamacoes = crud("/reclamacoes");

export const apiEquipesDia = crud("/equipes");
// Roteiro do dia: reclamações designadas a cada equipe (feito pelo escritório).
export const apiDesignacoes = {
  listar: (query = "") => req(`/designacoes${query}`),
};
export function proximoNomeEquipe() {
  return req("/equipes/proximo-nome");
}
export function validarEquipe(id) {
  return req(`/equipes/${id}/validar`, { method: "POST" });
}

export const apiExecucoesReclamacao = crud("/execucoes-reclamacao");
export function anexarFotoExecucao(execucaoId, arquivo) {
  const form = new FormData();
  form.append("arquivo", arquivo);
  return req(`/execucoes-reclamacao/${execucaoId}/fotos`, { method: "POST", body: form });
}

// <img src> não manda o header Authorization — baixa com fetch autenticado
// e devolve uma URL de blob local pra usar no <img>.
export async function obterFotoURL(fotoUrl) {
  const t = token();
  const resp = await fetch(fotoUrl, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!resp.ok) throw new Error("Não foi possível carregar a foto.");
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}
