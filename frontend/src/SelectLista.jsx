import { useEffect, useRef, useState } from "react";

/** Select com lista própria: o campo mantém a largura do formulário, mas a
 * lista que abre tem largura limitada (`larguraLista`), coisa que o select
 * nativo não permite. A lista abre em posição fixa (não é cortada pelo modal).
 *
 * props: value, onChange(valor), options [{value,label}], placeholder,
 *        required, larguraLista (px), rotuloAtual (texto do valor atual quando
 *        ele não está entre as opções — ex.: material desativado já lançado).
 * Tem busca no topo da lista: digitar filtra (sem diferenciar acento/maiúscula).
 */

const normalizar = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function SelectLista({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  required,
  larguraLista = 340,
  rotuloAtual,
}) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null);
  const [destaque, setDestaque] = useState(-1);
  const [busca, setBusca] = useState("");
  const botaoRef = useRef(null);
  const listaRef = useRef(null);
  const buscaRef = useRef(null);
  const itensRef = useRef(null);

  const termo = normalizar(busca);
  const filtradas = termo ? options.filter((o) => normalizar(o.label).includes(termo)) : options;

  const atual = options.find((o) => o.value === value);
  const texto = atual ? atual.label : value ? rotuloAtual || "" : "";

  function abrir(textoInicial = "") {
    const r = botaoRef.current.getBoundingClientRect();
    const alturaMax = 280;
    const abaixo = window.innerHeight - r.bottom;
    // Abre para cima se não houver espaço embaixo.
    const top = abaixo < Math.min(alturaMax, options.length * 26 + 10) && r.top > abaixo ? null : r.bottom + 2;
    setPos({
      left: r.left,
      width: Math.min(larguraLista, Math.max(r.width, 180)),
      top,
      bottom: top === null ? window.innerHeight - r.top + 2 : null,
      alturaMax,
    });
    setBusca(textoInicial);
    setDestaque(textoInicial ? 0 : Math.max(0, options.findIndex((o) => o.value === value)));
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => {
      if (!botaoRef.current?.contains(e.target) && !listaRef.current?.contains(e.target)) setAberto(false);
    };
    const fechar = () => setAberto(false);
    document.addEventListener("mousedown", fora);
    window.addEventListener("resize", fechar);
    // Rolar a página/modal fecha (a lista é fixa); rolar a própria lista não.
    const aoRolar = (e) => {
      if (!listaRef.current?.contains(e.target)) fechar();
    };
    window.addEventListener("scroll", aoRolar, true);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("resize", fechar);
      window.removeEventListener("scroll", aoRolar, true);
    };
  }, [aberto]);

  useEffect(() => {
    if (aberto) buscaRef.current?.focus();
  }, [aberto]);

  useEffect(() => {
    if (aberto && destaque >= 0) {
      itensRef.current?.children[destaque]?.scrollIntoView({ block: "nearest" });
    }
  }, [aberto, destaque]);

  function escolher(opt) {
    onChange(opt.value);
    setAberto(false);
    botaoRef.current?.focus();
  }

  // Teclado no campo fechado: abre (setas/Enter/espaço) ou já abre filtrando pela letra digitada.
  function tecladoCampo(e) {
    if (aberto) return;
    if (["ArrowDown", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      abrir();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      abrir(e.key);
    }
  }

  // Teclado na busca: setas navegam, Enter escolhe, Esc fecha.
  function tecladoBusca(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
      botaoRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setDestaque((d) => Math.min(filtradas.length - 1, d + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => Math.max(0, d - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtradas[destaque]) escolher(filtradas[destaque]);
    } else if (e.key === "Tab") {
      setAberto(false);
    }
  }

  return (
    <div className="select-lista">
      <button
        type="button"
        ref={botaoRef}
        className={"select-lista-campo" + (texto ? "" : " vazio")}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={tecladoCampo}
        title={texto || undefined}
      >
        <span>{texto || placeholder}</span>
        <i className="ti ti-chevron-down" aria-hidden="true" />
      </button>
      {/* Mantém a validação "obrigatório" do formulário. */}
      {required && (
        <input
          className="select-lista-validacao"
          tabIndex={-1}
          required
          value={value || ""}
          onChange={() => {}}
          onFocus={() => botaoRef.current?.focus()}
          aria-hidden="true"
        />
      )}
      {aberto && pos && (
        <div
          ref={listaRef}
          className="select-lista-pop"
          style={{
            left: pos.left,
            width: pos.width,
            top: pos.top ?? undefined,
            bottom: pos.bottom ?? undefined,
          }}
        >
          <div className="select-lista-busca">
            <i className="ti ti-search" aria-hidden="true" />
            <input
              ref={buscaRef}
              placeholder="Digite para filtrar..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setDestaque(0);
              }}
              onKeyDown={tecladoBusca}
            />
          </div>
          <div className="select-lista-itens" ref={itensRef} style={{ maxHeight: pos.alturaMax - 40 }}>
            {filtradas.length === 0 && <div className="select-lista-vazio">Nenhum item encontrado.</div>}
            {filtradas.map((o, i) => (
              <button
                type="button"
                key={o.value}
                className={
                  "select-lista-opt" + (o.value === value ? " selecionada" : "") + (i === destaque ? " destaque" : "")
                }
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setDestaque(i)}
                onClick={() => escolher(o)}
                title={o.label}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
