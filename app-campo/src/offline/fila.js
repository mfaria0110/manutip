import { abrirDB } from "./db";
import { apiEquipesDia, apiExecucoesReclamacao, apiReclamacoes, anexarFotoExecucao, validarEquipe } from "../api";
import { salvarCache } from "./cache";

// Ação pendente: { tipo, payload, criadoEm }. Tipos:
// - "execucao": payload = { execucaoPayload, fotos: Blob[] }. execucaoPayload
//   leva uuid_local sempre — o POST no backend é idempotente por uuid_local,
//   então reenviar depois de uma falha no meio da sincronização não duplica.
// - "validarEquipe": payload = { equipeId }
// - "composicaoEquipe": payload = { equipeId, dados }
// - "concluirReclamacao": payload = { reclamacaoId }
export async function enfileirar(tipo, payload) {
  const db = await abrirDB();
  await db.add("fila", { tipo, payload, criadoEm: Date.now() });
}

export async function listarFila() {
  const db = await abrirDB();
  return db.getAll("fila");
}

export async function contarPendentes() {
  const db = await abrirDB();
  return db.count("fila");
}

async function processarItem(item) {
  const { tipo, payload } = item;
  if (tipo === "execucao") {
    const salva = payload.execucaoPayload.id
      ? await apiExecucoesReclamacao.atualizar(payload.execucaoPayload.id, payload.execucaoPayload)
      : await apiExecucoesReclamacao.criar(payload.execucaoPayload);
    for (const foto of payload.fotos || []) {
      await anexarFotoExecucao(salva.id, foto);
    }
    // Limpa o rascunho local — o servidor já tem a versão mais recente.
    await salvarCache(`rascunhoExecucao:${payload.execucaoPayload.reclamacao_id}:${payload.execucaoPayload.equipe_dia_id}`, null);
    return;
  }
  if (tipo === "validarEquipe") {
    await validarEquipe(payload.equipeId);
    return;
  }
  if (tipo === "composicaoEquipe") {
    await apiEquipesDia.atualizar(payload.equipeId, payload.dados);
    return;
  }
  if (tipo === "concluirReclamacao") {
    await apiReclamacoes.atualizar(payload.reclamacaoId, { status: "CONCLUIDA" });
    return;
  }
}

// Processa a fila em ordem (uma ação depende da anterior já ter ido, ex.:
// equipe validada antes da execução que a referencia) — para no primeiro
// erro pra não embaralhar a ordem nem perder nada.
export async function sincronizar() {
  if (!navigator.onLine) return { sincronizados: 0, restantes: await contarPendentes() };
  const db = await abrirDB();
  const itens = await db.getAll("fila");
  let sincronizados = 0;
  for (const item of itens) {
    try {
      await processarItem(item);
      await db.delete("fila", item.id);
      sincronizados++;
    } catch {
      break;
    }
  }
  return { sincronizados, restantes: await contarPendentes() };
}
