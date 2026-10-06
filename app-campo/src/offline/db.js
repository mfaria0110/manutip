import { openDB } from "idb";

const NOME_DB = "manutip-campo";
const VERSAO_DB = 1;

let promessaDB = null;

// Um único IndexedDB com 2 object stores:
// - "cache": pares chave/valor simples — listas de referência (equipes de
//   hoje, materiais, reclamações abertas...) baixadas na última vez que
//   houve internet, pra telas abrirem mesmo offline.
// - "fila": ações pendentes de sincronizar (equipe validada, execução
//   salva, foto anexada) — processadas em ordem assim que a rede volta.
export function abrirDB() {
  if (!promessaDB) {
    promessaDB = openDB(NOME_DB, VERSAO_DB, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache");
        }
        if (!db.objectStoreNames.contains("fila")) {
          db.createObjectStore("fila", { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return promessaDB;
}
