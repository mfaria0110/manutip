/** Modal de confirmação simples, usado antes de ações destrutivas (excluir). */
export default function ConfirmDialog({ aberto, titulo, mensagem, confirmando, onConfirmar, onCancelar }) {
  if (!aberto) return null;
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 380 }}>
        <h2>{titulo}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{mensagem}</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ background: "var(--danger)", borderColor: "var(--danger)" }}
            onClick={onConfirmar}
            disabled={confirmando}
          >
            {confirmando ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}
