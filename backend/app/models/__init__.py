from app.core.database import Base
from app.models.contrato import Contrato, PrecoPonto, CategoriaPreco
from app.models.pessoal import Funcionario, Veiculo, EquipeDia, EquipeMembro
from app.models.ativo import Ativo
from app.models.material import Material
from app.models.ordem_servico import (
    OrdemServico,
    ItemOrdemServico,
    TipoOS,
    TipoItem,
    StatusOS,
)
from app.models.pedido import (
    PedidoManutencao,
    Execucao,
    Foto,
    OrigemPedido,
    StatusPedido,
)
from app.models.usuario import Usuario, PapelUsuario

__all__ = [
    "Base",
    "Contrato",
    "PrecoPonto",
    "CategoriaPreco",
    "Funcionario",
    "Veiculo",
    "EquipeDia",
    "EquipeMembro",
    "Ativo",
    "Material",
    "OrdemServico",
    "ItemOrdemServico",
    "TipoOS",
    "TipoItem",
    "StatusOS",
    "PedidoManutencao",
    "Execucao",
    "Foto",
    "OrigemPedido",
    "StatusPedido",
    "Usuario",
    "PapelUsuario",
]
