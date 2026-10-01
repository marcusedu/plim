# ☁️ Plim Cloudflare Worker

Backend serverless para o **Plim CLI** e bot do Telegram (**@plim_the_bot**).

---

## 🏗️ Arquitetura

- **Hono Framework**: Router leve e de alta performance para Cloudflare Workers.
- **Cloudflare KV**: Armazenamento chave-valor ultra-rápido para tokens de usuário (`token:plim_live_...`), perfis (`user:chat_id`) e contadores de limites diários (`usage:chat_id:YYYY-MM-DD`).
- **Telegram Bot Webhook**: Recebe `/start`, gera chaves de API automaticamente e envia comandos prontos de conexão.
- **Notify API**: Recebe eventos do CLI `plim run` e despacha para o Telegram do usuário autenticado.

---

## 🚀 Como Publicar no Cloudflare

### 1. Instalar dependências
```bash
cd worker
npm install
```

### 2. Criar o KV Namespace no Cloudflare
```bash
npx wrangler kv namespace create PLIM_KV
```
Copie o `id` gerado e cole no arquivo `wrangler.toml` no campo `id`.

*(Opcional para testes locais)*:
```bash
npx wrangler kv namespace create PLIM_KV --preview
```
Cole no campo `preview_id`.

### 3. Configurar os Segredos (Secrets)
Defina o token do seu bot do Telegram com segurança:
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Cole o token fornecido pelo @BotFather (ex: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ)
```

*(Opcional)* Segredo para proteger o webhook do Telegram:
```bash
npx wrangler secret put WEBHOOK_SECRET
# Digite uma senha aleatória qualquer
```

### 4. Fazer Deploy
```bash
npx wrangler deploy
```

O Cloudflare fornecerá uma URL pública, por exemplo:
`https://plim-api.<seu-subdominio>.workers.dev`

### 5. Ativar o Webhook no Telegram
Substitua `<SEU_TOKEN>` e `<SUA_URL_DO_WORKER>` e execute uma vez:

```bash
curl -F "url=https://SUA_URL_DO_WORKER/webhook" https://api.telegram.org/botSEU_TOKEN/setWebhook
```
*(Se você definiu `WEBHOOK_SECRET`, passe também `-F "secret_token=SUA_SENHA"`).*

Pronto! Ao enviar `/start` para o bot, o Worker responderá na hora gerando a chave do usuário! 🎉
