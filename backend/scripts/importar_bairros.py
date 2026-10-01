"""Importa bairros de uma planilha legada (TBL_Bairros) para cidades/bairros.

Lê scripts/_bairros_raw.json (gerado a partir do xlsx: colunas NOMEBAIR,
INTMUNIC), normaliza nome de cidade/bairro, cria o que faltar via API
local (reaproveita a mesma lógica de autorização/validação do sistema) e
reporta o que não deu pra mapear automaticamente.

Uso:
    python scripts/importar_bairros.py --username SELLES --senha ...
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://localhost:8010/api"

# Normalização das variações de nome de cidade encontradas na planilha ->
# (nome canônico, UF). "CORE" não é cidade (ver aviso no relatório final).
MAPA_CIDADE = {
    "RESENDE": ("Resende", "RJ"),
    "ITATIAIA": ("Itatiaia", "RJ"),
    "ITATIAIA - PENEDO": ("Itatiaia", "RJ"),
    "PORTO REAL": ("Porto Real", "RJ"),
    "BOCAINA DE MINAS": ("Bocaina de Minas", "MG"),
}

PARTICULAS = {"de", "da", "do", "dos", "das", "e"}
ROMANOS = {"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"}


def normalizar_nome(txt: str) -> str:
    txt = re.sub(r"\s+", " ", txt.strip())
    saida = []
    for i, p in enumerate(txt.split(" ")):
        up = p.upper()
        if up in ROMANOS:
            saida.append(up)
        elif p.lower() in PARTICULAS and i != 0:
            saida.append(p.lower())
        else:
            saida.append(p.capitalize())
    return " ".join(saida)


def req(method, path, token=None, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detalhe = e.read().decode("utf-8", "ignore")
        raise RuntimeError(f"{method} {path} -> {e.code}: {detalhe}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--senha", required=True)
    args = parser.parse_args()

    bruto = json.loads(Path(__file__).parent.joinpath("_bairros_raw.json").read_text(encoding="utf-8"))

    token = req("POST", "/login", body={"username": args.username, "senha": args.senha})["token"]

    cidades = req("GET", "/cidades", token=token)
    cidades_por_chave = {(c["nome"].lower(), c["uf"]): c["id"] for c in cidades}

    bairros = req("GET", "/bairros", token=token)
    bairros_por_chave = {(b["nome"].lower(), b["cidade_id"]) for b in bairros}

    nao_mapeados = {}
    criados_cidade = []
    criados_bairro = []
    ja_existentes = 0
    duplicados_na_planilha = set()
    falhas = []

    for linha in bruto:
        try:
            cidade_raw = linha["cidade_raw"]
            chave_raw = cidade_raw.upper()
            if chave_raw not in MAPA_CIDADE:
                nao_mapeados.setdefault(cidade_raw, []).append(linha["bairro"])
                continue

            nome_cidade, uf = MAPA_CIDADE[chave_raw]
            chave_cidade = (nome_cidade.lower(), uf)
            cidade_id = cidades_por_chave.get(chave_cidade)
            if not cidade_id:
                nova = req("POST", "/cidades", token=token, body={"nome": nome_cidade, "uf": uf})
                cidade_id = nova["id"]
                cidades_por_chave[chave_cidade] = cidade_id
                criados_cidade.append(f"{nome_cidade} - {uf}")

            nome_bairro = normalizar_nome(linha["bairro"])
            chave_bairro = (nome_bairro.lower(), cidade_id)
            if chave_bairro in bairros_por_chave:
                if (nome_bairro, nome_cidade) in duplicados_na_planilha:
                    continue
                duplicados_na_planilha.add((nome_bairro, nome_cidade))
                ja_existentes += 1
                continue

            req("POST", "/bairros", token=token, body={"nome": nome_bairro, "cidade_id": cidade_id})
            bairros_por_chave.add(chave_bairro)
            criados_bairro.append(f"{nome_bairro} ({nome_cidade}-{uf})")
        except Exception as e:
            # Nunca para o lote inteiro por causa de uma linha ruim — registra
            # e segue (foi isso que cortou a importação na metade antes).
            falhas.append(f"{linha.get('bairro')!r} / {linha.get('cidade_raw')!r}: {e}")

    print(f"Cidades criadas ({len(criados_cidade)}): {criados_cidade}")
    print(f"Bairros criados: {len(criados_bairro)}")
    print(f"Já existiam (ignorados): {ja_existentes}")
    if nao_mapeados:
        print("\nNÃO IMPORTADOS (cidade não reconhecida) — revisar manualmente:")
        for cidade, bairros_lista in nao_mapeados.items():
            print(f"  '{cidade}': {bairros_lista}")
    if falhas:
        print(f"\nFALHAS ({len(falhas)}) — não travaram o resto do lote:")
        for f in falhas:
            print(f"  {f}")


if __name__ == "__main__":
    main()
