import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiDesignacoes, apiEquipesDia, apiVeiculos } from "../api";
import { useAcesso } from "../AcessoContext";
import { formatarData, hojeLocal } from "../datas";
import { useFluxo } from "../FluxoContext";
import { comCache } from "../offline/cache";
import Topo from "../Topo";

const soDigitos = (v) => String(v || "").replace(/\D/g, "");

/** Descobre a equipe do usuário logado pelo CPF (elo entre o login e o
 * cadastro de Funcionário, que é membro das equipes):
 *  1. equipe ativa dele que tem reclamações designadas hoje (roteiro) — segue
 *     direto pra escolha da prefeitura;
 *  2. sem roteiro: ele escolhe entre as equipes ativas de que faz parte.
 * Não há mais cadastro/validação de equipe aqui: a equipe é cadastrada e
 * designada pelo escritório. */
export default function Equipe() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // "Trocar equipe" (voltando da tela de prefeitura) não escolhe sozinho.
  const forcarEscolha = searchParams.get("escolher") === "1";
  const { perfil } = useAcesso();
  const { definirEquipe } = useFluxo();

  const [minhasEquipes, setMinhasEquipes] = useState([]);
  const [designacoes, setDesignacoes] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const hoje = hojeLocal();

  function seguir(equipeId) {
    definirEquipe(equipeId);
    navigate("/prefeitura", { replace: true });
  }

  useEffect(() => {
    Promise.all([
      comCache("equipesDia", () => apiEquipesDia.listar()),
      comCache(`designacoes:${hoje}`, () => apiDesignacoes.listar(`?data=${hoje}`)),
      comCache("veiculos", () => apiVeiculos.listar()),
    ])
      .then(([eq, des, vei]) => {
        const meuCpf = soDigitos(perfil?.cpf);
        const minhas = eq.dados.filter(
          (e) =>
            e.ativa !== false &&
            !!meuCpf &&
            e.membros.some((m) => soDigitos(m.funcionario_cpf) === meuCpf)
        );
        const comRoteiro = minhas.filter((e) => des.dados.some((d) => d.equipe_dia_id === e.id));
        setMinhasEquipes(minhas);
        setDesignacoes(des.dados);
        setVeiculos(vei.dados);
        if (!forcarEscolha && comRoteiro.length === 1) {
          seguir(comRoteiro[0].id);
          return;
        }
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nomeVeiculo = (id) => {
    const v = veiculos.find((x) => x.id === id);
    return v ? `${v.placa} — ${v.modelo}` : "—";
  };
  const qtdDesignadas = (equipeId) => designacoes.filter((d) => d.equipe_dia_id === equipeId).length;

  // Com mais de uma equipe com roteiro hoje (e sem forçar), só essas aparecem.
  const comRoteiro = minhasEquipes.filter((e) => qtdDesignadas(e.id) > 0);
  const lista = !forcarEscolha && comRoteiro.length > 1 ? comRoteiro : minhasEquipes;
  const subtitulo = formatarData(hoje);

  if (carregando) {
    return (
      <div className="tela">
        <Topo titulo="Equipe" subtitulo={subtitulo} />
        <div className="conteudo vazio">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="tela">
      <Topo titulo="Equipe" subtitulo={subtitulo} />
      <div className="conteudo">
        {erro && <p className="erro-msg">{erro}</p>}

        {!erro && !perfil?.cpf && (
          <p className="vazio">Seu usuário não tem CPF cadastrado. Peça ao administrador para informar o seu CPF.</p>
        )}
        {!erro && !!perfil?.cpf && minhasEquipes.length === 0 && (
          <p className="vazio">
            Você não faz parte de nenhuma equipe ativa. Peça ao administrador para incluir você em uma equipe.
          </p>
        )}

        {lista.length > 0 && (
          <p className="cartao-sub" style={{ marginBottom: 10 }}>
            {comRoteiro.length > 0 && !forcarEscolha
              ? "Escolha a equipe do roteiro de hoje:"
              : "Escolha a sua equipe de hoje:"}
          </p>
        )}
        {lista.map((eq) => {
          const qtd = qtdDesignadas(eq.id);
          return (
            <div key={eq.id} className="cartao cartao-toque" onClick={() => seguir(eq.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cartao-titulo">{eq.nome}</div>
                <div className="cartao-sub">
                  {qtd > 0 ? `${qtd} reclamação(ões) designada(s) para hoje` : "Sem reclamações designadas hoje"}
                </div>
                <div className="cartao-sub">
                  <strong>Veículo:</strong> {nomeVeiculo(eq.veiculo_id)}
                </div>
                <div className="cartao-sub">
                  <strong>Membros:</strong> {eq.membros.map((m) => m.funcionario_nome).join(", ") || "—"}
                </div>
              </div>
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
