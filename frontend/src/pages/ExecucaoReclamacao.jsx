import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAcesso } from "../AcessoContext";
import ComboCriavel from "../ComboCriavel";
import SelectLista from "../SelectLista";
import ConfirmDialog from "../ConfirmDialog";
import ModalNovaEquipe from "../ModalNovaEquipe";
import ModalNovoMaterial from "../ModalNovoMaterial";
import {
  apiBairros,
  apiCidades,
  apiEquipesDia,
  apiExecucoesReclamacao,
  apiItensExecucao,
  excluirFotoExecucao,
  importarFotosExecucao,
  obterFotoBlob,
  apiMateriais,
  apiPrefeituras,
  apiPontosMaterialContrato,
  apiPotenciasLampada,
  apiReclamacoes,
  apiTiposLampada,
  reabrirReclamacao,
} from "../api";
import { formatarData, formatarHora, hojeLocal } from "../formatos";

const LABEL_STATUS = {
  ABERTA: "Aberta",
  VALIDADA: "Validada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};

const rotuloCampo = { fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" };

function novoItem() {
  return {
    material_id: "",
    quantidade_instalada: 0,
    quantidade_retirada: 0,
    quantidade_substituida: 0,
    tipo_lampada_id: "",
    potencia_lampada_id: "",
  };
}

// total_pontos do item: cada quantidade (instalada/retirada/substituída)
// vezes o peso em pontos vigente pro material (vem do contrato da
// prefeitura, não mais de um valor fixo no cadastro de Material), somadas.
function totalPontosItem(item, pontos) {
  const qi = Number(pontos?.qde_pontos_inst) || 0;
  const qr = Number(pontos?.qde_pontos_ret) || 0;
  const qs = Number(pontos?.qde_pontos_subst) || 0;
  return (
    (Number(item.quantidade_instalada) || 0) * qi +
    (Number(item.quantidade_retirada) || 0) * qr +
    (Number(item.quantidade_substituida) || 0) * qs
  );
}

// Validada (ou validada e depois concluída) e Em andamento ficam travadas; Concluída
// também, exceto quando ainda não tem nenhuma execução (pode lançar a primeira).
function travadaParaLancar(reclamacao, execucoes) {
  if (!reclamacao) return true;
  if (reclamacao.validada_em || ["VALIDADA", "EM_ANDAMENTO"].includes(reclamacao.status)) return true;
  return reclamacao.status === "CONCLUIDA" && execucoes.length > 0;
}

export default function ExecucaoReclamacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefeituraId = searchParams.get("prefeitura_id");
  const voltarParaLista = () => navigate(prefeituraId ? `/reclamacoes?prefeitura_id=${prefeituraId}` : "/reclamacoes");
  const { pode } = useAcesso();
  const podeExcluir = pode("execucoes.excluir");

  const [reclamacao, setReclamacao] = useState(null);
  const [execucoes, setExecucoes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [equipes, setEquipes] = useState([]);
  const [bairros, setBairros] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [tiposLampada, setTiposLampada] = useState([]);
  const [potenciasLampada, setPotenciasLampada] = useState([]);
  // Pontos vigentes dos materiais no contrato da prefeitura desta
  // reclamação, pra data de execução escolhida — vem do contrato, não mais
  // de um valor fixo no cadastro de Material. Ausência de um material_id
  // aqui significa "sem pontos cadastrados", o que bloqueia o lançamento.
  const [pontosVigentes, setPontosVigentes] = useState({});
  const [erroPontosVigentes, setErroPontosVigentes] = useState("");
  // Tipo do contrato vigente (POR_PONTO | POR_ITEM) na data do formulário:
  // por ponto, a execução vale 1 ponto e os pontos por material não aparecem.
  const [tipoContrato, setTipoContrato] = useState("");
  // Card da reclamação: prefeitura e contrato (tipo) vigentes na data da última
  // execução — ou de hoje, se ainda não há execução.
  const [prefeituras, setPrefeituras] = useState([]);
  const [contratoCard, setContratoCard] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const [formAberto, setFormAberto] = useState(false);
  // Contrato por ponto: pontos informados à mão ("" = padrão 1). Edita com duplo clique.
  const [pontosManual, setPontosManual] = useState("");
  const [editandoPontos, setEditandoPontos] = useState(false);
  const [execucaoEditando, setExecucaoEditando] = useState(null); // null = criando nova
  // ids de outras execuções da mesma equipe+data, mescladas no formulário —
  // ao salvar, tudo vira uma execução só e essas são excluídas.
  const [idsParaMesclar, setIdsParaMesclar] = useState([]);
  const [dataExecucao, setDataExecucao] = useState("");
  // Lançado pelo sistema fica 00:00 (o app de campo grava a hora real); editável.
  const [horaExecucao, setHoraExecucao] = useState("00:00");
  // Término do atendimento (opcional; data/hora acima são o início).
  const [dataTermino, setDataTermino] = useState("");
  const [horaTermino, setHoraTermino] = useState("00:00");
  // Etiqueta (plaqueta) do ponto — fica na reclamação; padrão 0 (= "Descon." no relatório Mod-02).
  const [etiqueta, setEtiqueta] = useState("0");
  const [equipeId, setEquipeId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState([novoItem()]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modalEquipeAberto, setModalEquipeAberto] = useState(false);
  const [modalMaterialIdx, setModalMaterialIdx] = useState(null); // índice do item que pediu o material novo

  const [itemExcluindo, setItemExcluindo] = useState(null);
  const [apagandoItem, setApagandoItem] = useState(false);
  const [grupoExcluindo, setGrupoExcluindo] = useState(null); // execuções (sem material) a excluir
  const [apagandoGrupo, setApagandoGrupo] = useState(false);
  const [importandoFotos, setImportandoFotos] = useState(false);
  const [fotosModal, setFotosModal] = useState([]); // fotos da execução em edição: [{id, previewUrl}]
  // Execução NOVA ainda não tem id: as fotos escolhidas ficam aqui e são enviadas logo após o Salvar.
  const [fotosPendentes, setFotosPendentes] = useState([]); // [{ key, arquivo, previewUrl }]
  const [fotosExcluindo, setFotosExcluindo] = useState(null); // ids das fotos aguardando confirmação
  const [apagandoFotosModal, setApagandoFotosModal] = useState(false);
  const [avisoFotos, setAvisoFotos] = useState("");
  const [validando, setValidando] = useState(false);

  const [modalReabrirAberto, setModalReabrirAberto] = useState(false);
  const [reabrirUsername, setReabrirUsername] = useState("");
  const [reabrirSenha, setReabrirSenha] = useState("");
  const [erroReabrir, setErroReabrir] = useState("");
  const [reabrindo, setReabrindo] = useState(false);

  function carregar() {
    setCarregando(true);
    setErroLista("");
    Promise.all([apiReclamacoes.obter(id), apiExecucoesReclamacao.listar(`?reclamacao_id=${id}`)])
      .then(([rec, execs]) => {
        setReclamacao(rec);
        setExecucoes(execs);
      })
      .catch((e) => setErroLista(e.message))
      .finally(() => setCarregando(false));
  }

  // Veio do cadastro (salvou como Concluída): abre o formulário de execução uma vez.
  const abriuAutomatico = useRef(false);
  useEffect(() => {
    if (abriuAutomatico.current || carregando || !reclamacao) return;
    if (searchParams.get("lancar") !== "1") return;
    abriuAutomatico.current = true;
    if (execucoes.length === 0 && !travadaParaLancar(reclamacao, execucoes)) abrirNovaExecucao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, reclamacao, execucoes]);

  useEffect(() => {
    carregar();
    apiMateriais.listar().then(setMateriais);
    apiPrefeituras.listar().then(setPrefeituras);
    apiEquipesDia.listar().then(setEquipes);
    apiBairros.listar().then(setBairros);
    apiCidades.listar().then(setCidades);
    apiTiposLampada.listar().then(setTiposLampada);
    apiPotenciasLampada.listar().then(setPotenciasLampada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Pontos vigentes vêm do contrato da prefeitura desta reclamação, pra
  // data de execução escolhida no formulário — não do cadastro de Material
  // (que não tem mais peso fixo). Sem prefeitura/data ainda escolhidas, ou
  // sem contrato vigente para elas, o mapa fica vazio (bloqueia ao salvar).
  useEffect(() => {
    if (!reclamacao?.prefeitura_id) {
      setPontosVigentes({});
      setTipoContrato("");
      return;
    }
    // Nova execução abre com a data em branco: até escolher, usa o contrato
    // vigente hoje (senão o tipo fica "—" e aparecem as colunas de pontos por item).
    const dataRef = dataExecucao || hojeLocal();
    setErroPontosVigentes("");
    apiPontosMaterialContrato
      .contratoVigente(reclamacao.prefeitura_id, dataRef)
      .then((c) => setTipoContrato(c.tipo_contrato))
      .catch(() => setTipoContrato(""));
    apiPontosMaterialContrato
      .vigente(reclamacao.prefeitura_id, dataRef)
      .then(setPontosVigentes)
      .catch((e) => {
        setPontosVigentes({});
        setErroPontosVigentes(e.message);
      });
  }, [reclamacao?.prefeitura_id, dataExecucao]);

  const porPonto = tipoContrato === "POR_PONTO";
  // Colunas de pontos por material só em contrato Por item confirmado (tipo desconhecido não mostra).
  const mostrarPontosItem = tipoContrato === "POR_ITEM";

  useEffect(() => {
    if (!reclamacao?.prefeitura_id) {
      setContratoCard(null);
      return;
    }
    const dataRef = execucoes[0]?.data_execucao || hojeLocal();
    apiPontosMaterialContrato
      .contratoVigente(reclamacao.prefeitura_id, dataRef)
      .then(setContratoCard)
      .catch(() => setContratoCard(null));
  }, [reclamacao?.prefeitura_id, execucoes]);
  // Foto é da reclamação: com foto anexada, o último material lançado não pode ser excluído.
  const totalItensReclamacao = execucoes.reduce((n, ex) => n + ex.itens.length, 0);
  const totalFotosReclamacao = execucoes.reduce((n, ex) => n + (ex.fotos?.length || 0), 0);
  const ultimoMaterialTravado = totalItensReclamacao <= 1 && totalFotosReclamacao > 0;
  const nomeBairro = (bid) => bairros.find((b) => b.id === bid)?.nome || "—";
  const nomeCidade = (cid) => cidades.find((c) => c.id === cid)?.nome || "—";
  const materialPorId = (mid) => materiais.find((m) => m.id === mid);
  const nomeTipoLampada = (tid) => tiposLampada.find((t) => t.id === tid)?.nome || "—";
  const labelPotenciaLampada = (pid) => {
    const p = potenciasLampada.find((x) => x.id === pid);
    return p ? `${p.valor_w}W` : "—";
  };
  const opcoesTiposLampada = tiposLampada.map((t) => ({ value: t.id, label: t.nome }));
  const opcoesPotenciasLampada = potenciasLampada.map((p) => ({ value: p.id, label: `${p.valor_w} W` }));
  const nomeEquipe = (eid) => {
    const eq = equipes.find((e) => e.id === eid);
    if (!eq) return "—";
    const membros = eq.membros.map((m) => m.funcionario_nome).join(", ");
    return `${eq.nome || formatarData(eq.data_cadastro)} — ${membros || "sem membros"}`;
  };
  const composicaoEquipe = (eid) => {
    const eq = equipes.find((e) => e.id === eid);
    if (!eq || eq.membros.length === 0) return "Sem membros cadastrados.";
    return eq.membros.map((m) => (m.papel ? `${m.papel}: ${m.funcionario_nome}` : m.funcionario_nome)).join("\n");
  };

  function limparFotosPendentes() {
    setFotosPendentes((atuais) => {
      atuais.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      return [];
    });
  }

  function adicionarFotosPendentes(arquivos) {
    const novas = Array.from(arquivos || []).map((arquivo) => ({
      key: `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      arquivo,
      previewUrl: URL.createObjectURL(arquivo),
    }));
    if (novas.length > 0) setFotosPendentes((atuais) => [...atuais, ...novas]);
  }

  function removerFotoPendente(key) {
    setFotosPendentes((atuais) => {
      const alvo = atuais.find((f) => f.key === key);
      if (alvo) URL.revokeObjectURL(alvo.previewUrl);
      return atuais.filter((f) => f.key !== key);
    });
  }

  function abrirNovaExecucao() {
    setExecucaoEditando(null);
    setFotosModal([]);
    limparFotosPendentes();
    setIdsParaMesclar([]);
    // Em branco de propósito: o campo é obrigatório e obriga a informar a data real.
    setDataExecucao("");
    setHoraExecucao("00:00");
    setDataTermino("");
    setHoraTermino("00:00");
    setEtiqueta(reclamacao?.etiqueta || "0");
    setEquipeId("");
    setObservacoes("");
    setItens([novoItem()]);
    setPontosManual("");
    setEditandoPontos(false);
    setErro("");
    setFormAberto(true);
  }

  // Todas as execuções da reclamação com a mesma data + equipe de `ex` —
  // mesma noção usada para agrupar visualmente a lista (gruposPorData).
  function execucoesDoMesmoGrupo(ex) {
    return execucoes.filter(
      (e) => e.data_execucao === ex.data_execucao && (e.equipe_dia_id || "") === (ex.equipe_dia_id || "")
    );
  }

  // Edita a execução inteira (data/equipe/observações + todos os itens) —
  // aberta a partir do lápis de qualquer material. Traz junto os itens de
  // TODAS as execuções da mesma equipe+data (normalmente deveria haver só
  // uma, mas registros antigos podem estar espalhados em várias) — editar
  // e salvar consolida tudo numa execução só.
  // Exclui fotos (uma ou todas) da execução em edição; precisa da permissão Excluir (o servidor também exige).
  async function confirmarExclusaoFotosModal() {
    setApagandoFotosModal(true);
    setErro("");
    try {
      for (const fotoId of fotosExcluindo) {
        await excluirFotoExecucao(fotoId);
      }
      setAvisoFotos(`${fotosExcluindo.length} foto(s) excluída(s).`);
      setFotosExcluindo(null);
      const atualizadas = await apiExecucoesReclamacao.listar(`?reclamacao_id=${id}`);
      setExecucoes(atualizadas);
      if (execucaoEditando) {
        await carregarFotosDoModal(atualizadas, [execucaoEditando.id, ...idsParaMesclar]);
      }
    } catch (err) {
      setErro(err.message);
      setFotosExcluindo(null);
    } finally {
      setApagandoFotosModal(false);
    }
  }

  async function carregarFotosDoModal(listaExecs, idsGrupo) {
    const fotos = listaExecs.filter((e) => idsGrupo.includes(e.id)).flatMap((e) => e.fotos || []);
    const comPreview = await Promise.all(
      fotos.map(async (f) => {
        const blob = await obterFotoBlob(f.url).catch(() => null);
        return { id: f.id, previewUrl: blob ? URL.createObjectURL(blob) : null };
      })
    );
    setFotosModal(comPreview.filter((f) => f.previewUrl));
  }

  function abrirEdicaoExecucao(ex) {
    const grupo = execucoesDoMesmoGrupo(ex);
    const [principal, ...outras] = grupo;
    setExecucaoEditando(principal);
    setFotosModal([]);
    limparFotosPendentes();
    carregarFotosDoModal(execucoes, grupo.map((g) => g.id));
    setIdsParaMesclar(outras.map((o) => o.id));
    setDataExecucao(principal.data_execucao);
    setHoraExecucao(formatarHora(principal.hora_execucao) || "00:00");
    // Execução antiga sem término: assume a data de início (campo agora é obrigatório).
    setDataTermino(principal.data_execucao_term || principal.data_execucao || "");
    setHoraTermino(formatarHora(principal.hora_execucao_term) || "00:00");
    setEtiqueta(reclamacao?.etiqueta || "0");
    setEquipeId(principal.equipe_dia_id || "");
    setObservacoes(grupo.map((g) => g.observacoes).filter(Boolean).join(" / "));
    setPontosManual(principal.pontos_manual != null ? String(principal.pontos_manual) : "");
    setEditandoPontos(false);
    const todosItens = grupo.flatMap((g) => g.itens);
    setItens(
      todosItens.length > 0
        ? todosItens.map((it) => ({
            material_id: it.material_id,
            quantidade_instalada: it.quantidade_instalada,
            quantidade_retirada: it.quantidade_retirada,
            quantidade_substituida: it.quantidade_substituida,
            tipo_lampada_id: it.tipo_lampada_id || "",
            potencia_lampada_id: it.potencia_lampada_id || "",
          }))
        : [novoItem()]
    );
    setErro("");
    setFormAberto(true);
  }

  function atualizarItem(idx, patch) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function adicionarItem() {
    setItens((prev) => [...prev, novoItem()]);
  }

  function removerItem(idx) {
    // Nunca deixa a lista vazia: ao remover a única linha, volta uma linha
    // em branco pra continuar podendo lançar material.
    setItens((prev) => {
      const restante = prev.filter((_, i) => i !== idx);
      return restante.length > 0 ? restante : [novoItem()];
    });
  }

  function equipeCriada(nova) {
    setEquipes((prev) => [nova, ...prev]);
    setEquipeId(nova.id);
    setModalEquipeAberto(false);
  }

  function materialCriado(novo) {
    setMateriais((prev) => [...prev, novo]);
    selecionarMaterial(modalMaterialIdx, novo.id, novo);
    setModalMaterialIdx(null);
  }

  // Ao escolher um material de lâmpada, já pré-seleciona "LED" no tipo (se
  // o catálogo tiver), poupando um clique no caso mais comum.
  function selecionarMaterial(idx, materialId, materialObj) {
    const mat = materialObj || materiais.find((m) => m.id === materialId);
    const patch = { material_id: materialId };
    if (mat?.categoria === "LAMPADA") {
      const led = tiposLampada.find((t) => t.nome.toUpperCase() === "LED");
      if (led) patch.tipo_lampada_id = led.id;
    }
    atualizarItem(idx, patch);
  }

  // Linha com material selecionado mas sem nenhuma quantidade, ou lâmpada
  // sem Tipo/Potência (obrigatórios pro relatório e pro cálculo de pontos).
  function validarItens() {
    for (const item of itens) {
      if (!item.material_id) continue;
      const mat = materiais.find((m) => m.id === item.material_id);
      const nome = mat?.nome || "selecionado";
      const total =
        (Number(item.quantidade_instalada) || 0) +
        (Number(item.quantidade_retirada) || 0) +
        (Number(item.quantidade_substituida) || 0);
      if (total === 0) {
        return `O material "${nome}" está selecionado mas sem nenhuma quantidade informada. Preencha instalado/retirado/substituído ou remova a linha.`;
      }
      if (mat?.categoria === "LAMPADA" && (!item.tipo_lampada_id || !item.potencia_lampada_id)) {
        return `O material "${nome}" é uma lâmpada e precisa de Tipo e Potência preenchidos.`;
      }
      if (!porPonto && !pontosVigentes[item.material_id]) {
        return `O material "${nome}" não tem pontos cadastrados no contrato vigente desta prefeitura. Cadastre em Contratos > Pontos por material.`;
      }
    }
    return null;
  }

  async function salvar(e) {
    e.preventDefault();
    const erroValidacao = validarItens();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }
    // Término (opcional) não pode ser antes do início.
    if (horaTermino && !dataTermino) {
      setErro("Informe a data de término junto com a hora de término.");
      return;
    }
    if (!dataTermino) {
      setErro("Informe a data de término da execução.");
      return;
    }
    if (dataTermino) {
      const inicio = `${dataExecucao}T${horaExecucao || "00:00"}`;
      const termino = `${dataTermino}T${horaTermino || "23:59"}`;
      if (termino < inicio) {
        setErro("A data/hora de término não pode ser anterior à de início.");
        return;
      }
    }
    const termoPayload = {
      data_execucao_term: dataTermino || null,
      hora_execucao_term: dataTermino && horaTermino ? horaTermino : null,
    };
    const valorPontos = String(pontosManual).trim().replace(",", ".");
    if (porPonto && valorPontos !== "" && (Number.isNaN(Number(valorPontos)) || Number(valorPontos) < 0)) {
      setErro("Informe uma quantidade de pontos válida (número maior ou igual a zero).");
      return;
    }
    // Contrato por ponto: vazio = padrão (1 ponto por atendimento).
    const pontosPayload = porPonto && valorPontos !== "" ? Number(valorPontos) : null;
    setSalvando(true);
    setErro("");
    try {
      const itensPayload = itens
        .filter((it) => it.material_id)
        .map((it) => ({
          material_id: it.material_id,
          quantidade_instalada: Number(it.quantidade_instalada) || 0,
          quantidade_retirada: Number(it.quantidade_retirada) || 0,
          quantidade_substituida: Number(it.quantidade_substituida) || 0,
          tipo_lampada_id: it.tipo_lampada_id || null,
          potencia_lampada_id: it.potencia_lampada_id || null,
        }));
      // pontos da execução não é mais digitado — o backend recalcula como a
      // soma do total_pontos de cada item (quantidade x peso em pontos do
      // material) sempre que os itens são salvos.
      let execucaoSalvaId = execucaoEditando?.id || null;
      if (execucaoEditando) {
        await apiExecucoesReclamacao.atualizar(execucaoEditando.id, {
          data_execucao: dataExecucao,
          hora_execucao: horaExecucao || "00:00",
          equipe_dia_id: equipeId || null,
          observacoes: observacoes || null,
          pontos_manual: pontosPayload,
          ...termoPayload,
          itens: itensPayload,
        });
        for (const extraId of idsParaMesclar) {
          await apiExecucoesReclamacao.excluir(extraId, execucaoEditando.id);
        }
      } else {
        // Já existe execução(ões) para essa mesma equipe+data? Mescla os
        // itens nela em vez de criar outra execução separada — equipe só
        // trabalha numa reclamação por dia, não faz sentido fragmentar.
        const grupoExistente = execucoes.filter(
          (e) => e.data_execucao === dataExecucao && (e.equipe_dia_id || "") === (equipeId || "")
        );
        if (grupoExistente.length > 0) {
          const [alvo, ...extras] = grupoExistente;
          const itensExistentes = grupoExistente.flatMap((g) => g.itens).map((it) => ({
            material_id: it.material_id,
            quantidade_instalada: it.quantidade_instalada,
            quantidade_retirada: it.quantidade_retirada,
            quantidade_substituida: it.quantidade_substituida,
            tipo_lampada_id: it.tipo_lampada_id || null,
            potencia_lampada_id: it.potencia_lampada_id || null,
          }));
          // Não sobrescreve com 00:00 uma hora já gravada (ex.: pelo app).
          const horaAlvo = formatarHora(alvo.hora_execucao) || "00:00";
          execucaoSalvaId = alvo.id;
          await apiExecucoesReclamacao.atualizar(alvo.id, {
            data_execucao: dataExecucao,
            hora_execucao: horaExecucao && horaExecucao !== "00:00" ? horaExecucao : horaAlvo,
            equipe_dia_id: equipeId || null,
            observacoes: [alvo.observacoes, observacoes].filter(Boolean).join(" / ") || null,
            // Só troca os pontos da execução existente se foram informados agora.
            ...(pontosPayload != null ? { pontos_manual: pontosPayload } : {}),
            ...(dataTermino ? termoPayload : {}),
            itens: [...itensExistentes, ...itensPayload],
          });
          for (const extra of extras) {
            await apiExecucoesReclamacao.excluir(extra.id, alvo.id);
          }
        } else {
          const criada = await apiExecucoesReclamacao.criar({
            reclamacao_id: id,
            data_execucao: dataExecucao,
            hora_execucao: horaExecucao || "00:00",
            equipe_dia_id: equipeId || null,
            observacoes: observacoes || null,
            pontos_manual: pontosPayload,
            ...termoPayload,
            itens: itensPayload,
          });
          execucaoSalvaId = criada?.id || null;
        }
      }
      const etiquetaFinal = String(etiqueta || "").trim() || "0";
      if (etiquetaFinal !== (reclamacao?.etiqueta || "0")) {
        setReclamacao(await apiReclamacoes.atualizar(id, { etiqueta: etiquetaFinal }));
      }
      // Fotos escolhidas antes de salvar (execução nova): agora que há id, envia.
      // Se o envio falhar, a execução JÁ está salva — avisa na lista (dá pra importar de novo ao editar).
      let erroFotos = "";
      if (!execucaoEditando && fotosPendentes.length > 0 && execucaoSalvaId) {
        try {
          await importarFotosExecucao(execucaoSalvaId, fotosPendentes.map((f) => f.arquivo));
        } catch (err) {
          erroFotos = `A execução foi salva, mas as fotos não foram enviadas: ${err.message} Abra a execução e use "Importar fotos".`;
        }
      }
      limparFotosPendentes();
      setFormAberto(false);
      setErroLista(erroFotos);
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  // Importa fotos do computador para a execução (quando a equipe não tirou pelo app).
  // O servidor registra na observação da reclamação que foram importadas.
  async function importarFotos(execucaoId, arquivos) {
    if (!arquivos || arquivos.length === 0) return;
    setImportandoFotos(true);
    setErroLista("");
    setAvisoFotos("");
    try {
      const salvas = await importarFotosExecucao(execucaoId, Array.from(arquivos));
      setAvisoFotos(`${salvas.length} foto(s) importada(s). Isso foi registrado na observação da reclamação.`);
      const atualizadas = await apiExecucoesReclamacao.listar(`?reclamacao_id=${id}`);
      setExecucoes(atualizadas);
      if (formAberto && execucaoEditando) {
        await carregarFotosDoModal(atualizadas, [execucaoEditando.id, ...idsParaMesclar]);
      }
    } catch (err) {
      setErroLista(err.message);
    } finally {
      setImportandoFotos(false);
    }
  }

  // Exclui as execuções vazias (sem nenhum material) de um mesmo dia e equipe.
  async function confirmarExclusaoGrupo() {
    setApagandoGrupo(true);
    setErroLista("");
    try {
      for (const ex of grupoExcluindo) {
        await apiExecucoesReclamacao.excluir(ex.id);
      }
      setGrupoExcluindo(null);
      carregar();
    } catch (err) {
      setErroLista(err.message);
      setGrupoExcluindo(null);
    } finally {
      setApagandoGrupo(false);
    }
  }

  async function confirmarExclusaoItem() {
    setApagandoItem(true);
    setErroLista("");
    try {
      // Se for o último material e houver foto, a exclusão leva as fotos junto (já confirmado na tela).
      await apiItensExecucao.excluir(itemExcluindo.id, ultimoMaterialTravado);
      setItemExcluindo(null);
      carregar();
    } catch (err) {
      setErroLista(err.message);
      setItemExcluindo(null);
    } finally {
      setApagandoItem(false);
    }
  }

  async function validarLancamento() {
    setValidando(true);
    setErroLista("");
    try {
      const atualizado = await apiReclamacoes.atualizar(id, { status: "VALIDADA" });
      setReclamacao(atualizado);
    } catch (err) {
      setErroLista(err.message);
    } finally {
      setValidando(false);
    }
  }

  function abrirModalReabrir() {
    setReabrirUsername("");
    setReabrirSenha("");
    setErroReabrir("");
    setModalReabrirAberto(true);
  }

  async function confirmarReabrir(e) {
    e.preventDefault();
    setReabrindo(true);
    setErroReabrir("");
    try {
      const atualizado = await reabrirReclamacao(id, reabrirUsername, reabrirSenha);
      setReclamacao(atualizado);
      setModalReabrirAberto(false);
    } catch (err) {
      setErroReabrir(err.message);
    } finally {
      setReabrindo(false);
    }
  }

  if (carregando) {
    return (
      <>
        <header className="topbar">
          <h1>Execução</h1>
        </header>
        <div className="content">
          <div className="card empty-state">Carregando...</div>
        </div>
      </>
    );
  }

  if (!reclamacao) {
    return (
      <>
        <header className="topbar">
          <h1>Execução</h1>
        </header>
        <div className="content">
          <div className="card empty-state">{erroLista || "Reclamação não encontrada."}</div>
        </div>
      </>
    );
  }

  // Validada trava: Nova execução, editar e excluir ficam desabilitados até
  // um ADMIN reabrir com a própria senha. Concluída fica liberada pra
  // edição normal (é só uma marcação de "já terminou", não uma revisão
  // formal como a validação).
  // Validada ou Concluída fica travada: só reabre com a senha de quem autoriza
  // (Administrador). Validada e depois Concluída idem (validada_em fica gravado).
  // Concluída sem nenhuma execução ainda pode receber o primeiro lançamento.
  const bloqueado = travadaParaLancar(reclamacao, execucoes);

  // Agrupa por data + equipe — só abre um card novo quando a data ou a
  // equipe mudam; a equipe fica no cabeçalho do card, não repetida linha a
  // linha dentro da tabela.
  const gruposPorData = [];
  execucoes.forEach((ex) => {
    let grupo = gruposPorData.find((g) => g.data === ex.data_execucao && g.equipeId === (ex.equipe_dia_id || ""));
    if (!grupo) {
      grupo = { data: ex.data_execucao, equipeId: ex.equipe_dia_id || "", execucoes: [] };
      gruposPorData.push(grupo);
    }
    grupo.execucoes.push(ex);
  });

  // Total de pontos do formulário aberto — não é mais digitado, é a soma do
  // total_pontos de cada linha (recalculado pelo backend ao salvar).
  // Lista: contrato por ponto não mostra as colunas de pontos por material.
  const grupoPorPonto = (grupo) => grupo.execucoes.some((ex) => ex.tipo_contrato === "POR_PONTO");

  // Contrato por ponto: cada atendimento vale 1 ponto, sem olhar os materiais.
  const totalPontosFormulario = porPonto
    ? pontosManual !== ""
      ? pontosManual
      : 1
    : itens.reduce((acc, it) => acc + totalPontosItem(it, pontosVigentes[it.material_id]), 0);

  return (
    <>
      <header className="topbar">
        <h1>
          Execução da reclamação - {prefeituras.find((p) => p.id === reclamacao.prefeitura_id)?.nome || "—"} - Contrato:{" "}
          {contratoCard
            ? `${contratoCard.numero_contrato ? `${contratoCard.numero_contrato} - ` : ""}${
                contratoCard.tipo_contrato === "POR_PONTO" ? "Por ponto" : "Por item"
              }`
            : "sem contrato vigente"}
        </h1>
        <button className="btn" onClick={voltarParaLista}>
          <i className="ti ti-arrow-left" aria-hidden="true" style={{ marginRight: 6 }} />
          Voltar
        </button>
      </header>

      <div className="content">
        <div className="card">
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}
          >
            <div>
              <h3 style={{ margin: "0 0 4px" }}>
                {reclamacao.codigo} - Reclamante: {reclamacao.nome_reclamante}
              </h3>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
                {reclamacao.logradouro || "—"}
                {reclamacao.numero ? `, ${reclamacao.numero}` : ""} — {nomeBairro(reclamacao.bairro_id)}, {nomeCidade(reclamacao.cidade_id)}
              </p>
              {reclamacao.ponto_referencia && (
                <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
                  Ponto de referência: {reclamacao.ponto_referencia}
                </p>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {bloqueado && (
                  <button
                    className="btn btn-ghost"
                    onClick={abrirModalReabrir}
                    title="Reabrir (requer senha de quem autoriza)"
                  >
                    <i className="ti ti-lock-open" aria-hidden="true" />
                  </button>
                )}
                <span
                  className={`badge ${
                    ["CONCLUIDA", "VALIDADA"].includes(reclamacao.status) ? "badge-success" : "badge-muted"
                  }`}
                >
                  {LABEL_STATUS[reclamacao.status] || reclamacao.status}
                </span>
              </div>
              {["ABERTA", "CONCLUIDA"].includes(reclamacao.status) && !reclamacao.validada_em && execucoes.length > 0 && (
                <button className="btn btn-primary" onClick={validarLancamento} disabled={validando}>
                  {validando ? "Validando..." : "Validar lançamento"}
                </button>
              )}
            </div>
          </div>
        </div>

        {erroLista && <p className="erro-msg">{erroLista}</p>}

        <div
          className="table-header"
          style={{ marginTop: 20, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h3 style={{ margin: 0, fontSize: 15 }}>Execuções</h3>
          {/* Já tem execução lançada: edita-se pelo lápis, não se abre outra. */}
          {execucoes.length === 0 && (
            <button
              className="btn btn-primary"
              onClick={abrirNovaExecucao}
              disabled={bloqueado}
              title={bloqueado ? "Reabra a reclamação para lançar uma nova execução" : undefined}
            >
              <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 6 }} />
              Execução
            </button>
          )}
        </div>

        {avisoFotos && <p style={{ color: "var(--success, #15803d)", fontSize: 13 }}>{avisoFotos}</p>}

        {execucoes.length === 0 ? (
          <div className="card empty-state">Nenhuma execução registrada ainda.</div>
        ) : (
          gruposPorData.map((grupo) => (
            <div className="card" key={`${grupo.data}|${grupo.equipeId}`} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <strong>
                  {formatarData(grupo.data)} {formatarHora(grupo.execucoes[0].hora_execucao) || "00:00"}
                  {grupo.equipeId ? ` — ${nomeEquipe(grupo.equipeId)}` : ""}
                </strong>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => abrirEdicaoExecucao(grupo.execucoes[0])}
                  disabled={bloqueado}
                  title="Editar execução"
                  style={{
                    fontSize: 22,
                    width: 38,
                    height: 38,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <i className="ti ti-edit" aria-hidden="true" />
                </button>
                {/* Execução sem nenhum material: pode ser excluída (precisa da permissão Excluir). */}
                {podeExcluir && grupo.execucoes.every((ex) => ex.itens.length === 0) && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => setGrupoExcluindo(grupo.execucoes)}
                    disabled={bloqueado}
                    title="Excluir esta execução (não tem materiais)"
                    style={{
                      fontSize: 22,
                      width: 38,
                      height: 38,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      color: "var(--danger)",
                    }}
                  >
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                )}
                </div>
              </div>
              {grupo.execucoes.length === 1 && grupo.execucoes[0].observacoes && (
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                  {grupo.execucoes[0].observacoes}
                </p>
              )}
              {grupo.execucoes.some((ex) => ex.itens.length > 0) && (
                <table className="tabela-execucoes" style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Lâmpada</th>
                      <th style={{ textAlign: "center", width: 60 }}>Qtd. Inst.</th>
                      <th style={{ textAlign: "center", width: 60 }}>Qtd. Ret.</th>
                      <th style={{ textAlign: "center", width: 60 }}>Qtd. Subst.</th>
                      {!grupoPorPonto(grupo) && <th style={{ textAlign: "center", width: 55 }}>Pts Inst.</th>}
                      {!grupoPorPonto(grupo) && <th style={{ textAlign: "center", width: 55 }}>Pts Ret.</th>}
                      {!grupoPorPonto(grupo) && <th style={{ textAlign: "center", width: 55 }}>Pts Subst.</th>}
                      {!grupoPorPonto(grupo) && <th style={{ textAlign: "center", width: 55 }}>Total</th>}
                      <th style={{ width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.execucoes.map((ex) => (
                      <Fragment key={ex.id}>
                        {ex.itens.map((it) => {
                          const mat = materialPorId(it.material_id);
                          return (
                            <tr key={it.id}>
                              <td>{mat?.nome || "—"}</td>
                              <td>
                                {it.tipo_lampada_id
                                  ? `${nomeTipoLampada(it.tipo_lampada_id)}${
                                      it.potencia_lampada_id ? ` — ${labelPotenciaLampada(it.potencia_lampada_id)}` : ""
                                    }`
                                  : "—"}
                              </td>
                              <td style={{ textAlign: "center" }}>{it.quantidade_instalada || "—"}</td>
                              <td style={{ textAlign: "center" }}>{it.quantidade_retirada || "—"}</td>
                              <td style={{ textAlign: "center" }}>{it.quantidade_substituida || "—"}</td>
                              {!grupoPorPonto(grupo) && <td style={{ textAlign: "center" }}>{it.qde_pontos_inst || "—"}</td>}
                              {!grupoPorPonto(grupo) && <td style={{ textAlign: "center" }}>{it.qde_pontos_ret || "—"}</td>}
                              {!grupoPorPonto(grupo) && <td style={{ textAlign: "center" }}>{it.qde_pontos_subst || "—"}</td>}
                              {!grupoPorPonto(grupo) && <td style={{ textAlign: "center" }}>{it.total_pontos || "—"}</td>}
                              <td>
                                {podeExcluir && (
                                  <button
                                    className="btn btn-ghost"
                                    onClick={() => setItemExcluindo(it)}
                                    disabled={bloqueado}
                                    title={
                                      ultimoMaterialTravado
                                        ? "Último material: só pode ser excluído junto com as fotos"
                                        : "Excluir"
                                    }
                                    style={{ color: "var(--danger)" }}
                                  >
                                    <i className="ti ti-trash" aria-hidden="true" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>

      {formAberto && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 1150, maxWidth: "95vw" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>{execucaoEditando ? "Editar execução" : "Nova execução"}</h2>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {reclamacao.codigo} — {nomeCidade(reclamacao.cidade_id)} — {nomeBairro(reclamacao.bairro_id)} —{" "}
                {reclamacao.logradouro || "—"}
                {reclamacao.numero ? ` — ${reclamacao.numero}` : ""}
              </span>
            </div>
            <form onSubmit={salvar}>
              <div className="form-grid">
                {/* 1ª linha com larguras fixas (datas/horas não precisam de mais), Equipe ocupa o resto. */}
                <div className="linha-execucao-topo">
                <div className="form-field" style={{ width: 104 }}>
                  <label>Data início</label>
                  <input
                    type="date"
                    required
                    style={{ textAlign: "center" }}
                    value={dataExecucao}
                    onChange={(e) => {
                      // Término acompanha o início (mesma data), editável depois.
                      const nova = e.target.value;
                      if (!dataTermino || dataTermino === dataExecucao || (nova && dataTermino < nova)) {
                        setDataTermino(nova);
                      }
                      setDataExecucao(nova);
                    }}
                  />
                </div>
                <div className="form-field" style={{ width: 80 }}>
                  <label>Hora início</label>
                  <input
                    type="time"
                    required
                    style={{ textAlign: "center" }}
                    value={horaExecucao}
                    onChange={(e) => setHoraExecucao(e.target.value)}
                    title="Fica 00:00 nos lançamentos pelo sistema; o app de campo grava a hora real"
                  />
                </div>
                <div className="form-field" style={{ width: 104 }}>
                  <label>Data término</label>
                  <input
                    type="date"
                    required
                    style={{ textAlign: "center" }}
                    min={dataExecucao || undefined}
                    value={dataTermino}
                    onChange={(e) => setDataTermino(e.target.value)}
                  />
                </div>
                <div className="form-field" style={{ width: 80 }}>
                  <label>Hora término</label>
                  <input
                    type="time"
                    style={{ textAlign: "center" }}
                    value={horaTermino}
                    onChange={(e) => setHoraTermino(e.target.value)}
                  />
                </div>
                <div className="form-field" style={{ width: 110 }}>
                  <label>Tipo de contrato</label>
                  <input
                    type="text"
                    disabled
                    title="Definido no cadastro do contrato da prefeitura"
                    style={{ textAlign: "center", background: "var(--bg-page)" }}
                    value={porPonto ? "Por ponto" : tipoContrato === "POR_ITEM" ? "Por item" : "—"}
                  />
                </div>
                <div className="form-field" style={{ width: 52 }}>
                  <label>Pontos</label>
                  {porPonto ? (
                    // Por ponto: vale 1 por atendimento; duplo clique libera outra quantidade.
                    <input
                      type="text"
                      inputMode="decimal"
                      readOnly={!editandoPontos}
                      title={
                        editandoPontos
                          ? "Informe a quantidade de pontos deste atendimento (apague para voltar a 1)"
                          : "Clique 2 vezes para alterar a quantidade de pontos"
                      }
                      style={{
                        textAlign: "center",
                        background: editandoPontos ? undefined : "var(--bg-page)",
                        cursor: editandoPontos ? "text" : "pointer",
                        fontWeight: pontosManual !== "" ? 700 : undefined,
                      }}
                      value={editandoPontos ? pontosManual : totalPontosFormulario}
                      onDoubleClick={(e) => {
                        if (bloqueado || editandoPontos) return;
                        setEditandoPontos(true);
                        if (pontosManual === "") setPontosManual("1");
                        const el = e.currentTarget;
                        setTimeout(() => el.select(), 0);
                      }}
                      onChange={(e) => setPontosManual(e.target.value.replace(/[^0-9.,]/g, ""))}
                      onBlur={() => setEditandoPontos(false)}
                    />
                  ) : (
                    <input
                      type="text"
                      disabled
                      title="Calculado automaticamente a partir dos materiais lançados"
                      style={{ textAlign: "center", background: "var(--bg-page)" }}
                      value={totalPontosFormulario}
                    />
                  )}
                </div>
                <div className="form-field" style={{ width: 120 }}>
                  <label>Etiqueta</label>
                  <input
                    type="text"
                    style={{ textAlign: "center" }}
                    title='Etiqueta (plaqueta) do ponto. 0 = sem etiqueta ("Descon." no relatório Mod-02)'
                    value={etiqueta}
                    onChange={(e) => setEtiqueta(e.target.value)}
                  />
                </div>
                <div className="form-field" style={{ flex: 1, minWidth: 260 }}>
                  <label>Equipe</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select
                      required
                      className="select-equipe-compacto"
                      style={{ flex: 1 }}
                      value={equipeId}
                      onChange={(e) => setEquipeId(e.target.value)}
                      title={equipeId ? composicaoEquipe(equipeId) : undefined}
                    >
                      <option value="">Selecione...</option>
                      {equipes.filter((eq) => eq.ativa !== false || eq.id === equipeId).map((eq) => (
                        <option key={eq.id} value={eq.id} title={composicaoEquipe(eq.id)}>
                          {nomeEquipe(eq.id)}
                        </option>
                      ))}
                    </select>
                    {/* Nova equipe só para quem pode inserir equipes. */}
                    {pode("equipes.criar") && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setModalEquipeAberto(true)}
                        title="Cadastrar nova equipe"
                        style={{ fontWeight: 700, fontSize: 15, padding: "4px 10px", flexShrink: 0 }}
                      >
                        <i className="ti ti-plus" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                </div>
                <div className="form-field" style={{ "--span": 12 }}>
                  <label>Observações</label>
                  <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
                    Materiais instalados/retirados
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setModalMaterialIdx(-1)}
                    title="Cadastrar novo material"
                    style={{ fontWeight: 700, fontSize: 15, padding: "4px 10px" }}
                  >
                    <i className="ti ti-plus" aria-hidden="true" />
                  </button>
                </div>

                {itens.map((item, idx) => {
                  const mat = materialPorId(item.material_id);
                  const ehLampada = mat?.categoria === "LAMPADA";
                  const pontosItem = pontosVigentes[item.material_id];
                  // Rótulos só aparecem na 1ª linha de cada tipo — a 1ª linha
                  // em geral, e a 1ª que for lâmpada (Tipo/Potência só existem
                  // nela), senão a coluna fica sem nenhum rótulo visível.
                  const primeiraLinhaLampada = itens.findIndex(
                    (it) => materialPorId(it.material_id)?.categoria === "LAMPADA"
                  );
                  return (
                    <div
                      key={idx}
                      className="linha-item-material"
                      style={{
                        display: "grid",
                        gridTemplateColumns: !mostrarPontosItem
                          ? ehLampada
                            ? "1fr 110px 80px 180px 68px"
                            : "1fr 180px 68px"
                          : ehLampada
                            ? "1fr 110px 80px 180px 165px 70px 68px"
                            : "1fr 180px 165px 70px 68px",
                        gap: 8,
                        alignItems: "flex-end",
                        marginBottom: 0,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        {idx === 0 && <label style={rotuloCampo}>Material</label>}
                        {/* Lista só com materiais ativos e mais estreita que o campo. Um material
                            desativado já lançado nesta linha aparece só como valor, fora da lista. */}
                        <SelectLista
                          required
                          placeholder="Material..."
                          larguraLista={500}
                          value={item.material_id}
                          onChange={(v) => selecionarMaterial(idx, v)}
                          options={materiais.filter((m) => m.ativo !== false).map((m) => ({ value: m.id, label: m.nome }))}
                          rotuloAtual={
                            item.material_id
                              ? `${materiais.find((m) => m.id === item.material_id)?.nome || "Material"} (desativado)`
                              : ""
                          }
                        />
                      </div>
                      {ehLampada && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          {idx === primeiraLinhaLampada && <label style={rotuloCampo}>Tipo</label>}
                          <ComboCriavel
                            value={item.tipo_lampada_id}
                            onChange={(valor) => atualizarItem(idx, { tipo_lampada_id: valor })}
                            options={opcoesTiposLampada}
                            placeholder="LED, vapor de sódio..."
                            onCriar={async (texto) => {
                              const novo = await apiTiposLampada.criar({ nome: texto });
                              setTiposLampada((prev) => [...prev, novo]);
                              return { value: novo.id, label: novo.nome };
                            }}
                          />
                        </div>
                      )}
                      {ehLampada && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          {idx === primeiraLinhaLampada && <label style={rotuloCampo}>Potência (W)</label>}
                          <ComboCriavel
                            value={item.potencia_lampada_id}
                            onChange={(valor) => atualizarItem(idx, { potencia_lampada_id: valor })}
                            options={opcoesPotenciasLampada}
                            placeholder="100 W"
                            onCriar={async (texto) => {
                              const numero = Number(texto.replace(",", ".").replace(/[^\d.]/g, ""));
                              if (!numero) throw new Error("Informe um número de potência válido.");
                              const novo = await apiPotenciasLampada.criar({ valor_w: numero });
                              setPotenciasLampada((prev) => [...prev, novo]);
                              return { value: novo.id, label: `${novo.valor_w} W` };
                            }}
                          />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Qtd. Inst.</label>}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: 60, minWidth: 0, textAlign: "center" }}
                            value={item.quantidade_instalada}
                            onChange={(e) => atualizarItem(idx, { quantidade_instalada: e.target.value })}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Qtd. Ret.</label>}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: 60, minWidth: 0, textAlign: "center" }}
                            value={item.quantidade_retirada}
                            onChange={(e) => atualizarItem(idx, { quantidade_retirada: e.target.value })}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Qtd. Subst.</label>}
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: 60, minWidth: 0, textAlign: "center" }}
                            value={item.quantidade_substituida}
                            onChange={(e) => atualizarItem(idx, { quantidade_substituida: e.target.value })}
                          />
                        </div>
                      </div>
                      {mostrarPontosItem && (
                        <>
                      <div style={{ display: "flex", gap: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Pts Inst.</label>}
                          <input
                            type="text"
                            disabled
                            title="Peso em pontos vigente no contrato desta prefeitura"
                            style={{ width: 55, minWidth: 0, textAlign: "center" }}
                            value={pontosItem ? pontosItem.qde_pontos_inst : "—"}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Pts Ret.</label>}
                          <input
                            type="text"
                            disabled
                            title="Peso em pontos vigente no contrato desta prefeitura"
                            style={{ width: 55, minWidth: 0, textAlign: "center" }}
                            value={pontosItem ? pontosItem.qde_pontos_ret : "—"}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {idx === 0 && <label style={rotuloCampo}>Pts Subst.</label>}
                          <input
                            type="text"
                            disabled
                            title="Peso em pontos vigente no contrato desta prefeitura"
                            style={{ width: 55, minWidth: 0, textAlign: "center" }}
                            value={pontosItem ? pontosItem.qde_pontos_subst : "—"}
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {idx === 0 && <label style={rotuloCampo}>Total</label>}
                        <input
                          type="text"
                          disabled
                          style={{ width: "100%", minWidth: 0, textAlign: "center", fontWeight: 600 }}
                          value={totalPontosItem(item, pontosItem)}
                        />
                      </div>
                        </>
                      )}
                      <div style={{ display: "flex", gap: 4 }}>
                        {idx === itens.length - 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={adicionarItem}
                            title="Adicionar material"
                            style={{
                              color: "var(--primary)",
                              fontSize: 16,
                              width: 28,
                              height: 28,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                            }}
                          >
                            <i className="ti ti-plus" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => removerItem(idx)}
                          title="Remover"
                          style={{
                            color: "var(--danger)",
                            fontSize: 16,
                            width: 28,
                            height: 28,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                          }}
                        >
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
                    Fotos {execucaoEditando ? `(${fotosModal.length})` : fotosPendentes.length > 0 ? `(${fotosPendentes.length})` : ""}
                  </label>
                  <label
                    className="btn"
                    title={
                      execucaoEditando
                        ? "Importar fotos do computador (as da equipe de campo já aparecem aqui)"
                        : "Escolher fotos do computador — elas são enviadas quando você clicar em Salvar"
                    }
                    style={{
                      cursor: importandoFotos ? "not-allowed" : "pointer",
                      opacity: importandoFotos ? 0.5 : 1,
                      fontSize: 11,
                      height: 24,
                      padding: "0 8px",
                    }}
                  >
                    <i className="ti ti-photo-up" aria-hidden="true" style={{ marginRight: 4, fontSize: 13 }} />
                    {importandoFotos ? "Importando..." : "Importar fotos"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      disabled={importandoFotos}
                      onChange={(e) => {
                        if (execucaoEditando) importarFotos(execucaoEditando.id, e.target.files);
                        else adicionarFotosPendentes(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {!execucaoEditando && fotosPendentes.length > 0 && (
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                      As fotos serão enviadas quando você salvar.
                    </span>
                  )}
                </div>
                {avisoFotos && <p style={{ color: "var(--success, #15803d)", fontSize: 13, margin: "0 0 8px" }}>{avisoFotos}</p>}
                {podeExcluir && fotosModal.length > 1 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setFotosExcluindo(fotosModal.map((f) => f.id))}
                    style={{ fontSize: 11, height: 24, padding: "0 8px", color: "var(--danger)", marginBottom: 8 }}
                  >
                    <i className="ti ti-trash" aria-hidden="true" style={{ marginRight: 4, fontSize: 13 }} />
                    Excluir todas
                  </button>
                )}
                {!execucaoEditando && fotosPendentes.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {fotosPendentes.map((f) => (
                      <div key={f.key} style={{ position: "relative" }}>
                        <img
                          src={f.previewUrl}
                          alt={f.arquivo.name}
                          style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                        />
                        <button
                          type="button"
                          title="Remover esta foto (ainda não enviada)"
                          onClick={() => removerFotoPendente(f.key)}
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: 22,
                            height: 22,
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: "#fff",
                            color: "var(--danger)",
                            cursor: "pointer",
                          }}
                        >
                          <i className="ti ti-x" aria-hidden="true" style={{ fontSize: 13 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {execucaoEditando && fotosModal.length === 0 && (
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nenhuma foto nesta execução.</span>
                )}
                {fotosModal.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {fotosModal.map((f) => (
                      <div key={f.id} style={{ position: "relative" }}>
                        <a href={f.previewUrl} target="_blank" rel="noreferrer" title="Abrir a foto">
                          <img
                            src={f.previewUrl}
                            alt="Foto da execução"
                            style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                          />
                        </a>
                        {podeExcluir && (
                          <button
                            type="button"
                            title="Excluir esta foto"
                            onClick={() => setFotosExcluindo([f.id])}
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              width: 22,
                              height: 22,
                              padding: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 6,
                              border: "1px solid var(--border)",
                              background: "#fff",
                              color: "var(--danger)",
                              cursor: "pointer",
                            }}
                          >
                            <i className="ti ti-trash" aria-hidden="true" style={{ fontSize: 13 }} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {erroPontosVigentes && <p className="erro-msg">{erroPontosVigentes}</p>}
              {erro && <p className="erro-msg">{erro}</p>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setFormAberto(false)}>
                  Fechar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ModalNovaEquipe
        aberto={modalEquipeAberto}
        onFechar={() => setModalEquipeAberto(false)}
        onCriada={equipeCriada}
      />
      <ModalNovoMaterial
        aberto={modalMaterialIdx !== null}
        onFechar={() => setModalMaterialIdx(null)}
        onCriado={materialCriado}
      />

      <ConfirmDialog
        aberto={!!fotosExcluindo}
        titulo="Excluir fotos"
        mensagem={`Excluir ${fotosExcluindo?.length || 0} foto(s) desta execução? Os arquivos serão apagados e essa ação não pode ser desfeita.`}
        confirmando={apagandoFotosModal}
        onConfirmar={confirmarExclusaoFotosModal}
        onCancelar={() => setFotosExcluindo(null)}
      />

      <ConfirmDialog
        aberto={!!grupoExcluindo}
        titulo="Excluir execução"
        mensagem={(() => {
          const qtdFotos = (grupoExcluindo || []).reduce((n, ex) => n + (ex.fotos?.length || 0), 0);
          return `Excluir esta execução, que não tem materiais lançados?${
            qtdFotos > 0 ? ` As ${qtdFotos} foto(s) anexada(s) a ela também serão excluídas.` : ""
          } Essa ação não pode ser desfeita.`;
        })()}
        confirmando={apagandoGrupo}
        onConfirmar={confirmarExclusaoGrupo}
        onCancelar={() => setGrupoExcluindo(null)}
      />

      <ConfirmDialog
        aberto={!!itemExcluindo}
        titulo={ultimoMaterialTravado ? "Excluir material e fotos" : "Excluir material"}
        mensagem={
          ultimoMaterialTravado
            ? `Este é o último material da reclamação e ela tem ${totalFotosReclamacao} foto(s) anexada(s). ` +
              "Ele só pode ser excluído junto com as fotos, que também serão apagadas. Essa ação não pode ser desfeita."
            : "Excluir este material lançado na execução? Essa ação não pode ser desfeita."
        }
        confirmando={apagandoItem}
        onConfirmar={confirmarExclusaoItem}
        onCancelar={() => setItemExcluindo(null)}
      />

      {modalReabrirAberto && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 380 }}>
            <h2>Reabrir reclamação</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: -8 }}>
              Volta o status para "Aberta" e libera edição/exclusão. Exige o usuário e a senha de quem tem permissão para autorizar a reabertura.
            </p>
            <form onSubmit={confirmarReabrir}>
              <div className="form-grid">
                <div className="form-field" style={{ "--span": 12 }}>
                  <label>Usuário que autoriza</label>
                  <input
                    required
                    autoFocus
                    value={reabrirUsername}
                    onChange={(e) => setReabrirUsername(e.target.value)}
                  />
                </div>
                <div className="form-field" style={{ "--span": 12 }}>
                  <label>Senha</label>
                  <input
                    type="password"
                    required
                    value={reabrirSenha}
                    onChange={(e) => setReabrirSenha(e.target.value)}
                  />
                </div>
              </div>
              {erroReabrir && <p className="erro-msg">{erroReabrir}</p>}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setModalReabrirAberto(false)}>
                  Fechar
                </button>
                <button type="submit" className="btn btn-primary" disabled={reabrindo}>
                  {reabrindo ? "Verificando..." : "Reabrir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
