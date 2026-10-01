import { useEffect, useState } from "react";
import CadastroPage from "../CadastroPage";
import { apiCargos, apiFuncionarios } from "../api";

export default function Funcionarios() {
  const [cargos, setCargos] = useState([]);

  useEffect(() => {
    apiCargos.listar().then(setCargos);
  }, []);

  const nomeCargo = (id) => cargos.find((c) => c.id === id)?.nome || "—";

  return (
    <CadastroPage
      titulo="Funcionários"
      modulo="funcionarios"
      api={apiFuncionarios}
      colunas={[
        { key: "matricula", label: "Matrícula" },
        { key: "nome", label: "Nome" },
        { key: "cargo_id", label: "Cargo", render: (item) => nomeCargo(item.cargo_id) },
        { key: "cpf", label: "CPF" },
      ]}
      campos={[
        { name: "nome", label: "Nome", required: true, fullWidth: true },
        { name: "matricula", label: "Matrícula", size: 2, center: true },
        {
          name: "cargo_id",
          label: "Cargo",
          type: "combo",
          size: 6,
          placeholder: "Digite para buscar ou criar...",
          options: cargos.map((c) => ({ value: c.id, label: c.nome })),
          onCriar: async (texto) => {
            const novo = await apiCargos.criar({ nome: texto });
            setCargos((prev) => [...prev, novo]);
            return { value: novo.id, label: novo.nome };
          },
        },
        { name: "cpf", label: "CPF", mask: "cpf" },
      ]}
    />
  );
}
