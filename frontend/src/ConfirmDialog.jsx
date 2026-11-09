/** Modal de confirmação simples, usado antes de ações destrutivas (excluir). */
export default function ConfirmDialog({
  aberto,
  titulo,
  mensagem,
  confirmando,
  onConfirmar,
  onCancelar,
  // Opcional: pede a senha do usuário logado antes de confirmar.
  senha,
  onSenhaChange,
  erro,
  // Opcional: textos/cor do botão de confirmar (padrão: "Excluir", vermelho).
  textoConfirmar = "Excluir",
  textoConfirmando = "Excluindo...",
  perigo = true,
}) {
  if (!aberto) return null;
  const pedeSenha = onSenhaChange !== undefined;
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 380 }}>
        <h2>{titulo}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{mensagem}</p>
        {pedeSenha && (
          <div className="form-field" style={{ marginTop: 10 }}>
            <label>Sua senha</label>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={senha || ""}
              onChange={(e) => onSenhaChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && senha) onConfirmar();
              }}
            />
          </div>
        )}
        {erro && <p className="erro-msg">{erro}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={perigo ? { background: "var(--danger)", borderColor: "var(--danger)" } : undefined}
            onClick={onConfirmar}
            disabled={confirmando || (pedeSenha && !senha)}
          >
            {confirmando ? textoConfirmando : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
