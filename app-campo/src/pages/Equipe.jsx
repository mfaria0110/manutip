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
 *  - só uma equipe ativa: segue direto pra escolha da prefeitura;
 *  - mais de uma: mostra TODAS as equipes ativas de que ele faz parte e ele
 *    escolhe uma — é nela que as execuções do dia serão lançadas.
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
        setMinhasEquipes(minhas);
        setDesignacoes(des.dados);
        setVeiculos(vei.dados);
        // Com mais de uma equipe ele sempre escolhe; com uma só não há o que escolher.
        if (!forcarEscolha && minhas.length === 1) {
          seguir(minhas[0].id);
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

  // Todas as equipes ativas dele; as que têm roteiro hoje aparecem primeiro.
  const lista = [...minhasEquipes].sort((a, b) => qtdDesignadas(b.id) - qtdDesignadas(a.id));
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
            Você faz parte de mais de uma equipe. Escolha a equipe em que está hoje: as execuções serão lançadas
            nela.
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
