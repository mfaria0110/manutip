import { abrirDB } from "./db";

export async function salvarCache(chave, valor) {
  const db = await abrirDB();
  await db.put("cache", valor, chave);
}

export async function lerCache(chave) {
  const db = await abrirDB();
  return db.get("cache", chave);
}

/** Busca na API e atualiza o cache; se a busca falhar (offline ou servidor
 * fora), cai pro que tiver salvo localmente — undefined se nunca baixou. */
export async function comCache(chave, buscar) {
  try {
    const dados = await buscar();
    await salvarCache(chave, dados);
    return { dados, deCache: false };
  } catch (erro) {
    const dados = await lerCache(chave);
    if (dados !== undefined) return { dados, deCache: true };
    throw erro;
  }
}
