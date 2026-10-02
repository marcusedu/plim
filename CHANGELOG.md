# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.6.0] - 2026-10-02

### ✨ Adicionado
- **Mensagens de Progresso Dinâmico (Live Status / Edit In-Place)**:
  - **Execução Encadeada com Live Status**:
    - Novo subcomando `plim progress run "<cmds>"` e flag `plim run --progress "<cmds>"` (ou `-P`).
    - Decompõe comandos encadeados com `;`, `&&` ou `||` (ex: `flutter clean; npm run build:all; sleep 15; firebase deploy -P production`) em etapas atômicas.
    - Atualiza em tempo real uma única mensagem no Telegram usando `editMessageText`, eliminando poluição de chat e múltiplos alertas desnecessários.
    - Renderização visual elegante no Telegram: barra de progresso em blocos (`[████████░░░░] 50%`), checklist com ícones dinâmicos (`⏳` ativa, `✅` concluída, `◻️` pendente, `❌` falha), status contextual e tempo decorrido.
    - Interrupção imediata da cadeia em caso de falha de qualquer etapa intermediária com notificação de erro e som nativo.
  - **Subcomandos Programáticos da CLI**:
    - `plim progress start "Título" [passos...]`: Inicia sessão de progresso e retorna o ID único.
    - `plim progress update <id> --percent N --text "msg"`: Atualiza o percentual e status na mensagem ativa.
    - `plim progress finish <id> --status success|error --text "msg"`: Conclui a mensagem com status final e emite som característico.
  - **Ferramenta MCP para Agentes de IA (`plim_progress`)**:
    - Nova ferramenta registrada no servidor MCP (`bin/plim-mcp.js`) com suporte às ações `start`, `update` e `finish`.
    - Agentes de IA (Claude Desktop, Cursor, Antigravity, Cline) agora podem reportar tarefas longas (refatorações, pipelines) diretamente no celular do desenvolvedor através de uma única mensagem viva.
  - **Backend Cloudflare Worker (`/api/progress/*`)**:
    - Novos endpoints `POST /api/progress/start`, `POST /api/progress/update` e `POST /api/progress/finish`.
    - Persistência das sessões e metadados no Cloudflare KV (`progress:<id>`) com TTL automático.

---

## [1.5.0] - 2026-10-02

### ✨ Adicionado
- **Modo Auto-Plim (Shell Hook Transparente)**:
  - Novo comando `plim hook [zsh|bash|fish]` que gera scripts de ciclo de vida (`preexec`/`precmd`) para Zsh, Bash (3.2+) e Fish.
  - Instalação e remoção com 1 clique via `plim hook install` e `plim hook uninstall` no `~/.zshrc`, `~/.bashrc`, `~/.bash_profile` ou `~/.config/fish/config.fish`.
  - Diagnóstico e configuração via `plim hook status` e simulação com `plim hook test`.
  - Disparo de som nativo (`Ping` / `Basso`), notificação local no desktop e alerta push no Telegram sempre que qualquer comando exceder o limiar configurado (padrão: 30 segundos, customizável via `PLIM_AUTO_THRESHOLD`).
- **Suporte Avançado a Comandos Encadeados (`format_chained_cmd`)**:
  - Detecção e formatação visual de comandos encadeados com `;`, `&&` ou `||` (ex: `plim run flutter clean;npm run build:all;sleep 15;firebase deploy -P production`).
  - Formatação concisa e legível com contagem de etapas e setas: `⛓️ (4 comandos) flutter clean ➔ npm run build:all ➔ sleep 15 ➔ firebase deploy -P production` (ou `4 commands` em inglês).
  - Prevenção inteligente de duplicação: comandos únicos invocados via `plim run` não disparam alertas redundantes no hook, mas comandos compostos continuam sendo monitorados até o término do último processo da cadeia.
  - Filtro para ignorar comandos interativos comuns (`vim`, `nvim`, `nano`, `ssh`, `tmux`, `less`, `tail`, `python`, etc.).

---

## [1.4.1] - 2026-10-01

### ✨ Adicionado
- **Encaminhamento de Comandos CLI via `npx plim-mcp`**:
  - `npx plim-mcp` agora reconhece e encaminha comandos da CLI diretamente (ex: `npx plim-mcp test`, `npx plim-mcp run <cmd>`, `npx plim-mcp -n "msg"`).
  - Adicionado comando `npx plim-mcp --help` com instruções rápidas e guia de configuração MCP.
  - Exposição de ambos os binários (`plim-mcp` e `plim`) no `package.json`.
