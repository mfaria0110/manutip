import { useOffline } from "./offline/OfflineContext";

export default function FaixaOffline() {
  const { online, pendentes, sincronizando } = useOffline();

  if (online && pendentes === 0) return null;

  let texto;
  if (!online) {
    texto = pendentes > 0 ? `Sem internet — ${pendentes} pendente${pendentes > 1 ? "s" : ""} de sincronizar` : "Sem internet";
  } else if (sincronizando) {
    texto = "Sincronizando...";
  } else {
    texto = `${pendentes} pendente${pendentes > 1 ? "s" : ""} de sincronizar`;
  }

  return <div className="offline-aviso">{texto}</div>;
}
