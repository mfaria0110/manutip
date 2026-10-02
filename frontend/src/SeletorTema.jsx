import { useEffect, useRef, useState } from "react";
import { PALETAS, useTema } from "./TemaContext";

export default function SeletorTema({ claro = false }) {
  const { tema, setTema } = useTema();
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const atual = PALETAS.find((p) => p.id === tema) || PALETAS[0];

  useEffect(() => {
    const fora = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  return (
    <div className="tema-wrap" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost"
        style={{
          width: claro ? "auto" : "100%",
          color: claro ? "var(--on-accent, #fff)" : "var(--text-inverse-muted)",
          justifyContent: "flex-start",
        }}
        onClick={() => setAberto((v) => !v)}
        title={`Paleta: ${atual.nome}`}
        aria-label="Trocar paleta de cores"
      >
        <span className="tema-bola" style={{ background: atual.cor }} />
        {atual.nome}
      </button>
      {aberto && (
        <div className={`tema-pop${claro ? " abaixo" : ""}`} role="menu">
          {PALETAS.map((p) => (
            <button
              type="button"
              key={p.id}
              role="menuitem"
              className={`tema-opt ${tema === p.id ? "ativa" : ""}`}
              title={p.nome}
              onClick={() => {
                setTema(p.id);
                setAberto(false);
              }}
            >
              <span className="tema-bola" style={{ background: p.cor }} />
              <span>{p.nome}</span>
              {tema === p.id && <i className="ti ti-check" aria-hidden="true" style={{ marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
