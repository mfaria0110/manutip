import { useEffect, useState } from "react";
import { apiDesignacoes } from "./api";
import { formatarData } from "./formatos";

const LABEL_STATUS = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  VALIDADA: "Validada",
  CONCLUIDA: "Concluída",
};

/** Reclamações da prefeitura designadas para hoje: local completo, equipe que
 * vai executar e, se a equipe já atendeu hoje em campo, o status atual. */
export default function ModalDesignadasHoje({ prefeitura, onFechar, onAbrirLista }) {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    apiDesignacoes
      .hoje(prefeitura.id)
      .then(setItens)
      .catch((e) => {
        setErro(e.message);
        setItens([]);
      });
  }, [prefeitura.id]);

  const hoje = new Date().toLocaleDateString("pt-BR");
  const atendidas = itens ? itens.filter((i) => i.atendida_hoje).length : 0;

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal modal-designadas-hoje" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 4 }}>Designadas para hoje — {prefeitura.nome}</h2>
        <p style={{ margin: "0 0 14px", color: "var(--text-secondary)", fontSize: 13 }}>
          {hoje}
          {itens && itens.length > 0 && ` · ${itens.length} designada(s), ${atendidas} já atendida(s) hoje`}
        </p>
        {erro && <p className="erro-msg">{erro}</p>}
        {itens === null ? (
          <div className="empty-state">Carregando...</div>
        ) : itens.length === 0 ? (
          <div className="empty-state">Nenhuma reclamação designada para hoje nesta prefeitura.</div>
        ) : (
          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            <table className="tabela-compacta">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Código</th>
                  <th style={{ width: 85 }}>Data_Rec</th>
                  <th style={{ width: 85 }}>Data_Desig</th>
                  <th>Local</th>
                  <th style={{ width: 230 }}>Equipe</th>
                  <th style={{ width: 170 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.reclamacao_id}>
                    <td>
                      {i.codigo}
                      {i.urgente && <span className="badge badge-urgente">Urgente</span>}
                    </td>
                    <td>{i.data_reclamacao ? formatarData(i.data_reclamacao) : "—"}</td>
                    <td>{i.data_designacao ? formatarData(i.data_designacao) : "—"}</td>
                    <td>
                      {i.local}
                      {i.ponto_referencia && (
                        <div style={{ color: "var(--text-secondary)", fontSize: 11.5 }}>Ref.: {i.ponto_referencia}</div>
                      )}
                    </td>
                    <td>{i.equipe || "—"}</td>
                    <td>
                      {i.atendida_hoje ? (
                        <>
                          <span className="badge badge-success">{LABEL_STATUS[i.status] || i.status}</span>
                          <span
                            className="badge"
                            style={{ marginLeft: 6, background: "#fef3c7", color: "#92400e" }}
                            title={i.equipe_execucao ? `Executada hoje por ${i.equipe_execucao}` : "Executada hoje"}
                          >
                            Atendida hoje
                          </span>
                          {i.equipe_execucao && i.equipe_execucao !== i.equipe && (
                            <div style={{ color: "var(--text-secondary)", fontSize: 11.5, marginTop: 2 }}>
                              por {i.equipe_execucao}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="badge badge-muted">{LABEL_STATUS[i.status] || i.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn" onClick={onFechar}>
            Fechar
          </button>
          <button type="button" className="btn btn-primary" onClick={onAbrirLista}>
            Abrir reclamações da prefeitura
          </button>
        </div>
      </div>
    </div>
  );
}
