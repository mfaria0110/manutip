// Datas chegam da API como "AAAA-MM-DD" e horas como "HH:MM:SS"; na tela
// aparecem no padrão brasileiro (dia/mês/ano e HH:MM).
export function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = String(iso).slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function formatarHora(hora) {
  return hora ? String(hora).slice(0, 5) : "";
}

// Data de hoje no fuso do navegador ("AAAA-MM-DD"). Não usar toISOString() pra
// isso: ele devolve a data em UTC e, à noite no Brasil, já é "amanhã".
export function hojeLocal() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