- **Experiência Interativa no Terminal (TTY)**:
  - Adicionado banner informativo no `stderr` quando `plim-mcp` é executado sem argumentos em um terminal interativo (TTY), informando que o servidor está aguardando conexões JSON-RPC e sugerindo comandos úteis.

---

## [1.4.0] - 2026-10-01

### ✨ Adicionado
- **Internacionalização Completa (i18n - Inglês e Português)**:
  - **Telegram Bot & Cloudflare Worker**:
    - Dicionário centralizado de mensagens bilíngues (`en` e `pt`).
    - Detecção automática do idioma nativo do usuário pelo Telegram (`language_code`).
    - Novo comando Telegram `/lang [en|pt]` para alterar o idioma de preferência a qualquer momento.
    - Comandos (`/start`, `/install`, `/status`, `/pro`, `/resettoken`, `/help`), botões inline (`[Yes / No]`, `[Repeat Execution / Cancel]`), faturas de upgrade e alertas de cota traduzidos.
  - **CLI do Plim (`bin/plim` & `bin/plim.ps1`)**:
    - Resolução automática de idioma baseada em `$PLIM_LANG`, arquivo de configuração ou locale do sistema (`$LANG` / `$LC_ALL`).
    - Novo comando `plim lang [en|pt]` para consultar ou salvar o idioma preferido.
    - Mensagens de monitoramento (`Running:` vs `Executando:`), relatórios de término, ajuda (`--help`), diagnóstico (`plim test`) e prompts interativos (`plim ask`) bilíngues.
  - **Servidor MCP (`bin/plim-mcp.js`)**:
    - Ferramenta `plim_ask` com opções padrão dinâmicas (`['Yes', 'No']` para inglês, `['Sim', 'Não']` para português).
    - Perguntas interativas de retry no Telegram traduzidas conforme o idioma configurado.
  - **Documentação Bilíngue**:
    - `README.md` traduzido para inglês com alta qualidade técnica para alcance internacional no GitHub e NPM.
    - Criado `README.pt-BR.md` dedicado para a comunidade de língua portuguesa.
    - Seletor de idioma no topo de ambos os arquivos (`🌐 English | Português`).

---

## [1.3.0] - 2026-10-01

### ✨ Adicionado
- **Alertas Administrativos em Tempo Real**:
  - Notificação instantânea enviada exclusivamente para o administrador (`ADMIN_CHAT_ID`) sempre que um novo usuário entrar no bot Telegram (`/start`) ou configurar seu terminal com sucesso (`plim connect <token>`).
  - Notificação instantânea com detalhes da transação (usuário, chat ID e valor em Telegram Stars) para o administrador sempre que alguém assinar ou fizer upgrade para o **Plim PRO**.
- **Pacote NPM e Execução via `npx plim-mcp`**:
  - Adicionado `package.json` na raiz tornando o Plim MCP executável via Node.js / npx sem dependências externas (`npx plim-mcp`).
  - Resolução aprimorada do binário `plim` e fallback gracioso com áudio nativo (`afplay` / sons de sistema) e disparo HTTP direto caso o script CLI não esteja no PATH.
