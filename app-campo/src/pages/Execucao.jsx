import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  anexarFotoExecucao,
  apiExecucoesReclamacao,
  apiMateriais,
  apiPotenciasLampada,
  apiReclamacoes,
  apiTiposLampada,
  obterFotoURL,
} from "../api";
import { useFluxo } from "../FluxoContext";
import { useOffline } from "../offline/OfflineContext";
import { comCache, lerCache, salvarCache } from "../offline/cache";
import { enfileirar } from "../offline/fila";
import Topo from "../Topo";

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

const hoje = () => new Date().toISOString().slice(0, 10);

export default function Execucao() {
  const { id: reclamacaoId } = useParams();
  const navigate = useNavigate();
  const { equipeDiaId, prefeituraId } = useFluxo();
  const { online, atualizarContagem } = useOffline();
  const fileInputRef = useRef(null);
  const chaveRascunho = `rascunhoExecucao:${reclamacaoId}:${equipeDiaId}`;

  const [reclamacao, setReclamacao] = useState(null);
  const [materiais, setMateriais] = useState([]);
  const [tiposLampada, setTiposLampada] = useState([]);
  const [potenciasLampada, setPotenciasLampada] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState("");

  const [execucaoId, setExecucaoId] = useState(null);
  // Mesmo uuid_local em toda nova tentativa de salvar enquanto a execução
  // ainda não tem id de servidor — senão, salvar 2x offline (ex.: depois de
  // reabrir o app) viraria 2 registros distintos na sincronização em vez de
  // 1 só sendo atualizado.
  const [uuidLocal, setUuidLocal] = useState(() => crypto.randomUUID());
  const [itens, setItens] = useState([novoItem()]);
  const [localizacao, setLocalizacao] = useState(null); // {lat, lng}
  const [capturandoGps, setCapturandoGps] = useState(false);
  const [fotosExistentes, setFotosExistentes] = useState([]); // [{id, url, previewUrl}]
  const [fotosNovas, setFotosNovas] = useState([]); // [{file, previewUrl}]

  useEffect(() => {
    if (!equipeDiaId) {
      navigate("/equipe", { replace: true });
      return;
    }
    Promise.all([
      comCache(`reclamacao:${reclamacaoId}`, () => apiReclamacoes.obter(reclamacaoId)),
      comCache("materiais", () => apiMateriais.listar()),
      comCache("tiposLampada", () => apiTiposLampada.listar()),
      comCache("potenciasLampada", () => apiPotenciasLampada.listar()),
      comCache(`execucoesReclamacao:${reclamacaoId}`, () =>
        apiExecucoesReclamacao.listar(`?reclamacao_id=${reclamacaoId}`)
      ),
    ])
      .then(async ([rec, mats, tipos, potencias, execucoes]) => {
        setReclamacao(rec.dados);
        setMateriais(mats.dados);
        setTiposLampada(tipos.dados);
        setPotenciasLampada(potencias.dados);

        const existente = execucoes.dados.find((e) => e.equipe_dia_id === equipeDiaId && e.data_execucao === hoje());
        if (existente) {
          setExecucaoId(existente.id);
          setItens(
            existente.itens.length
              ? existente.itens.map((it) => ({
                  material_id: it.material_id,
                  quantidade_instalada: it.quantidade_instalada,
                  quantidade_retirada: it.quantidade_retirada,
                  quantidade_substituida: it.quantidade_substituida,
                  tipo_lampada_id: it.tipo_lampada_id || "",
                  potencia_lampada_id: it.potencia_lampada_id || "",
                }))
              : [novoItem()]
          );
          if (existente.latitude && existente.longitude) {
            setLocalizacao({ lat: existente.latitude, lng: existente.longitude });
          }
          const comPreview = await Promise.all(
            existente.fotos.map(async (f) => ({ ...f, previewUrl: await obterFotoURL(f.url).catch(() => null) }))
          );
          setFotosExistentes(comPreview);
        }

        // Rascunho salvo localmente (lançamento feito offline, ainda não
        // sincronizado) tem prioridade sobre o que veio do servidor —
        // representa um estado mais novo que o servidor ainda não viu.
        const rascunho = await lerCache(chaveRascunho);
        if (rascunho) {
          setItens(rascunho.itens);
          setLocalizacao(rascunho.localizacao);
          if (rascunho.uuidLocal) setUuidLocal(rascunho.uuidLocal);
          if (rascunho.fotos?.length) {
            setFotosExistentes((prev) => [
              ...prev,
              ...rascunho.fotos.map((blob, i) => ({
                id: `pendente-${i}`,
                pendente: true,
                previewUrl: URL.createObjectURL(blob),
              })),
            ]);
          }
        }
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [reclamacaoId, equipeDiaId, navigate]);

  const materialPorId = (id) => materiais.find((m) => m.id === id);
  const nomeTipoLampada = (id) => tiposLampada.find((t) => t.id === id)?.nome || "—";
  const labelPotencia = (id) => {
    const p = potenciasLampada.find((p) => p.id === id);
    return p ? `${p.valor_w} W` : "—";
  };

  function atualizarItem(idx, patch) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function escolherMaterial(idx, materialId) {
    const mat = materialPorId(materialId);
    const patch = { material_id: materialId };
    if (mat?.categoria === "LAMPADA") {
      const led = tiposLampada.find((t) => t.nome.toUpperCase() === "LED");
      if (led) patch.tipo_lampada_id = led.id;
    }
    atualizarItem(idx, patch);
  }

  function adicionarLinha() {
    setItens((prev) => [...prev, novoItem()]);
  }

  function removerLinha(idx) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  function capturarLocalizacao() {
    if (!navigator.geolocation) {
      setErro("Este dispositivo não suporta GPS.");
      return;
    }
    setCapturandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocalizacao({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCapturandoGps(false);
      },
      (err) => {
        setErro(`Não foi possível capturar a localização: ${err.message}`);
        setCapturandoGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function escolherFoto(e) {
    const arquivos = Array.from(e.target.files || []);
    const novas = arquivos.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setFotosNovas((prev) => [...prev, ...novas]);
    e.target.value = "";
  }

  function removerFotoNova(idx) {
    setFotosNovas((prev) => prev.filter((_, i) => i !== idx));
  }

  function montarPayload() {
    return {
      ...(execucaoId ? { id: execucaoId } : {}),
      reclamacao_id: reclamacaoId,
      data_execucao: hoje(),
      equipe_dia_id: equipeDiaId,
      uuid_local: uuidLocal,
      latitude: localizacao?.lat ?? null,
      longitude: localizacao?.lng ?? null,
      itens: itens
        .filter((it) => it.material_id)
        .map((it) => ({
          material_id: it.material_id,
          quantidade_instalada: Number(it.quantidade_instalada) || 0,
          quantidade_retirada: Number(it.quantidade_retirada) || 0,
          quantidade_substituida: Number(it.quantidade_substituida) || 0,
          tipo_lampada_id: it.tipo_lampada_id || null,
          potencia_lampada_id: it.potencia_lampada_id || null,
        })),
    };
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    setSucesso("");
    const payload = montarPayload();
    try {
      if (online) {
        const salva = execucaoId
          ? await apiExecucoesReclamacao.atualizar(execucaoId, payload)
          : await apiExecucoesReclamacao.criar(payload);
        setExecucaoId(salva.id);

        for (const foto of fotosNovas) {
          await anexarFotoExecucao(salva.id, foto.file);
        }
        setFotosNovas([]);

        const atualizada = await apiExecucoesReclamacao.obter(salva.id);
        const comPreview = await Promise.all(
          atualizada.fotos.map(async (f) => ({ ...f, previewUrl: await obterFotoURL(f.url).catch(() => null) }))
        );
        setFotosExistentes(comPreview);
        await salvarCache(chaveRascunho, null);
        setSucesso("Execução salva.");
      } else {
        await enfileirar("execucao", {
          execucaoPayload: payload,
          fotos: fotosNovas.map((f) => f.file),
        });
        atualizarContagem();
        // Guarda um retrato do que foi lançado localmente — se o usuário
        // sair e voltar nessa reclamação antes de sincronizar, reabre do
        // jeito que deixou, não em branco.
        await salvarCache(chaveRascunho, {
          itens,
          localizacao,
          uuidLocal,
          fotos: fotosNovas.map((f) => f.file),
        });
        setFotosExistentes((prev) => [
          ...prev,
          ...fotosNovas.map((f) => ({ id: `pendente-${Date.now()}-${Math.random()}`, pendente: true, previewUrl: f.previewUrl })),
        ]);
        setFotosNovas([]);
        setSucesso("Salvo neste aparelho — será enviado quando houver internet.");
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function concluirReclamacao() {
    setSalvando(true);
    setErro("");
    try {
      if (online) {
        await apiReclamacoes.atualizar(reclamacaoId, { status: "CONCLUIDA" });
      } else {
        await enfileirar("concluirReclamacao", { reclamacaoId });
        atualizarContagem();
        // Tira do cache da lista de abertas pra não aparecer mais mesmo
        // antes de sincronizar de verdade.
        const cacheChave = `reclamacoesAbertas:${prefeituraId}`;
        const lista = await lerCache(cacheChave);
        if (lista) await salvarCache(cacheChave, lista.filter((r) => r.id !== reclamacaoId));
      }
      navigate("/reclamacoes");
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="tela">
        <Topo titulo="Execução" voltar={() => navigate(-1)} />
        <div className="conteudo vazio">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="tela">
      <Topo titulo={reclamacao?.codigo} subtitulo={reclamacao?.logradouro} voltar={() => navigate("/reclamacoes")} />
      <div className="conteudo">
        {erro && <p className="erro-msg">{erro}</p>}
        {sucesso && <div className="badge" style={{ marginBottom: 14 }}>{sucesso}</div>}

        <div className="cartao">
          <div className="linha-entre">
            <strong>Localização do poste</strong>
            <button type="button" className="btn btn-secundario btn-pequeno" onClick={capturarLocalizacao} disabled={capturandoGps}>
              <i className="ti ti-map-pin" aria-hidden="true" /> {capturandoGps ? "Capturando..." : "Capturar"}
            </button>
          </div>
          {localizacao && (
            <p className="cartao-sub" style={{ marginTop: 8 }}>
              {localizacao.lat.toFixed(6)}, {localizacao.lng.toFixed(6)}
            </p>
          )}
        </div>

        <label>Materiais</label>
        {itens.map((item, idx) => {
          const mat = materialPorId(item.material_id);
          const ehLampada = mat?.categoria === "LAMPADA";
          return (
            <div key={idx} className="cartao">
              <div className="linha-entre">
                <div style={{ flex: 1 }}>
                  <select value={item.material_id} onChange={(e) => escolherMaterial(idx, e.target.value)}>
                    <option value="">Selecione o material...</option>
                    {materiais.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
                {itens.length > 1 && (
                  <button type="button" className="btn-perigo" style={{ border: "none", background: "none" }} onClick={() => removerLinha(idx)}>
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                )}
              </div>

              {ehLampada && (
                <div className="linha" style={{ marginTop: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label>Tipo</label>
                    <select value={item.tipo_lampada_id} onChange={(e) => atualizarItem(idx, { tipo_lampada_id: e.target.value })}>
                      <option value="">Selecione...</option>
                      {tiposLampada.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Potência</label>
                    <select value={item.potencia_lampada_id} onChange={(e) => atualizarItem(idx, { potencia_lampada_id: e.target.value })}>
                      <option value="">Selecione...</option>
                      {potenciasLampada.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.valor_w} W
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="linha" style={{ marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <label>Instalado</label>
                  <input
                    type="number"
                    min="0"
                    value={item.quantidade_instalada}
                    onChange={(e) => atualizarItem(idx, { quantidade_instalada: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Retirado</label>
                  <input
                    type="number"
                    min="0"
                    value={item.quantidade_retirada}
                    onChange={(e) => atualizarItem(idx, { quantidade_retirada: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Substituído</label>
                  <input
                    type="number"
                    min="0"
                    value={item.quantidade_substituida}
                    onChange={(e) => atualizarItem(idx, { quantidade_substituida: e.target.value })}
                  />
                </div>
              </div>
            </div>
          );
        })}
        <button type="button" className="btn btn-secundario" onClick={adicionarLinha}>
          <i className="ti ti-plus" aria-hidden="true" /> Adicionar material
        </button>

        <div className="cartao" style={{ marginTop: 14 }}>
          <div className="linha-entre">
            <strong>Fotos</strong>
            <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => fileInputRef.current?.click()}>
              <i className="ti ti-camera" aria-hidden="true" /> Tirar foto
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            style={{ display: "none" }}
            onChange={escolherFoto}
          />
          <div className="lista-fotos">
            {fotosExistentes.map((f) => (
              <div key={f.id} style={{ position: "relative" }}>
                <img src={f.previewUrl} alt="Foto da execução" style={f.pendente ? { opacity: 0.6 } : undefined} />
                {f.pendente && (
                  <span
                    style={{ position: "absolute", bottom: 2, left: 2, right: 2, fontSize: 9, textAlign: "center", background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 4 }}
                  >
                    pendente
                  </span>
                )}
              </div>
            ))}
            {fotosNovas.map((f, idx) => (
              <div key={idx} style={{ position: "relative" }}>
                <img src={f.previewUrl} alt="Nova foto" />
                <button
                  type="button"
                  onClick={() => removerFotoNova(idx)}
                  style={{ position: "absolute", top: -6, right: -6, background: "var(--danger)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" className="btn btn-primario" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar execução"}
          </button>
          {execucaoId && reclamacao?.status !== "CONCLUIDA" && (
            <button type="button" className="btn btn-secundario" onClick={concluirReclamacao} disabled={salvando}>
              Marcar reclamação como concluída
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
