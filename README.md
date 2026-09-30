<div align="center">
  <img src="assets/icon.jpg" width="128" height="128" alt="Plim Logo" style="border-radius: 28px;" />
  <h1>Plim</h1>
  <p><b>CLI de produtividade para desenvolvedores</b></p>
  <p>Monitore builds, testes e deploys demorados com efeitos sonoros nativos e notificações instantâneas no seu celular via Telegram.</p>
</div>

Acompanha backend serverless em **Cloudflare Worker** integrado ao bot **[@plim_the_bot](https://t.me/plim_the_bot)** com suporte a controle de acesso e limites diários de uso.

---

## ✨ Funcionalidades

- **Monitor de Comandos (`plim run`)**: Executa qualquer comando ou script, cronometra a duração, detecta sucesso ou falha, emite som característico (`Ping` ou `Basso`), exibe notificação local e despacha relatório para o Telegram com as últimas linhas do output.
- **Onboarding Instantâneo com Telegram**: Abra o bot [@plim_the_bot](https://t.me/plim_the_bot), envie `/start` e conecte seu terminal com `plim connect <token>`.
- **Suporte a Pipes (`| plim -n`)**: Envie logs ou confirmações encadeadas diretamente no terminal.
- **Sons Nativos do macOS**: Integração direta com `/System/Library/Sounds` (`afplay`).
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

### 2. Conectar com o Telegram
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
plim run firebase deploy
```

### 2. Notificação avulsa ou via pipe

```bash
# Notificação simples
plim -n "Deploy em homologação concluído!"

# Via pipe (repassa a saída e notifica ao término)
cat deploy.log | plim -n "Deploy finalizado"
```

### 3. Testar a conexão
```bash
plim test
```

### 4. Efeitos sonoros locais

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

## ☁️ Estrutura do Projeto

```text
plim/
├── bin/
│   └── plim              # Script CLI executável em Zsh
├── worker/               # Backend Cloudflare Worker (TypeScript + Hono)
│   ├── src/
│   │   └── index.ts      # Webhook do Telegram + API de Notificações
│   ├── wrangler.toml     # Configuração e KV Bindings
│   ├── package.json
│   └── README.md         # Instruções de deploy do Worker
├── install.sh            # Script de instalação curl-to-bash
├── Makefile              # Comandos make install / make link
└── README.md
```

Para publicar o backend no seu Cloudflare, veja as instruções em [worker/README.md](worker/README.md).

---

## 🛠️ Tabela de Comandos

| Comando | Descrição |
| --- | --- |
| `plim run <comando>` | Executa comando, mede tempo, detecta status e notifica com log |
| `plim connect <token>` | Conecta ao bot [@plim_the_bot](https://t.me/plim_the_bot) |
| `plim -n [mensagem]` | Dispara notificação no Mac e Telegram (aceita pipe) |
| `plim test` | Testa os canais de áudio, notificação local e Telegram |
| `plim config` | Exibe a configuração atual ativa |
| `plim config set-url <url>` | Altera a URL da API do Worker |
| `plim config set <token> <id>` | Configura bot próprio direto (self-hosted) |
| `plim` / `plim -r` | Toca um som aleatório do macOS |
| `plim -p <som>` | Toca um som específico do sistema |
| `plim -l` | Lista os nomes dos sons disponíveis |

---

## 📄 Licença

Distribuído sob a licença MIT.
