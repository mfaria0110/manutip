// Endereço a partir da posição do aparelho (GPS) — geocodificação reversa no
// OpenStreetMap (Nominatim, serviço público gratuito). Só é chamado quando a
// equipe toca em "Buscar pela minha localização"; as coordenadas vão apenas
// para esse serviço.

export function posicaoAtual() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este aparelho não tem GPS disponível."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err?.code === 1) reject(new Error("A localização está bloqueada para este site. Libere a permissão de localização e tente de novo."));
        else if (err?.code === 3) reject(new Error("O GPS demorou para responder. Tente de novo."));
        else reject(new Error("Sem sinal de GPS no momento. Vá para um local aberto e tente de novo."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export async function enderecoPorPosicao({ lat, lng }) {
  const url =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=pt-BR" +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
  let resp;
  try {
    resp = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Não foi possível consultar o endereço (sem internet?).");
  }
  if (!resp.ok) throw new Error("O serviço de endereço não respondeu. Tente de novo em instantes.");
  const d = await resp.json();
  const a = d?.address || {};
  const logradouro = a.road || a.pedestrian || a.footway || a.residential || a.path || "";
  if (!logradouro) throw new Error("Não foi encontrada uma rua para esta posição. Preencha o endereço manualmente.");
  const cidade = a.city || a.town || a.municipality || a.village || "";
  const uf = (a["ISO3166-2-lvl4"] || "").replace(/^BR-/, "");
  // Bairro do mapa costuma vir errado: confirma pelos Correios (ViaCEP) a partir de rua + cidade.
  const correios = await bairrosNosCorreios(uf, cidade, logradouro);
  return {
    logradouro,
    numero: a.house_number || "",
    cidade,
    // Bairro(s) oficiais dos Correios para esta rua (pode vir vazio ou mais de um).
    bairrosCorreios: correios.bairros,
    cepCorreios: correios.cep,
    // Só sugestão (não é usado sozinho): o que o mapa diz.
    bairroMapa: a.suburb || a.neighbourhood || a.quarter || a.city_district || "",
    cep: a.postcode || "",
  };
}

async function bairrosNosCorreios(uf, cidade, rua) {
  if (!uf || !cidade || rua.length < 3) return { bairros: [], cep: "" };
  try {
    const resp = await fetch(
      `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`
    );
    const lista = await resp.json();
    if (!Array.isArray(lista)) return { bairros: [], cep: "" };
    const doMunicipio = lista.filter((x) => (x.localidade || "").toLowerCase() === cidade.toLowerCase());
    const bairros = [...new Set(doMunicipio.map((x) => x.bairro).filter(Boolean))];
    // CEP só quando a rua tem um único CEP (ruas longas têm vários, por trecho).
    const ceps = [...new Set(doMunicipio.map((x) => x.cep))];
    return { bairros, cep: ceps.length === 1 ? ceps[0] : "" };
  } catch {
    return { bairros: [], cep: "" };
  }
}
