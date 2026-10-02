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

# 9. Internacionalização (i18n) - Comandos e Saídas em Inglês e Português
HELP_EN=$(PLIM_LANG=en "$PLIM_BIN" --help)
assert_contains "Help em inglês contém 'Usage:'" "Usage:" "$HELP_EN"
assert_contains "Help em inglês contém 'plim lang [en|pt]'" "plim lang [en|pt]" "$HELP_EN"

HELP_PT=$(PLIM_LANG=pt "$PLIM_BIN" --help)
assert_contains "Help em português contém 'Uso:'" "Uso:" "$HELP_PT"
assert_contains "Help em português contém 'plim lang [en|pt]'" "plim lang [en|pt]" "$HELP_PT"

LANG_EN_OUT=$(PLIM_LANG=en "$PLIM_BIN" lang)
assert_contains "plim lang em inglês indica English" "Current language: English (en)" "$LANG_EN_OUT"

LANG_PT_OUT=$(PLIM_LANG=pt "$PLIM_BIN" lang)
assert_contains "plim lang em português indica Português" "Idioma atual: Português (pt)" "$LANG_PT_OUT"

RUN_EN_OUT=$(PLIM_LANG=en "$PLIM_BIN" run true 2>&1)
assert_contains "plim run em inglês exibe 'Running:'" "Running:" "$RUN_EN_OUT"

RUN_PT_OUT=$(PLIM_LANG=pt "$PLIM_BIN" run true 2>&1)
assert_contains "plim run em português exibe 'Executando:'" "Executando:" "$RUN_PT_OUT"

# 10. Auto-Plim (Shell Hooks: Zsh, Bash, Fish)
HOOK_ZSH_OUT=$("$PLIM_BIN" hook zsh)
assert_contains "plim hook zsh contém preexec" "_plim_zsh_preexec" "$HOOK_ZSH_OUT"
assert_contains "plim hook zsh contém add-zsh-hook" "add-zsh-hook preexec" "$HOOK_ZSH_OUT"

HOOK_BASH_OUT=$("$PLIM_BIN" hook bash)
assert_contains "plim hook bash contém trap DEBUG" "trap '_plim_bash_preexec' DEBUG" "$HOOK_BASH_OUT"
assert_contains "plim hook bash contém PROMPT_COMMAND" "PROMPT_COMMAND" "$HOOK_BASH_OUT"

HOOK_FISH_OUT=$("$PLIM_BIN" hook fish)
assert_contains "plim hook fish contém fish_preexec" "--on-event fish_preexec" "$HOOK_FISH_OUT"
assert_contains "plim hook fish contém fish_postexec" "--on-event fish_postexec" "$HOOK_FISH_OUT"

HOOK_STATUS_OUT=$(PLIM_LANG=pt "$PLIM_BIN" hook status)
assert_contains "plim hook status em português exibe limiar" "Limiar de tempo:" "$HOOK_STATUS_OUT"
assert_contains "plim hook status em português exibe comandos ignorados" "Comandos ignorados:" "$HOOK_STATUS_OUT"

HOOK_STATUS_EN=$(PLIM_LANG=en "$PLIM_BIN" hook status)
assert_contains "plim hook status em inglês exibe threshold" "Duration threshold:" "$HOOK_STATUS_EN"

# 11. Formatação de Comandos Encadeados (Exemplo do Usuário)
CHAINED_CMD="flutter clean;npm run build:all;sleep 15;firebase deploy -P production"
CHAINED_PT_OUT=$(PLIM_LANG=pt "$PLIM_BIN" run "true;$CHAINED_CMD" 2>&1 || true)
assert_contains "plim run detecta e formata 5 comandos encadeados em PT" "⛓️ (5 comandos)" "$CHAINED_PT_OUT"
assert_contains "plim run exibe setas de transição ➔" "➔" "$CHAINED_PT_OUT"

CHAINED_EN_OUT=$(PLIM_LANG=en "$PLIM_BIN" run "true;$CHAINED_CMD" 2>&1 || true)
assert_contains "plim run detecta comandos encadeados em EN" "⛓️ (5 commands)" "$CHAINED_EN_OUT"

# 12. Simulação do plim hook test
HOOK_TEST_OUT=$(PLIM_LANG=pt "$PLIM_BIN" hook test "plim run flutter clean;npm run build:all;sleep 15;firebase deploy -P production")
assert_contains "plim hook test executa simulação com sucesso" "Teste concluído!" "$HOOK_TEST_OUT"

# 13. Mensagens de Progresso e Comandos Encadeados (plim progress & plim run --progress)
HELP_PROG_OUT=$("$PLIM_BIN" --help)
assert_contains "plim --help inclui comando plim progress" "plim progress" "$HELP_PROG_OUT"
assert_contains "plim --help inclui flag --progress" "--progress" "$HELP_PROG_OUT"

PROG_USAGE_PT=$(PLIM_LANG=pt "$PLIM_BIN" progress 2>&1 || true)
assert_contains "plim progress em português exibe instruções de uso" "Uso do comando plim progress:" "$PROG_USAGE_PT"

PROG_USAGE_EN=$(PLIM_LANG=en "$PLIM_BIN" progress 2>&1 || true)
assert_contains "plim progress em inglês exibe usage instructions" "Usage of plim progress command:" "$PROG_USAGE_EN"

PROG_RUN_PT=$(PLIM_LANG=pt "$PLIM_BIN" progress run "echo etapa1; echo etapa2" 2>&1)
assert_contains "plim progress run executa passo a passo em PT" "Passo 1/2" "$PROG_RUN_PT"
assert_contains "plim progress run conclui com sucesso em PT" "Todos os 2 passos concluídos com sucesso" "$PROG_RUN_PT"

RUN_FLAG_PROG=$(PLIM_LANG=en "$PLIM_BIN" run --progress "echo step1; echo step2" 2>&1)
assert_contains "plim run --progress executa passo a passo em EN" "Step 1/2" "$RUN_FLAG_PROG"
assert_contains "plim run --progress conclui com sucesso em EN" "All 2 steps completed successfully" "$RUN_FLAG_PROG"

echo "----------------------------------------"
echo "📊 Resumo dos Testes CLI: $PASSED/$TOTAL passaram ($FAILED falhas)"

if [[ $FAILED -gt 0 ]]; then
    exit 1
fi
exit 0
