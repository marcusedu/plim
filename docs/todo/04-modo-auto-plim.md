# 04 - Modo Auto-Plim (Shell Hook para Comandos Demorados)

## 💡 Contexto e Motivação

O comando `plim run <comando>` é extremamente útil, mas exige **intenção prévia**: o desenvolvedor precisa lembrar de digitar `plim run` *antes* de executar uma tarefa pesada.

Na prática cotidiana, desenvolvedores frequentemente executam comandos que inesperadamente demoram vários minutos (ex: `npm install`, `cargo build`, `docker build`, `git clone`, `pod install`) e mudam de janela para navegar na web ou tomar um café. Sem o Plim, o comando termina em silêncio e o dev perde tempo até se lembrar de checar o terminal.

O **Modo Auto-Plim** adiciona uma camada transparente aos interpretadores de comando (Zsh, Bash e Fish) que monitora o tempo de execução de **qualquer comando** executado diretamente no shell. Se o comando levar mais de $X$ segundos (ex: 30s), o Plim emite o alerta sonoro e notificação automaticamente.

---

## 💻 Experiência de Uso (Interface)

### 1. Ativação Rápida (Opt-in)

O desenvolvedor pode habilitar o hook adicionando uma única linha ao seu arquivo de configuração (`~/.zshrc` ou `~/.bashrc`):

```bash
# No ~/.zshrc:
eval "$(plim hook zsh)"

# Ou comando interativo de instalação automática:
plim hook install
```

### 2. Configurações Disponíveis

Variáveis de ambiente ou chaves em `~/.config/plim/config`:

```bash
# Limiar mínimo de duração em segundos (Padrão: 30)
PLIM_AUTO_THRESHOLD=30

# Ativar notificações remotas para o Telegram além do som local (Padrão: false para não sobrecarregar o celular)
PLIM_AUTO_TELEGRAM=true

# Lista de comandos interativos ignorados
PLIM_AUTO_IGNORE="vim,nano,less,top,htop,ssh,tmux,tail,man,watch,python,node"
```

---

## ⚙️ Como Funciona Sob o Capô (Arquitetura Técnica)

### 1. No Zsh (`preexec` e `precmd`)

O Zsh possui funções de ciclo de vida nativas de altíssima performance:

```zsh
plim_preexec() {
    # Salva timestamp inicial e comando executado
    PLIM_START_TIME=$(date +%s)
    PLIM_LAST_CMD="$1"
}

plim_precmd() {
    local exit_code=$?
    if [[ -n "$PLIM_START_TIME" ]]; then
        local now=$(date +%s)
        local elapsed=$((now - PLIM_START_TIME))
        local threshold="${PLIM_AUTO_THRESHOLD:-30}"

        # Verifica se comando está na lista de exceções
        local first_word="${PLIM_LAST_CMD%% *}"
        if [[ ! ",${PLIM_AUTO_IGNORE:-vim,nano,ssh,top}," == *",$first_word,"* ]]; then
            if (( elapsed >= threshold )); then
                # Dispara som e notificação local em background sem bloquear o shell
                if (( exit_code == 0 )); then
                    plim -p Ping </dev/null >/dev/null 2>&1 &
                else
                    plim -p Basso </dev/null >/dev/null 2>&1 &
                fi

                # Envio opcional para Telegram se PLIM_AUTO_TELEGRAM=true
                if [[ "${PLIM_AUTO_TELEGRAM:-false}" == "true" ]]; then
                    plim -n "Comando finalizado (${elapsed}s, status: $exit_code): $first_word" </dev/null >/dev/null 2>&1 &
                fi
            fi
        fi
        unset PLIM_START_TIME
    fi
}

autoload -Uz add-zsh-hook
add-zsh-hook preexec plim_preexec
add-zsh-hook precmd plim_precmd
```

### 2. No Bash (`PROMPT_COMMAND` e `DEBUG trap`)

Compatível com macOS (Bash 3.2+) e Linux via `PROMPT_COMMAND` e captura controlada de timestamp.

### 3. No Fish Shell

Integração através dos manipuladores de eventos `--on-event fish_preexec` e `--on-event fish_postexec`.

---

## 🛡️ Princípios de Design e Segurança

1. **Impacto Zero no Desempenho do Shell**: Operações de hook devem executar em menos de 2 milissegundos;
2. **Execução Totalmente em Background**: Todo alerta ou som gerado é desvinculado dos descritores de saída (`</dev/null >/dev/null 2>&1 &`) para jamais travar o próximo comando no terminal;
3. **Filtro de Interatividade**: Programas que mantêm o terminal ocupado por design (como editores `vim`, conexões `ssh`, paginadores `less`) são estritamente ignorados para evitar falsos positivos;
4. **Respeito a Janelas em Foco**: No macOS, é possível detectar opcionalmente se a janela do terminal está em foco no momento da conclusão: se o usuário já estiver olhando para o terminal, pode-se tocar apenas um som discreto e omitir a notificação push.
