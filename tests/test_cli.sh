#!/usr/bin/env bash

# Test Suite para a CLI do Plim
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIM_BIN="$SCRIPT_DIR/bin/plim"

TOTAL=0
PASSED=0
FAILED=0

assert_eq() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    TOTAL=$((TOTAL + 1))
    if [[ "$expected" == "$actual" ]]; then
        echo "  ✅ PASS: $name"
        PASSED=$((PASSED + 1))
    else
        echo "  ❌ FAIL: $name"
        echo "     Esperado: '$expected'"
        echo "     Obtido:   '$actual'"
        FAILED=$((FAILED + 1))
    fi
}

assert_contains() {
    local name="$1"
    local needle="$2"
    local haystack="$3"
    TOTAL=$((TOTAL + 1))
    if [[ "$haystack" == *"$needle"* ]]; then
        echo "  ✅ PASS: $name"
        PASSED=$((PASSED + 1))
    else
        echo "  ❌ FAIL: $name"
        echo "     Esperava conter: '$needle'"
        FAILED=$((FAILED + 1))
    fi
}

echo "🧪 Iniciando Testes da CLI do Plim..."
echo "----------------------------------------"

# 1. Validação de Sintaxe
TOTAL=$((TOTAL + 1))
if bash -n "$PLIM_BIN"; then
    echo "  ✅ PASS: Sintaxe do script bin/plim é válida"
    PASSED=$((PASSED + 1))
else
    echo "  ❌ FAIL: Erro de sintaxe no script bin/plim"
    FAILED=$((FAILED + 1))
fi

# 2. Verificação de Sincronia de Versão
VERSION_FILE=$(cat "$SCRIPT_DIR/VERSION" | tr -d '[:space:]')
CLI_VERSION=$("$PLIM_BIN" version | awk '{print $2}' | tr -d '[:space:]')
assert_eq "Versão da CLI confere com arquivo VERSION" "v$VERSION_FILE" "$CLI_VERSION"

# 3. Flag de Ajuda (--help)
HELP_OUTPUT=$("$PLIM_BIN" --help)
assert_contains "Help contém comando plim run" "plim run" "$HELP_OUTPUT"
assert_contains "Help contém comando plim ask" "plim ask" "$HELP_OUTPUT"
assert_contains "Help contém comando plim mcp" "plim mcp" "$HELP_OUTPUT"

# 4. Pipeline Unix sem argumentos (deve repassar stdout imediatamente)
PIPE_OUT=$(echo "saida do pipe simples" | "$PLIM_BIN")
assert_eq "Pipe sem argumentos repassa stdout" "saida do pipe simples" "$PIPE_OUT"

# 5. Pipeline Unix com mensagem customizada
PIPE_CUSTOM_OUT=$(echo "saida customizada" | "$PLIM_BIN" "Meu Alerta")
assert_eq "Pipe com mensagem repassa stdout" "saida customizada" "$PIPE_CUSTOM_OUT"

# 6. Notificação avulsa sem flag -n
NOTIF_EXIT=0
"$PLIM_BIN" "Mensagem de teste avulsa" >/dev/null 2>&1 || NOTIF_EXIT=$?
assert_eq "Mensagem avulsa sem flag sai com código 0" "0" "$NOTIF_EXIT"

# 7. Validação de Argumentos no plim ask
ASK_EXIT=0
"$PLIM_BIN" ask >/dev/null 2>&1 || ASK_EXIT=$?
assert_eq "plim ask sem argumentos falha com exit code 1" "1" "$ASK_EXIT"

# 8. Monitor de comandos (plim run) - Sucesso e Falha
RUN_SUCCESS_EXIT=0
"$PLIM_BIN" run true >/dev/null 2>&1 || RUN_SUCCESS_EXIT=$?
assert_eq "plim run true retorna exit code 0" "0" "$RUN_SUCCESS_EXIT"

RUN_FAIL_EXIT=0
"$PLIM_BIN" run false >/dev/null 2>&1 || RUN_FAIL_EXIT=$?
assert_eq "plim run false propaga exit code 1" "1" "$RUN_FAIL_EXIT"

echo "----------------------------------------"
echo "📊 Resumo dos Testes CLI: $PASSED/$TOTAL passaram ($FAILED falhas)"

if [[ $FAILED -gt 0 ]]; then
    exit 1
fi
exit 0
