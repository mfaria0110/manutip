// Busca de endereço por CEP via ViaCEP (API pública gratuita) — mesmo padrão
// usado no EcoWatt (DadosCliente.jsx).
export async function buscarEnderecoPorCep(cep) {
  const digitos = (cep || "").replace(/\D/g, "");
  if (digitos.length !== 8) {
    throw new Error("CEP deve ter 8 dígitos.");
  }
  const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
  const d = await resp.json();
  if (d.erro) {
    throw new Error("CEP não encontrado.");
  }
  return {
    logradouro: d.logradouro || "",
    bairro: d.bairro || "",
    cidade: d.localidade || "",
    uf: d.uf || "",
  };
}
