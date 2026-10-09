// Colunas do Relatório de Pontos Atendidos — compartilhadas com o roteiro do
// dia (formulário de designação), que imprime no mesmo modelo.

// Abreviações pra caber mais colunas na largura impressa — só muda o
// rótulo exibido, o código da categoria continua o mesmo.
export const ABREVIACOES = {
  CONECTOR: "Conx",
  ISOLADOR: "Isol",
  CONDUTOR: "Cond",
  LAMPADA: "Lamp",
};

// Essas categorias entram somadas em Outros — viram colunas "visíveis" a
// menos na tabela, sem perder o valor lançado.
export const CATEGORIAS_MESCLADAS_EM_OUTROS = ["ISOLANTES", "BRACO", "FERRAGENS", "ISOLADOR", "POSTE"];

// Lâmpada vira coluna própria (antes de Pot.(W)); as demais seguem esta ordem fixa.
export const ORDEM_CATEGORIAS = ["RELE", "BASE", "CONDUTOR", "CONECTOR", "LUMINARIA", "OUTROS", "REFLETOR"];

export function colunasDoRelatorio(categorias) {
  const categoriaLampada = categorias.find((c) => c.codigo === "LAMPADA");
  const categoriasVisiveis = categorias
    .filter((c) => !CATEGORIAS_MESCLADAS_EM_OUTROS.includes(c.codigo) && c.codigo !== "LAMPADA")
    .sort((a, b) => ORDEM_CATEGORIAS.indexOf(a.codigo) - ORDEM_CATEGORIAS.indexOf(b.codigo));
  return { categoriaLampada, categoriasVisiveis };
}
