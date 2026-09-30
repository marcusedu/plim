#!/usr/bin/env bash

set -e

INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_BIN="$SCRIPT_DIR/bin/plim"

mkdir -p "$INSTALL_DIR"

if [[ "$1" == "--copy" || "$1" == "-c" ]]; then
    echo "📦 Copiando plim para $INSTALL_DIR/plim..."
    cp "$SOURCE_BIN" "$INSTALL_DIR/plim"
else
    echo "🔗 Criando link simbólico de plim em $INSTALL_DIR/plim..."
    ln -sf "$SOURCE_BIN" "$INSTALL_DIR/plim"
fi

chmod +x "$INSTALL_DIR/plim"

echo "✅ 'plim' instalado com sucesso em $INSTALL_DIR/plim!"

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "⚠️  Atenção: $INSTALL_DIR não está no seu PATH."
    echo "Adicione ao seu ~/.zshrc ou ~/.bashrc:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi
