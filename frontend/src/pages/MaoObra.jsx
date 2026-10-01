import CadastroPage from "../CadastroPage";
import { apiMaoObra } from "../api";

export default function MaoObra() {
  return (
    <CadastroPage
      titulo="Mão de obra"
      modulo="mao_obra"
      api={apiMaoObra}
      colunas={[
        { key: "funcao", label: "Função" },
        { key: "unidade", label: "Unidade" },
        { key: "custo_unitario", label: "Custo unitário (R$)" },
      ]}
      campos={[
        { name: "funcao", label: "Função", required: true },
        {
          name: "unidade",
          label: "Unidade",
          type: "select",
          required: true,
          options: [
            { value: "HORA", label: "Hora" },
            { value: "DIA", label: "Diária" },
          ],
        },
        { name: "custo_unitario", label: "Custo unitário (R$)", type: "number", step: "0.01", required: true },
      ]}
    />
  );
}