- **Manifesto de Integração HOL Guard**:
  - Criado o arquivo declarativo `integrations/hol-guard/mcp.plim.json` em total conformidade com o schema oficial do [HOL Guard](https://github.com/hashgraph-online/hol-guard).

---

## [1.2.1] - 2026-10-01

### 🐛 Corrigido
- **Correção de Escopo de Variáveis na CLI (`ask_cli`)**:
  - Movida a lógica do comando `plim ask` para a função dedicada `ask_cli()`, eliminando o erro `local: can only be used in a function`.
  - Tratamento tolerante a vírgulas e colchetes nas opções passadas via terminal (ex: `plim ask 'Pergunta?' sim, nao`).
  - Tratamento defensivo no parsing de resposta JSON do backend.
- **Deploy em Produção do Cloudflare Worker**:
  - Publicação da nova versão com os endpoints `/api/ask`, `/api/ask/:id` e `callback_query` em `https://plim-api.marcusedu.workers.dev`.

---

## [1.2.0] - 2026-10-01

### ✨ Adicionado
- **Perguntas Interativas via Telegram (`plim_ask`)**:
  - Nova ferramenta MCP `plim_ask` que envia perguntas com botões de múltipla escolha (Inline Keyboard) para o celular do desenvolvedor e aguarda a decisão para prosseguir.
  - Novo comando CLI `plim ask <pergunta> [opções...]` para scripts de automação ou uso direto no terminal.
  - Novos endpoints no Cloudflare Worker: `POST /api/ask` e `GET /api/ask/:id`.
  - Tratamento nativo de `callback_query` no webhook do Telegram: responde ao clique, atualiza a mensagem com a opção escolhida e grava o estado no Cloudflare KV.
- **Retry Interativo de Comandos (`retry_on_failure`)**:
  - Parâmetro `retry_on_failure` na ferramenta MCP `plim_run`: se o comando falhar, envia botões `[🔁 Repetir Execução]` e `[🛑 Cancelar]` para o Telegram.
  - Reexecução automática do comando caso o desenvolvedor aprove pelo celular.
- **Sintaxe Abreviada de Notificação**:
  - Suporte a notificações rápidas sem a flag `-n`: `plim "Deploy concluído!"`.
- **Suporte a Pipeline no PowerShell**:
  - Atualizado `bin/plim.ps1` para repassar a saída e notificar quando usado em pipes no Windows.

### 🐛 Corrigido
- **Suporte Completo a Pipes Unix (`| plim`)**:
  - Detecção automática de entrada via `stdin` com streaming em tempo real usando `tee` (o usuário vê a saída rolar sem bloqueio).
  - Suporte a comandos encadeados com mensagens customizadas: `npm test | plim "Testes unitários"`.
- **Desvinculação de Processos em Background**:
  - Fechamento explícito dos descritores (`</dev/null >/dev/null 2>&1 &`) em `afplay`, `osascript` e chamadas `curl`, eliminando travamentos/congelamentos de pipelines no Bash 3.2 do macOS.
- **Erro Fatal de Sintaxe no Bash (`bad array subscript`)**:
  - Substituição da sintaxe exclusiva do Zsh `${escaped_extra[-3500,-1]}` por `${escaped_extra: -3500}`, compatível com Bash 3.2+ e Zsh.
- **Proteção Contra Sobrecarga de Payload**:
  - Truncamento seguro das últimas linhas do log antes do envio ao Cloudflare Worker/Telegram, prevenindo rejeições por payload grande.

---

## [1.1.0] - 2026-09-30

### ✨ Adicionado
- **Backend Serverless em Cloudflare Worker**:
  - Webhook oficial integrado ao bot [@plim_the_bot](https://t.me/plim_the_bot).
  - Armazenamento em Cloudflare KV para vinculação de tokens (`plim connect <token>`) e contagem de limites diários.
  - Suporte a planos Free (50 notificações/dia) e Pro (Ilimitado via pagamentos nativos com Telegram Stars).
- **Integração Nativa com Agentes de IA & MCP**:
  - Servidor MCP em Node.js (`bin/plim-mcp.js`) executável via `plim mcp`.
  - Ferramentas MCP iniciais: `plim_notify` e `plim_run`.
  - Arquivo de contexto `llms.txt` e guia de integração `CLAUDE.md`.
- **Multiplataforma**:
  - Suporte a Linux com `notify-send` e temas de som Freedesktop (`paplay`/`aplay`/bell).
  - Suporte a Windows WSL e script nativo PowerShell (`bin/plim.ps1`).
- **Auto-Update e Versionamento**:
  - Checagem automática e não-bloqueante de novas versões a cada 24 horas.
  - Comando `plim update` para atualização direta via GitHub.
  - Flag `--version` / `-v`.

---

## [1.0.0] - 2026-09-30

### ✨ Adicionado
- Lançamento inicial da CLI do Plim.
- Monitor de comandos `plim run <comando>` com medição de duração e detecção de status de saída (`exit code`).
- Efeitos sonoros locais no macOS (`afplay` com sons nativos de `/System/Library/Sounds`).
- Notificações de desktop nativas via AppleScript.
- Notificações remotas diretas para Telegram via bot próprio (`TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`).
- Script de instalação rápida `install.sh` via `curl | bash` e `Makefile` com suporte a `make install` e `make link`.
