import { comDB } from "./db";

// O cache é só um reforço pra funcionar sem internet: se o armazenamento do
// navegador falhar (conexão fechada pelo Safari, modo privado, sem espaço), o
// app segue com o que veio da API em vez de mostrar erro técnico na tela.
export async function salvarCache(chave, valor) {
  try {
    await comDB((db) => db.put("cache", valor, chave));
  } catch {
    // sem cache local nesta rodada
  }
}

export async function lerCache(chave) {
  try {
    return await comDB((db) => db.get("cache", chave));
  } catch {
    return undefined;
  }
}

/** Busca na API e atualiza o cache; se a busca falhar (offline ou servidor
 * fora), cai pro que tiver salvo localmente — erro original se nunca baixou. */
export async function comCache(chave, buscar) {
  let dados;
  try {
    dados = await buscar();
  } catch (erro) {
    const salvo = await lerCache(chave);
    if (salvo !== undefined) return { dados: salvo, deCache: true };
    throw erro;
  }
  await salvarCache(chave, dados);
  return { dados, deCache: false };
}
