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
      ]}
      campos={[
        { name: "placa", label: "Placa", required: true, mask: "placa" },
        { name: "modelo", label: "Modelo", required: true, size: 5 },
        { name: "tipo", label: "Tipo (caminhão, munck, utilitário...)", size: 4 },
      ]}
    />
  );
}
