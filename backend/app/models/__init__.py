from app.core.database import Base
from app.models.localidade import Cidade, Bairro
from app.models.prefeitura import Prefeitura
from app.models.contrato import Contrato, PrecoPonto, CategoriaPreco
from app.models.atividade import Atividade
from app.models.mao_obra import MaoDeObra
from app.models.cargo import Cargo
from app.models.pessoal import Funcionario, Veiculo, EquipeDia, EquipeMembro
from app.models.ativo import Ativo
from app.models.material import Material
from app.models.lampada import TipoLampada, PotenciaLampada
from app.models.reclamacao import Reclamacao
from app.models.execucao_reclamacao import ExecucaoReclamacao, ItemExecucaoMaterial, MovimentoMaterial
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
    "Cidade",
    "Bairro",
    "Prefeitura",
    "Contrato",
    "PrecoPonto",
    "CategoriaPreco",
    "Atividade",
    "MaoDeObra",
    "Cargo",
    "Funcionario",
    "Veiculo",
    "EquipeDia",
    "EquipeMembro",
    "Ativo",
    "Material",
    "TipoLampada",
    "PotenciaLampada",
    "Reclamacao",
    "ExecucaoReclamacao",
    "ItemExecucaoMaterial",
    "MovimentoMaterial",
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
