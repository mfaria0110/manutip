export default function Topo({ titulo, subtitulo, voltar, acao }) {
  return (
    <div className="topo">
      <div className="linha">
        {voltar && (
          <button
            type="button"
            onClick={voltar}
            style={{ background: "none", border: "none", color: "#fff", padding: 0, marginRight: 4 }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
        )}
        <div>
          <div className="topo-titulo">{titulo}</div>
          {subtitulo && <div className="topo-sub">{subtitulo}</div>}
        </div>
      </div>
      {acao}
    </div>
  );
}
