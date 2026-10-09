// Data de hoje no fuso do aparelho ("AAAA-MM-DD"). Não usar toISOString() pra
// isso: ele devolve a data em UTC e, à noite no Brasil, já é "amanhã".
export function hojeLocal() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function formatarData(iso) {
  return iso ? iso.split("-").reverse().join("/") : "";
}
