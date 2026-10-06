const BASE = "/api";

function token() {
  return localStorage.getItem("manutip_token");
}

async function req(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
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
    // FastAPI manda `detail` como string normalmente, mas em erro de
    // validação (422) vem uma lista de {loc, msg, type} — nunca jogar
    // esse array direto num Error (vira "[object Object]" na tela).
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
    localStorage.setItem("manutip_token", r.token);
    return r;
  });
}

export async function logout() {
  try {
    await req("/logout", { method: "POST" });
  } catch {
    // Mesmo se o servidor estiver fora, limpa o token local — não trava o
    // usuário na tela de login por causa disso.
  }
  localStorage.removeItem("manutip_token");
}

export function heartbeat() {
  return req("/heartbeat", { method: "POST" });
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
export const apiCargos = crud("/cargos");
export const apiMateriais = crud("/materiais");
export const apiCategoriasMaterial = crud("/categorias-material");
export const apiVeiculos = crud("/veiculos");
export const apiFuncionarios = crud("/funcionarios");
export const apiContratos = crud("/contratos");
export const apiPrecosPonto = crud("/precos-ponto");
export const apiPontosMaterialContrato = {
  matriz: (contratoId) => req(`/pontos-material-contrato/matriz?contrato_id=${contratoId}`),
  salvarMatriz: (contratoId, itens) =>
    req(`/pontos-material-contrato/matriz?contrato_id=${contratoId}`, {
      method: "PUT",
      body: JSON.stringify({ itens }),
    }),
  vigente: (prefeituraId, data) => req(`/pontos-material-contrato/vigente?prefeitura_id=${prefeituraId}&data=${data}`),
};
export const apiReclamacoes = crud("/reclamacoes");
export function reabrirReclamacao(id, username, senha) {
  return req(`/reclamacoes/${id}/reabrir`, { method: "POST", body: JSON.stringify({ username, senha }) });
}
export const apiEquipesDia = crud("/equipes");
export function proximoNomeEquipe() {
  return req("/equipes/proximo-nome");
}
export const apiExecucoesReclamacao = crud("/execucoes-reclamacao");
// <img src> não manda o header Authorization — baixa com fetch autenticado
// e devolve uma URL de blob local pra usar no <img>.
export async function obterFotoURL(fotoUrl) {
  const t = token();
  const resp = await fetch(fotoUrl, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!resp.ok) throw new Error("Não foi possível carregar a foto.");
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}
export const apiItensExecucao = {
  atualizar: (id, dados) => req(`/execucoes-reclamacao/itens/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  excluir: (id) => req(`/execucoes-reclamacao/itens/${id}`, { method: "DELETE" }),
};
export const apiTiposLampada = crud("/tipos-lampada");
export const apiPotenciasLampada = crud("/potencias-lampada");

export function proximoCodigoMaterial() {
  return req("/materiais/proximo-codigo");
}

export function relatorioPontosAtendidos(prefeituraId, dataInicio, dataFim) {
  const params = new URLSearchParams({
    prefeitura_id: prefeituraId,
    data_inicio: dataInicio,
    data_fim: dataFim,
  });
  return req(`/relatorios/pontos-atendidos?${params}`);
}

// Mantidos para compatibilidade com código existente.
export const listarUsuarios = apiUsuarios.listar;
export const criarUsuario = apiUsuarios.criar;
export const atualizarUsuario = apiUsuarios.atualizar;
