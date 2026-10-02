<div align="center">
  <img src="assets/icon.jpg" width="128" height="128" alt="Plim Logo" style="border-radius: 28px;" />
  <h1>Plim</h1>
  <p><b>CLI de produtividade para desenvolvedores e Servidor MCP para Agentes de IA</b></p>
  <p>Monitore builds, testes e deploys demorados com efeitos sonoros nativos e notificações instantâneas no seu celular via Telegram.</p>
  <p>
    🌐 <b><a href="README.md">English</a></b> | <b>Português</b>
  </p>
</div>

Acompanha servidor **Model Context Protocol (MCP)** para agentes de IA e backend serverless em **Cloudflare Worker** integrado ao bot **[@plim_the_bot](https://t.me/plim_the_bot)** com suporte a perguntas interativas via Telegram, controle de acesso e limites diários de uso.

---

## ✨ Funcionalidades

- **Monitor de Comandos (`plim run`)**: Executa qualquer comando ou script, cronometra a duração, detecta sucesso ou falha, emite som característico (`Ping` ou `Basso`), exibe notificação local e despacha relatório para o Telegram com as últimas linhas do output.
- **Mensagens de Progresso Dinâmico (`plim progress` e `plim run --progress`)**: Live Status com atualização in-place no Telegram (`editMessageText`), barra de progresso visual em blocos (`[████░░░░] 50%`) e checklist de etapas (`⏳ -> ✅ -> ❌`) para comandos encadeados (`cmd1; cmd2; cmd3`) e pipelines, eliminando poluição no chat.
- **Modo Auto-Plim (Shell Hook Transparente)**: Monitora automaticamente comandos demorados (> 30s) e encadeamentos (`cmd1; cmd2; cmd3`) no Zsh, Bash e Fish com alertas sonoros e push no Telegram, sem precisar digitar `plim run`.
- **Perguntas Interativas no Celular (`plim ask`)**: Faça perguntas com botões de múltipla escolha via Telegram para aprovar migrações, deploys ou decisões de código pelo celular.
- **Servidor MCP para Agentes de IA (`plim mcp` ou `npx -y plim-mcp`)**: Integração oficial com Claude Desktop, Cursor, Windsurf, Cline e Antigravity (ferramentas `plim_notify`, `plim_ask`, `plim_run`, `plim_progress`).
- **Internacionalização (i18n)**: Suporte completo a **Inglês** e **Português**, detectado automaticamente pelo sistema ou configurável via `plim lang [en|pt]`.
- **Onboarding Instantâneo com Telegram**: Abra o bot [@plim_the_bot](https://t.me/plim_the_bot), envie `/start` e conecte seu terminal com `plim connect <token>`.
- **Suporte a Pipes (`| plim -n`)**: Envie logs ou confirmações encadeadas diretamente no terminal.
- **Sons Nativos do macOS / Linux / Windows**: Integração direta com `/System/Library/Sounds` (`afplay`), Freedesktop Sound Theme e PowerShell System Sounds.
- **Backend em Cloudflare Worker**:
  - Webhook oficial do Telegram com geração automática de tokens.
  - Armazenamento em Cloudflare KV (`token -> chat_id`, limites de uso diário).
  - Suporte a planos Free (50 notificações/dia) e Pro/Ilimitado (preparado para Telegram Stars).
- **100% Multiplataforma**:
  - 🍏 **macOS**: `afplay` e AppleScript nativos.
  - 🐧 **Linux**: `notify-send` e sons do freedesktop (`paplay`/`aplay`/bell).
  - 🪟 **Windows**: Suporte total via WSL, Git Bash e script nativo `plim.ps1` para PowerShell.
- **Modo Self-Hosted**: Quem preferir usar um bot próprio sem passar pelo Cloudflare pode configurar diretamente via `plim config set`.

---

## 🚀 Instalação Rápida

### macOS / Linux / Windows (WSL & Git Bash)
```bash
curl -fsSL https://raw.githubusercontent.com/marcusedu/plim/main/install.sh | bash
```

### Windows (PowerShell Nativo)
Clone o repositório ou adicione a pasta `bin` ao seu `$PATH`, ou use:
```powershell
.\bin\plim.ps1 connect <SEU_TOKEN>
.\bin\plim.ps1 run npm run build
```

*(Ou clone o repositório e rode `make link` para desenvolvimento).*

### Conectar com o Telegram
1. Abra o bot no Telegram: **[@plim_the_bot](https://t.me/plim_the_bot)** e envie `/start`.
2. O bot responderá com o seu comando personalizado de conexão:
   ```bash
   plim connect plim_live_...
   ```
3. Cole o comando no seu terminal. Pronto! Uma mensagem de boas-vindas chegará no seu celular confirmando a ativação.

---

## 📖 Como Usar

### 1. Monitorar comandos pesados ou demorados
Executa o comando exibindo a saída normal, mede o tempo decorrido, toca som de sucesso ou erro e avisa no Mac e no Telegram:

```bash
plim run npm run build
plim run docker compose up -d
plim run git push origin main
plim run cargo test
```

### 2. Perguntas Interativas com Botões no Telegram
Envia pergunta para o seu celular com botões interativos e bloqueia até você responder:

```bash
# Pergunta com opções padrão ("Sim" / "Não")
plim ask "Deseja aplicar a migração em produção?"

# Pergunta com opções personalizadas
plim ask "Qual estratégia de deploy?" "Canary" "Blue/Green" "Rollback"
```

### 3. Progresso Dinâmico e Comandos Encadeados (`plim progress`)
Execute comandos encadeados sequenciais com acompanhamento em tempo real no Telegram sem poluir o chat:

```bash
# Executa cadeia de comandos com Live Status visual no Telegram:
plim run --progress "flutter clean; npm run build:all; sleep 15; firebase deploy -P production"
# ou
plim progress run "flutter clean; npm run build:all; sleep 15; firebase deploy -P production"

# Uso programático em scripts personalizados:
ID=$(plim progress start "Pipeline de Release" "Dependências" "Build" "Testes" "Deploy")
plim progress update "$ID" --percent 25 --text "Compilando assets do front-end..."
plim progress update "$ID" --percent 75 --text "Executando testes automatizados..."
plim progress finish "$ID" --status success --text "Deploy finalizado com sucesso em produção! 🚀"
```

### 4. Modo Auto-Plim (Shell Hook Transparente)
Monitore automaticamente qualquer comando ou encadeamento que levar mais de 30 segundos, sem precisar lembrar de digitar `plim run`:

```bash
# 1. Instalação rápida no seu shell atual (Zsh, Bash ou Fish):
plim hook install

# 2. Ou ativação manual no ~/.zshrc (ou ~/.bashrc):
eval "$(plim hook zsh)"

# 3. Suporte a comandos encadeados com ;, && ou ||:
plim run flutter clean;npm run build:all;sleep 15;firebase deploy -P production
# ➔ Ao terminar, você recebe o alerta no celular:
# ⛓️ (4 comandos) flutter clean ➔ npm run build:all ➔ sleep 15 ➔ firebase deploy -P production

# 4. Verificar status e configurações:
plim hook status
```

### 5. Notificação avulsa ou via pipe

```bash
# Notificação simples
plim -n "Deploy em homologação concluído!"

# Via pipe (repassa a saída e notifica ao término)
cat deploy.log | plim -n "Deploy finalizado"
```

### 6. Idioma (Internacionalização)
```bash
# Ver idioma atual
plim lang

# Definir para Inglês ou Português
plim lang en
plim lang pt
```

### 7. Testar a conexão
```bash
plim test
```

### 8. Efeitos sonoros locais

```bash
# Toca um som aleatório
plim

# Toca um som específico
plim -p Ping
plim -p Hero
plim -p Glass

# Lista todos os sons disponíveis no macOS
plim -l
```

---

## 🤖 Integração com Agentes de IA & MCP

O Plim possui suporte nativo ao **Model Context Protocol (MCP)** e ao padrão **`llms.txt`**. Isso permite que agentes de IA autônomos (**Claude Code**, **Cursor**, **Windsurf**, **Cline**, **Antigravity**) notifiquem o seu celular quando terminarem tarefas pesadas ou precisarem de decisão humana.

### 1. Como Servidor MCP (Claude Desktop, Cursor, Windsurf, Cline)
Basta adicionar a configuração MCP (disponível em `mcp.json`):

```json
{
  "mcpServers": {
    "plim": {
      "command": "plim",
      "args": ["mcp"]
    }
  }
}
```

*Ou diretamente via `npx` (sem precisar instalar a CLI antes):*
```json
{
  "mcpServers": {
    "plim": {
      "command": "npx",
      "args": ["-y", "plim-mcp"]
    }
  }
}
```

O agente ganhará automaticamente as ferramentas:
- **`plim_ask`**: Faz perguntas com botões de múltipla escolha no Telegram e aguarda a decisão do desenvolvedor.
- **`plim_run`**: Executa comando pesado, notifica na conclusão e oferece botão interativo de Retry no Telegram se houver falha.
- **`plim_notify`**: Envia alerta push com status para o celular do dev.

### 2. Para Claude Code / Cursor Agent (via `CLAUDE.md`)
Adicione o arquivo `CLAUDE.md` na raiz do seu projeto. O agente usará o Plim automaticamente para monitorar tarefas demoradas, fazer perguntas pelo Telegram e avisar no seu bolso quando terminar!

---

## ☁️ Estrutura do Projeto

```text
plim/
├── bin/
│   ├── plim              # Script CLI executável (macOS, Linux, WSL)
│   ├── plim-mcp.js       # Servidor MCP stdio para agentes de IA
│   └── plim.ps1          # Script nativo PowerShell para Windows
├── worker/               # Backend Cloudflare Worker (TypeScript + Hono)
│   ├── src/
│   │   └── index.ts      # Webhook Telegram + Perguntas Interativas + i18n
│   ├── wrangler.toml     # Configuração e KV Bindings
│   ├── package.json
│   └── README.md         # Instruções de deploy do Worker
├── install.sh            # Script de instalação curl-to-bash
├── Makefile              # Comandos make install / make link / make test
├── README.md             # Documentação em Inglês
└── README.pt-BR.md       # Documentação em Português
```

---

## 🛠️ Tabela de Comandos

| Comando | Descrição |
| --- | --- |
| `plim ask <pergunta> [opções]` | Envia pergunta interativa com botões no Telegram e aguarda resposta |
| `plim run <comando>` | Executa comando, mede tempo, detecta status e notifica com log |
| `plim run --progress <cmds>` | Executa cadeia de comandos com Live Status no Telegram |
| `plim progress run <cmds>` | Executa cadeia de comandos com Live Status no Telegram |
| `plim progress start/update/...` | Gerencia mensagens dinâmicas de progresso no Telegram |
| `plim hook [zsh\|bash\|fish]` | Gera script de hook do Auto-Plim para o shell especificado |
| `plim hook install` | Instala o hook do Auto-Plim no perfil do shell atual |
| `plim hook status` | Exibe o status e configurações ativas do Auto-Plim |
| `plim hook test` | Simula um disparo de notificação do Auto-Plim |
| `plim connect <token>` | Conecta ao bot [@plim_the_bot](https://t.me/plim_the_bot) |
| `plim lang [en\|pt]` | Exibe ou define o idioma da CLI |
| `plim mcp` | Inicia servidor MCP para agentes de IA (Claude, Cursor, Windsurf) |
| `plim [mensagem]` | Notificação rápida (ex: `plim 'Deploy pronto'`) |
| `plim -n [mensagem]` | Dispara notificação no desktop e Telegram |
| `comando \| plim` | Faz streaming em tempo real, toca som e notifica no término |
| `comando \| plim 'Deploy'` | Lê o pipe e notifica com mensagem customizada |
| `plim update` | Verifica e atualiza o Plim para a versão mais recente |
| `plim version` / `-v` | Exibe a versão instalada do Plim |
| `plim test` | Testa os canais de áudio, notificação local e Telegram |
| `plim config` | Exibe a configuração atual ativa |
| `plim config set-url <url>` | Altera a URL da API do Worker |
| `plim config set <token> <id>` | Configura bot próprio direto (self-hosted) |
| `plim` / `plim -r` | Toca um som aleatório do sistema |
| `plim -p <som>` | Toca um som específico do sistema |
| `plim -l` | Lista os nomes dos sons disponíveis |

---

## 📄 Licença

Distribuído sob a licença MIT.
