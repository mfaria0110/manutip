import CadastroPage from "../CadastroPage";
import { apiVeiculos } from "../api";

export default function Veiculos() {
  return (
    <CadastroPage
      titulo="Veículos"
      modulo="veiculos"
      api={apiVeiculos}
      colunas={[
        { key: "placa", label: "Placa" },
        { key: "modelo", label: "Modelo" },
        { key: "tipo", label: "Tipo" },
        { key: "cor", label: "Cor" },
      ]}
      campos={[
        { name: "placa", label: "Placa", required: true, mask: "placa" },
        { name: "modelo", label: "Modelo", required: true, size: 5 },
        { name: "tipo", label: "Tipo", size: 3, placeholder: "Caminhão, munck, utilitário..." },
        { name: "cor", label: "Cor", size: 3, center: true },
        { name: "ano_fabricacao", label: "Ano fabricação", mask: "ano", center: true },
        { name: "ano_modelo", label: "Ano modelo", mask: "ano", center: true },
        { name: "renavam", label: "Renavam", mask: "renavam", center: true },
        { name: "acessorios", label: "Acessórios", type: "textarea", rows: 3, fullWidth: true },
      ]}
    />
  );
}
