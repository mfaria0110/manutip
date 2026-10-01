import { useEffect, useRef, useState } from "react";

/** Combobox editável: funciona como um select, mas se o usuário digitar um
 * valor que não existe na lista, cria o registro (via `onCriar`) ao sair do
 * campo e já seleciona o novo item. Usado para catálogos que o usuário pode
 * precisar estender na hora (ex.: Bairro, dentro do cadastro de Prefeitura).
 *
 * props: value (id atual), onChange(id), options: [{value,label}],
 *        onCriar: (texto) => Promise<{value,label}>, placeholder?
 */
export default function ComboCriavel({ value, onChange, options, onCriar, placeholder }) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");
  const ref = useRef(null);

  // Mantém o texto exibido sincronizado com o id selecionado (ex.: ao abrir
  // o formulário em modo edição, ou depois de criar um novo registro).
  useEffect(() => {
    const atual = options.find((o) => o.value === value);
    setTexto(atual ? atual.label : "");
  }, [value, options]);

  useEffect(() => {
    const fora = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const filtradas = options.filter((o) => o.label.toLowerCase().includes(texto.toLowerCase()));

  function selecionar(opt) {
    onChange(opt.value);
    setTexto(opt.label);
    setErro("");
    setAberto(false);
  }

  async function aoSair() {
    setAberto(false);
    const limpo = texto.trim();
    if (!limpo) {
      onChange("");
      return;
    }
    const existente = options.find((o) => o.label.toLowerCase() === limpo.toLowerCase());
    if (existente) {
      onChange(existente.value);
      setTexto(existente.label);
      return;
    }
    // Não existe ainda — cria na base e já seleciona.
    setCriando(true);
    setErro("");
    try {
      const novo = await onCriar(limpo);
      onChange(novo.value);
      setTexto(novo.label);
    } catch (e) {
      setErro(e.message || "Não foi possível criar.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", minWidth: 0 }} ref={ref}>
      <input
        style={{ width: "100%", minWidth: 0 }}
        value={texto}
        placeholder={placeholder}
        disabled={criando}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={aoSair}
      />
      {aberto && filtradas.length > 0 && (
        <div className="combo-pop">
          {filtradas.map((o) => (
            // onMouseDown (não onClick) para disparar antes do onBlur do input.
            <button type="button" key={o.value} className="combo-opt" onMouseDown={() => selecionar(o)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {criando && <p className="combo-hint">Criando...</p>}
      {erro && <p className="erro-msg">{erro}</p>}
    </div>
  );
}
