# 03 - Mensagens de Progresso Dinâmico (Live Status / Edit In-Place)

## 💡 Contexto e Motivação

Atualmente, cada notificação do Plim gera uma nova mensagem no chat do Telegram. Em processos que possuem múltiplas etapas sequenciais (ex: *Build -> Testes -> Docker Image -> Deploy em Staging -> Healthcheck*), isso resulta em:
1. **Poluição visual do chat**: Múltiplas mensagens que rapidamente se tornam obsoletas.
2. **Excesso de alertas no celular**: O desenvolvedor recebe 5 a 10 notificações sonoras em um intervalo curto.

A **Telegram Bot API** disponibiliza o método `editMessageText`, permitindo transformar uma única mensagem em um painel dinâmico em tempo real (*Live Status*).

---

## 💻 Experiência de Uso (Interface)

### 1. Na Linha de Comando (CLI)

```bash
# Inicia um bloco de progresso e obtém o ID da sessão
PROG_ID=$(plim progress start "Pipeline de Release")

# Atualiza etapas intermediárias (a mesma mensagem no Telegram é editada silenciosamente)
plim progress update "$PROG_ID" --percent 25 --text "Compilando assets do front-end..."
plim progress update "$PROG_ID" --percent 60 --text "Executando testes automatizados..."
plim progress update "$PROG_ID" --percent 90 --text "Criando imagem Docker e enviando para o registry..."

# Finaliza o processo (emite som local no Mac/PC e confirmação no Telegram)
plim progress finish "$PROG_ID" --status success --text "Deploy finalizado com sucesso em produção! 🚀"
```

### 2. No Servidor MCP (`bin/plim-mcp.js`)

Nova ferramenta MCP: `plim_progress`:

```json
{
  "name": "plim_progress",
  "arguments": {
    "action": "update",
    "progress_id": "prog_a1b2c3d4",
    "percent": 75,
    "current_step": "Refatorando módulo de autenticação...",
    "steps": [
      { "label": "Análise de dependências", "done": true },
      { "label": "Refatoração de código", "active": true },
      { "label": "Validação com testes", "done": false }
    ]
  }
}
```

---

## 📱 Renderização Visual no Telegram

A mensagem no Telegram é reescrita dinamicamente conforme o progresso avança:

```text
🔄 Pipeline de Release [Passo 2 de 3]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[████████████░░░░] 75%

✅ Análise de dependências
⏳ Refatoração de código (em andamento...)
◻️ Validação com testes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️ Decorrido: 01m 24s
```

Ao finalizar:
```text
✅ Pipeline de Release [Concluído]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[████████████████] 100%

✅ Análise de dependências
✅ Refatoração de código
✅ Validação com testes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Deploy finalizado com sucesso em produção!
⏱️ Duração total: 01m 52s
```

---

## ⚙️ Especificação Técnica & Resiliência

### 1. Throttling e Rate Limits do Telegram

* A API do Telegram impõe um limite estrito de aproximadamente **1 edição por segundo por chat** e cerca de **20 edições por minuto** em mensagens individuais.
* **Mecanismo de Throttling**:
  * Se o script chamar `plim progress update` várias vezes em milissegundos, o Worker ou a CLI aplicam um *debounce/throttle* de no mínimo 1.5 segundo entre requisições reais à API do Telegram.
  * O estado final (`plim progress finish`) **sempre** é executado imediatamente para garantir que a tela nunca fique travada em 99%.

### 2. Persistência de Estado no Cloudflare Worker

* **Tabela/KV Temporário**:
  * Ao criar o progresso (`POST /api/progress/start`), o Worker envia a primeira mensagem, recebe o `message_id` do Telegram e armazena:
    ```json
    {
      "chatId": 12345678,
      "messageId": 9876,
      "title": "Pipeline de Release",
      "startedAt": 1727850000
    }
    ```
  * TTL automático no KV de **2 horas** (evita chaves órfãs se o processo for interrompido abruptamente).
* **Endpoints**:
  * `POST /api/progress/start`
  * `POST /api/progress/update`
  * `POST /api/progress/finish`
