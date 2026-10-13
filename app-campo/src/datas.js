// Data de hoje no fuso do aparelho ("AAAA-MM-DD"). Não usar toISOString() pra
// isso: ele devolve a data em UTC e, à noite no Brasil, já é "amanhã".
export function hojeLocal() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Hora de agora no fuso do aparelho ("HH:MM:SS"), gravada como hora da execução.
export function horaAgoraLocal() {
  const d = new Date();
  const dois = (n) => String(n).padStart(2, "0");
  return `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
}

export function formatarData(iso) {
  return iso ? iso.split("-").reverse().join("/") : "";
}
