# 🔔 Plim

CLI de produtividade para macOS que monitora comandos, emite efeitos sonoros, exibe notificações locais no sistema e envia alertas para o Telegram com o tempo de execução e resumo do output.

---

## ✨ Funcionalidades

- **Monitor de Comandos (`plim run`)**: Executa qualquer comando ou script, cronometra o tempo de execução, detecta sucesso ou falha, emite som característico (`Ping` ou `Basso`), exibe notificação local e despacha relatório para o Telegram com as últimas linhas do output.
- **Suporte a Pipes (`| plim -n`)**: Envie logs ou confirmações encadeadas diretamente no terminal.
- **Sons Nativos do macOS**: Integração direta com `/System/Library/Sounds` (`afplay`).
- **Notificações Telegram**: Receba alertas em tempo real no seu celular ou desktop quando builds, deploys ou testes longos finalizarem.
- **Configuração Simples**: Gerencie credenciais facilmente via CLI.

---

## 🚀 Instalação

### Pré-requisitos

- macOS com `zsh` ou `bash`
- `curl` (para integração com o Telegram)
- Diretório `~/.local/bin` configurado no seu `$PATH`

### 1. Clonar o repositório

```bash
git clone https://github.com/marcusduarte/plim.git ~/IdeaProjects/plim
cd ~/IdeaProjects/plim
```

### 2. Instalar

Para desenvolvimento (cria um link simbólico para refletir alterações em tempo real):

```bash
make link
# ou: ./install.sh
```

Ou para copiar o binário:

```bash
make install
# ou: ./install.sh --copy
```

---

## ⚙️ Configuração do Telegram

Para receber alertas no Telegram:

1. Crie um bot com o [@BotFather](https://t.me/botfather) e obtenha o `BOT_TOKEN`.
2. Obtenha seu `CHAT_ID` (por exemplo, via [@userinfobot](https://t.me/userinfobot)).
3. Configure no `plim`:

```bash
plim config set "<SEU_BOT_TOKEN>" "<SEU_CHAT_ID>"
```

As configurações ficam salvas em `~/.config/plim/config` (ou `~/.plimrc`).

Para verificar as configurações salvas:

```bash
plim config
```

---

## 📖 Como Usar

### 1. Monitorar execução de comandos longos
Executa o comando, cronometra a duração, toca som de sucesso ou erro e avisa no Mac e Telegram:

```bash
plim run npm run build
plim run docker compose up -d
plim run git push origin main
```

### 2. Notificação avulsa ou via pipe

```bash
# Notificação simples
plim -n "Processamento concluído!"

# Via pipe (repassa a saída e notifica ao término)
cat deploy.log | plim -n "Deploy finalizado"
```

### 3. Efeitos sonoros

```bash
# Toca um som aleatório
plim

# Toca um som específico
plim -p Ping
plim -p Hero
plim -p Glass

# Lista todos os sons disponíveis no sistema
plim -l
```

### 4. Testar funcionamento

Testa o som local, notificação do sistema e envio da mensagem para o Telegram:

```bash
plim test
```

---

## 🛠️ Comandos Disponíveis

| Comando | Descrição |
| --- | --- |
| `plim` / `plim -r` | Toca um som aleatório do macOS |
| `plim run <comando>` | Executa comando, mede tempo, detecta status e notifica |
| `plim -n [mensagem]` | Dispara notificação no Mac e Telegram (aceita pipe) |
| `plim -p <som>` | Toca um som específico do sistema |
| `plim -l` | Lista os nomes dos sons disponíveis |
| `plim test` | Testa os canais de áudio, notificação local e Telegram |
| `plim config` | Exibe o status da configuração do Telegram |
| `plim config set <token> <id>` | Configura as credenciais do Telegram |

---

## 📄 Licença

Distribuído sob a licença MIT.
