#!/usr/bin/env bash

set -e

REPO="marcusedu/plim"
RAW_URL="https://raw.githubusercontent.com/${REPO}/main/bin/plim"
INSTALL_DIR="${HOME}/.local/bin"
TARGET="${INSTALL_DIR}/plim"

echo "🔔 Instalando Plim..."

# Cria diretório de destino
mkdir -p "$INSTALL_DIR"

# Se executado dentro do próprio repositório clonado
if [[ -f "./bin/plim" ]]; then
    echo "📦 Instalando a partir do repositório local..."
    cp "./bin/plim" "$TARGET"
else
    echo "🌐 Baixando a versão mais recente do GitHub..."
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$RAW_URL" -o "$TARGET"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$TARGET" "$RAW_URL"
    else
        echo "❌ Erro: curl ou wget é necessário para a instalação."
        exit 1
    fi
fi

chmod +x "$TARGET"
echo "✅ Plim instalado em: $TARGET"

# Verifica se ~/.local/bin está no PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "⚠️  Aviso: $INSTALL_DIR não está no seu PATH."
    echo "Adicione ao seu ~/.zshrc ou ~/.bashrc:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
fi

# Se um token foi passado como argumento (ex: curl ... | bash -s -- plim_live_xyz)
if [[ -n "$1" ]]; then
    echo "🔑 Conectando ao token fornecido: $1"
    "$TARGET" connect "$1"
else
    echo ""
    echo "🎉 Instalação concluída!"
    echo "Para conectar ao Telegram, abra https://t.me/plim_the_bot e envie /start"
fi
