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
        { name: "placa", label: "Placa", required: true, mask: "placa", size: 4 },
        { name: "modelo", label: "Modelo", required: true, size: 4 },
        { name: "tipo", label: "Tipo", size: 4, placeholder: "Caminhão, munck, utilitário..." },
        { name: "cor", label: "Cor", size: 4, center: true },
        { name: "ano_fabricacao", label: "Ano fabricação", mask: "ano", center: true, size: 2 },
        { name: "ano_modelo", label: "Ano modelo", mask: "ano", center: true, size: 2 },
        { name: "renavam", label: "Renavam", mask: "renavam", center: true, size: 4 },
        { name: "acessorios", label: "Acessórios", type: "textarea", rows: 3, fullWidth: true },
      ]}
    />
  );
}
