import { Hono } from 'hono';

type Bindings = {
  PLIM_KV: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET?: string;
  FREE_TIER_DAILY_LIMIT?: string;
  PRO_TIER_DAILY_LIMIT?: string;
  PRO_PRICE_STARS?: string; // Preço em Telegram Stars (ex: 150)
  ADMIN_CHAT_ID?: string;
};

interface UserRecord {
  chatId: number;
  token: string;
  username?: string;
  firstName?: string;
  plan: 'free' | 'pro';
  createdAt: number;
  upgradedAt?: number;
  connectedAt?: number;
  lang?: 'en' | 'pt';
}

interface AskRecord {
  id: string;
  chatId: number;
  question: string;
  options: string[];
  status: 'pending' | 'answered' | 'expired';
  answer?: string;
  answerIndex?: number;
  createdAt: number;
  messageId?: number;
  type?: 'question' | 'retry';
  command?: string;
  lang?: 'en' | 'pt';
}

interface ProgressStep {
  label: string;
  status: 'done' | 'active' | 'pending' | 'failed';
}

interface ProgressRecord {
  id: string;
  chatId: number;
  messageId: number;
  title: string;
  percent: number;
  status: 'running' | 'success' | 'error';
  statusText?: string;
  steps?: ProgressStep[];
  startedAt: number;
  lastUpdatedAt: number;
  duration?: string;
  lang?: 'en' | 'pt';
}

type SupportedLang = 'en' | 'pt';

function getLang(user?: { lang?: 'en' | 'pt' } | null, langCode?: string | null): SupportedLang {
  if (user?.lang === 'pt' || user?.lang === 'en') return user.lang;
  if (langCode && langCode.toLowerCase().startsWith('pt')) return 'pt';
  return 'en';
}

const app = new Hono<{ Bindings: Bindings }>();

// Helper para enviar mensagens via Telegram Bot API
async function sendTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
  extra?: { reply_markup?: any; parse_mode?: string }
) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: extra?.parse_mode ?? 'HTML',
      reply_markup: extra?.reply_markup,
    }),
  });
  return response.json() as Promise<any>;
}

// Helper para editar texto de mensagem existente
async function editTelegramMessageText(
  token: string,
  chatId: number | string,
  messageId: number,
  text: string,
  extra?: { reply_markup?: any; parse_mode?: string }
) {
  const url = `https://api.telegram.org/bot${token}/editMessageText`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: extra?.parse_mode ?? 'HTML',
      reply_markup: extra?.reply_markup,
    }),
  });
  return response.json() as Promise<any>;
}

// Helper para responder Callback Query de Inline Keyboard
async function answerTelegramCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string
) {
  const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
  return response.json() as Promise<any>;
}

// Helper para enviar fatura do Telegram Stars (XTR)
async function sendTelegramInvoice(
  token: string,
  chatId: number | string,
  title: string,
  description: string,
  payload: string,
  starsAmount: number
) {
  const url = `https://api.telegram.org/bot${token}/sendInvoice`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      title,
      description,
      payload,
      currency: 'XTR', // Moeda oficial: Telegram Stars
      prices: [{ label: title, amount: starsAmount }],
      provider_token: '', // Vazio para pagamentos com Telegram Stars
    }),
  });
  return response.json();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getTodayKey(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

const MESSAGES = {
  welcome: {
    en: (token: string) => `🎉 <b>Welcome to Plim!</b>

Plim monitors long terminal tasks and notifies your phone the second they finish.

<b>1️⃣ Connect your terminal:</b>
Copy and paste this command:
<code>plim connect ${token}</code>

<b>Or use directly with AI agents:</b>
<code>npx plim-mcp</code>

<b>2️⃣ Everyday usage:</b>
• <code>plim run &lt;command&gt;</code> monitor builds, tests & deploys
• <code>plim ask "Should I proceed?"</code> interactive Telegram approvals
• <code>plim -n "Message"</code> instant desktop & phone push
• <code>/install</code> how to install Plim on other machines
• <code>/status</code> check your daily notification quota
• <code>/pro</code> unlimited lifetime notifications
• <code>/lang</code> change language (en / pt)`,
    pt: (token: string) => `🎉 <b>Bem-vindo ao Plim!</b>

O Plim monitora tarefas longas no seu Mac/Linux/Windows e te avisa no celular quando terminarem.

<b>1️⃣ Conecte seu terminal:</b>
Copie e cole o comando abaixo:
<code>plim connect ${token}</code>

<b>Ou use direto com agentes de IA:</b>
<code>npx plim-mcp</code>

<b>2️⃣ Como usar no dia a dia:</b>
• <code>plim run &lt;comando&gt;</code> para monitorar builds e deploys
• <code>plim ask "Posso prosseguir?"</code> para perguntas interativas
• <code>plim -n "Mensagem"</code> para notificações rápidas
• <code>/install</code> para ver como instalar em outra máquina
• <code>/status</code> para ver sua cota diária
• <code>/pro</code> para ter notificações ilimitadas
• <code>/lang</code> alterar idioma (en / pt)`,
  },
  install: {
    en: (token: string) => `📦 <b>How to Install Plim</b>

In your terminal (macOS, Linux or WSL), run:
<code>curl -fsSL https://raw.githubusercontent.com/marcusedu/plim/main/install.sh | bash</code>

Or install and connect in one step:
<code>curl -fsSL https://raw.githubusercontent.com/marcusedu/plim/main/install.sh | bash -s -- ${token}</code>

<b>Run directly via NPM / NPX (Zero install):</b>
<code>npx plim-mcp</code>`,
    pt: (token: string) => `📦 <b>Como Instalar o Plim</b>

No seu terminal (macOS, Linux ou WSL), rode:
<code>curl -fsSL https://raw.githubusercontent.com/marcusedu/plim/main/install.sh | bash</code>

Ou instale e conecte em 1 linha só:
<code>curl -fsSL https://raw.githubusercontent.com/marcusedu/plim/main/install.sh | bash -s -- ${token}</code>

<b>Executar direto via NPM / NPX (Sem instalação):</b>
<code>npx plim-mcp</code>`,
  },
  status: {
    en: (plan: string, usage: number, limit: number | string, token: string) => `📊 <b>Your Plim Account Status</b>

👤 <b>Plan:</b> ${plan === 'pro' ? '⭐ PRO (Unlimited)' : '🆓 Free (50/day)'}
📬 <b>Today usage:</b> ${usage} of ${plan === 'pro' ? '∞' : limit} notifications
🔑 <b>Your Token:</b> <code>${token}</code>

To connect on another computer:
<code>plim connect ${token}</code>`,
    pt: (plan: string, usage: number, limit: number | string, token: string) => `📊 <b>Status da sua conta Plim</b>

👤 <b>Plano:</b> ${plan === 'pro' ? '⭐ PRO (Ilimitado)' : '🆓 Gratuito (50/dia)'}
📬 <b>Uso hoje:</b> ${usage} de ${plan === 'pro' ? '∞' : limit} notificações
🔑 <b>Seu Token:</b> <code>${token}</code>

Para conectar em outro computador:
<code>plim connect ${token}</code>`,
  },
  proBenefits: {
    en: (stars: number) => `⭐ <b>Plim PRO Plan (Lifetime Access)</b>

Eliminate limits and supercharge your developer workflow:
✅ <b>Unlimited notifications</b> (no daily cap)
✅ Priority message alerts in delivery queue
✅ Expanded logs summary on Telegram
✅ Support open-source development

<b>Price:</b> ${stars} ⭐ Telegram Stars (one-time purchase via Apple Pay, Google Pay or Card inside Telegram).`,
    pt: (stars: number) => `⭐ <b>Plano Plim PRO (Acesso Vitalício)</b>

Elimine limites e turbine seu fluxo de desenvolvimento:
✅ <b>Notificações ilimitadas</b> (sem teto diário)
✅ Alertas prioritários na fila de mensagens
✅ Resumo de logs expandido no Telegram
✅ Apoie o projeto open-source

<b>Valor:</b> ${stars} ⭐ Telegram Stars (pagamento único via Apple Pay, Google Pay ou Cartão direto no Telegram).`,
  },
  proInvoiceTitle: {
    en: 'Plim PRO (Lifetime Access)',
    pt: 'Plim PRO (Acesso Vitalício)',
  },
  proInvoiceDesc: {
    en: 'Unlimited daily notifications and priority alerts for your terminal.',
    pt: 'Notificações diárias ilimitadas e alertas prioritários no seu terminal.',
  },
  proAlready: {
    en: `⭐ <b>You are already a Plim PRO user!</b>\n\nYour access is lifetime with unlimited notifications.`,
    pt: `⭐ <b>Você já é um usuário Plim PRO!</b>\n\nSeu acesso é vitalício e você tem notificações ilimitadas.`,
  },
  proSuccess: {
    en: `🎉 <b>CONGRATULATIONS! YOU ARE NOW PLIM PRO!</b> ⭐

Your account has been upgraded:
• <b>Unlimited</b> daily notifications
• Priority alerts for deploys and builds
• Lifetime access

Thank you for supporting Plim! 🚀`,
    pt: `🎉 <b>PARABÉNS! VOCÊ AGORA É PLIM PRO!</b> ⭐

O seu plano foi atualizado com sucesso:
• Notificações diárias <b>ilimitadas</b>
• Alertas prioritários para deploys e builds
• Acesso vitalício

Obrigado por apoiar o desenvolvimento do Plim! 🚀`,
  },
  connected: {
    en: `🎉 <b>Terminal Connected Successfully!</b>\n\nYour Plim is configured and ready to notify!\nTry running:\n<code>plim run sleep 2 &amp;&amp; echo "Deploy finished!"</code>`,
    pt: `🎉 <b>Terminal Conectado com Sucesso!</b>\n\nO seu Plim está configurado e pronto para uso!\nTente rodar:\n<code>plim run sleep 2 &amp;&amp; echo "Deploy finalizado!"</code>`,
  },
  quotaLimit: {
    en: (limit: number) => `⚠️ <b>Daily limit reached (${limit} notifications)</b>\n\nYou have reached your free daily quota. Send /pro to upgrade to the Unlimited plan!`,
    pt: (limit: number) => `⚠️ <b>Limite diário atingido (${limit} notificações)</b>\n\nVocê atingiu sua cota gratuita por hoje. Envie /pro para fazer o upgrade para o plano Ilimitado!`,
  },
  resetToken: {
    en: (token: string) => `🔑 <b>New token generated!</b>\n\nUpdate your terminal with:\n<code>plim connect ${token}</code>`,
    pt: (token: string) => `🔑 <b>Novo token gerado!</b>\n\nAtualize seu terminal com:\n<code>plim connect ${token}</code>`,
  },
  help: {
    en: `📖 <b>Plim User Guide</b>

<b>In your Terminal:</b>
• <code>plim run &lt;command&gt;</code>
  Runs command, times duration, plays desktop audio, and sends result to Telegram.
  <i>Example:</i> <code>plim run npm run build</code>

• <code>plim ask "Question" [options]</code>
  Interactive confirmation with inline buttons sent to your phone.

• <code>plim -n "Message"</code>
  Quick push notification with desktop alert.

• <code>command | plim -n "Deploy"</code>
  Pipes output to terminal and appends last lines to Telegram.

• <code>plim test</code>
  Test local sound and mobile notification.

<b>Bot Commands:</b>
/start - Setup & token
/install - Install instructions
/status - View quota & token
/pro - Upgrade to Unlimited PRO ⭐
/lang - Switch language (en / pt)
/resettoken - Generate new API token`,
    pt: `📖 <b>Guia de Uso do Plim</b>

<b>No seu Terminal:</b>
• <code>plim run &lt;comando&gt;</code>
  Executa o comando, cronometra a duração, toca som no Mac e envia o resultado no Telegram.
  <i>Exemplo:</i> <code>plim run npm run build</code>

• <code>plim ask "Pergunta" [opções]</code>
  Pergunta interativa com botões enviada para o seu celular.

• <code>plim -n "Mensagem"</code>
  Envia notificação rápida com som.

• <code>comando | plim -n "Deploy"</code>
  Lê a saída do terminal e anexa as últimas linhas no Telegram.

• <code>plim test</code>
  Testa o som local e o envio para o celular.

<b>Comandos do Bot:</b>
/start - Iniciar e ver seu token
/install - Como instalar no terminal
/status - Ver limites e notificações de hoje
/pro - Upgrade para Plano Pro ⭐
/lang - Alterar idioma (en / pt)
/resettoken - Gerar nova chave de API`,
  },
  retryButtons: {
    en: { retry: '🔁 Retry Execution', cancel: '🛑 Cancel' },
    pt: { retry: '🔁 Repetir Execução', cancel: '🛑 Cancelar' },
  },
  askAnswered: {
    en: (q: string, a: string) => `❓ <b>Plim Agent Question:</b>\n${escapeHtml(q)}\n\n✅ <b>Answered:</b> <code>${escapeHtml(a)}</code>`,
    pt: (q: string, a: string) => `❓ <b>Pergunta do Agente Plim:</b>\n${escapeHtml(q)}\n\n✅ <b>Respondido:</b> <code>${escapeHtml(a)}</code>`,
  },
  retryAnswered: {
    en: (cmd: string, retry: boolean) => `⚠️ <b>Failed Command:</b>\n<code>${escapeHtml(cmd)}</code>\n\n${retry ? '🔁 <b>Retry requested!</b>' : '🛑 <b>Execution canceled/ignored.</b>'}`,
    pt: (cmd: string, retry: boolean) => `⚠️ <b>Comando com Falha:</b>\n<code>${escapeHtml(cmd)}</code>\n\n${retry ? '🔁 <b>Solicitada repetição da execução!</b>' : '🛑 <b>Execução cancelada/ignorada.</b>'}`,
  },
  callbackAnswered: {
    en: 'This action was already answered!',
    pt: 'Esta ação já foi respondida!',
  },
  callbackExpired: {
    en: 'Question expired or not found.',
    pt: 'Pergunta expirada ou inexistente.',
  },
};

// ---------------------------------------------------------------------------
// 1. Healthcheck & Setup de Comandos
// ---------------------------------------------------------------------------
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Plim API & Telegram Worker',
    version: '1.4.1',
    docs: 'https://github.com/marcusedu/plim',
  });
});

// Endpoint para registrar os comandos no menu oficial do Telegram
app.get('/setup-commands', async (c) => {
  const botToken = c.env.TELEGRAM_BOT_TOKEN;
  const commands = [
    { command: 'start', description: 'Connect terminal / setup Plim' },
    { command: 'install', description: 'How to install Plim CLI & MCP' },
    { command: 'status', description: 'View quota and active token' },
    { command: 'pro', description: 'Upgrade to Plim PRO ⭐ (Unlimited)' },
    { command: 'lang', description: 'Change language / Alterar idioma' },
    { command: 'help', description: 'Terminal usage guide' },
    { command: 'resettoken', description: 'Generate a new API key' },
  ];

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });

  return c.json(await res.json());
});

// ---------------------------------------------------------------------------
// 2. Webhook do Telegram (Recebe mensagens, pagamentos e eventos)
// ---------------------------------------------------------------------------
app.post('/webhook', async (c) => {
  const secretHeader = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (c.env.WEBHOOK_SECRET && secretHeader !== c.env.WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401);
  }

  const update = await c.req.json<any>();
  const botToken = c.env.TELEGRAM_BOT_TOKEN;

  // 1. Tratamento de Pré-Checkout de Pagamento (Telegram Stars)
  if (update?.pre_checkout_query) {
    const preCheckoutId = update.pre_checkout_query.id;
    await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pre_checkout_query_id: preCheckoutId,
        ok: true,
      }),
    });
    return c.json({ ok: true });
  }

  // 2. Tratamento de Callback Query (Botões Inline / Perguntas Interativas & Retry)
  if (update?.callback_query) {
    const cb = update.callback_query;
    const data: string = cb.data || '';
    const fromId = cb.from?.id;
    const msgId = cb.message?.message_id;

    if (data.startsWith('ask:') || data.startsWith('retry:')) {
      const parts = data.split(':');
      const action = parts[0];
      const askId = parts[1];
      const choice = parts[2];

      const recordStr = await c.env.PLIM_KV.get(`ask:${askId}`);
      if (recordStr) {
        const record: AskRecord = JSON.parse(recordStr);
        const lang: SupportedLang = record.lang || 'en';
        if (record.status === 'pending') {
          let selectedText = '';
          if (action === 'ask') {
            const optIdx = parseInt(choice, 10);
            selectedText = record.options[optIdx] ?? choice;
            record.status = 'answered';
            record.answer = selectedText;
            record.answerIndex = optIdx;
          } else if (action === 'retry') {
            record.status = 'answered';
            record.answer = choice; // 'retry' | 'cancel'
            selectedText = choice === 'retry' ? MESSAGES.retryButtons[lang].retry : MESSAGES.retryButtons[lang].cancel;
          }

          // Salva no KV por 1 hora
          await c.env.PLIM_KV.put(`ask:${askId}`, JSON.stringify(record), { expirationTtl: 3600 });

          // Confirma o callback para remover o loading no Telegram
          const optLabel = lang === 'pt' ? `Opção selecionada: ${selectedText}` : `Option selected: ${selectedText}`;
          await answerTelegramCallbackQuery(botToken, cb.id, optLabel);

          // Edita a mensagem removendo os botões inline e exibindo o status final
          let updatedText = '';
          if (action === 'ask') {
            updatedText = MESSAGES.askAnswered[lang](record.question, selectedText);
          } else {
            updatedText = MESSAGES.retryAnswered[lang](record.command || '', choice === 'retry');
          }

          if (fromId && msgId) {
            await editTelegramMessageText(botToken, fromId, msgId, updatedText);
          }
          return c.json({ ok: true });
        } else {
          await answerTelegramCallbackQuery(botToken, cb.id, MESSAGES.callbackAnswered[lang]);
          return c.json({ ok: true });
        }
      } else {
        await answerTelegramCallbackQuery(botToken, cb.id, 'Question expired or not found.');
        return c.json({ ok: true });
      }
    }

    await answerTelegramCallbackQuery(botToken, cb.id);
    return c.json({ ok: true });
  }

  const message = update?.message;
  if (!message) {
    return c.json({ ok: true });
  }

  const chatId = message.chat.id;
  const userLangCode = message.from?.language_code;

  // 2. Tratamento de Pagamento Concluído com Sucesso
  if (message.successful_payment) {
    let userStr = await c.env.PLIM_KV.get(`user:${chatId}`);
    let user: UserRecord | null = userStr ? JSON.parse(userStr) : null;
    if (user) {
      user.plan = 'pro';
      user.upgradedAt = Date.now();
      await c.env.PLIM_KV.put(`user:${chatId}`, JSON.stringify(user));
    }

    const lang = getLang(user, userLangCode);
    await sendTelegramMessage(botToken, chatId, MESSAGES.proSuccess[lang]);

    // Notifica o administrador sobre a nova assinatura PRO
    const adminChatId = c.env.ADMIN_CHAT_ID ? parseInt(c.env.ADMIN_CHAT_ID, 10) : 517936688;
    if (adminChatId) {
      const name = user?.firstName || message.from?.first_name || 'Anônimo';
      const handle = (user?.username || message.from?.username) ? `@${user?.username || message.from?.username}` : `ID: ${chatId}`;
      const amount = message.successful_payment.total_amount;
      const currency = message.successful_payment.currency;

      const adminProMsg = `⭐ <b>NOVA ASSINATURA PLIM PRO!</b> 💰🎉\n\n👤 <b>Usuário:</b> ${escapeHtml(name)} (${escapeHtml(handle)})\n🆔 <b>Chat ID:</b> <code>${chatId}</code>\n⭐ <b>Valor:</b> ${amount} ${currency}\n📅 <b>Data:</b> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

      await sendTelegramMessage(botToken, adminChatId, adminProMsg);
    }

    return c.json({ ok: true });
  }

  const text = message.text ? message.text.trim() : '';
  if (!text) {
    return c.json({ ok: true });
  }

  // Helper para buscar ou criar usuário
  async function getOrCreateUser(): Promise<UserRecord> {
    let userStr = await c.env.PLIM_KV.get(`user:${chatId}`);
    if (userStr) {
      return JSON.parse(userStr);
    }
    const token = `plim_live_${crypto.randomUUID().replace(/-/g, '')}`;
    const userLang = message.from?.language_code?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
    const newUser: UserRecord = {
      chatId,
      token,
      username: message.from?.username,
      firstName: message.from?.first_name,
      plan: 'free',
      createdAt: Date.now(),
      lang: userLang,
    };
    await c.env.PLIM_KV.put(`user:${chatId}`, JSON.stringify(newUser));
    await c.env.PLIM_KV.put(`token:${token}`, chatId.toString());

    // Notifica o administrador que um novo usuário aderiu ao bot no Telegram
    const adminChatId = c.env.ADMIN_CHAT_ID ? parseInt(c.env.ADMIN_CHAT_ID, 10) : 517936688;
    if (adminChatId) {
      const name = newUser.firstName || 'Anônimo';
      const handle = newUser.username ? `@${newUser.username}` : `ID: ${chatId}`;
      const langBadge = userLang === 'pt' ? '🇧🇷 PT' : '🌐 EN';
      const adminNotice = `👋 <b>Novo Usuário Aderiu ao Plim!</b> [${langBadge}]\n\n👤 <b>Nome:</b> ${escapeHtml(name)}\n📱 <b>Usuário:</b> ${escapeHtml(handle)}\n🆔 <b>Chat ID:</b> <code>${chatId}</code>\n🔑 <b>Token:</b> <code>${token}</code>\n📅 <b>Data:</b> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
      await sendTelegramMessage(botToken, adminChatId, adminNotice);
    }

    return newUser;
  }

  // Comando /lang [en|pt]
  if (text.startsWith('/lang') || text.startsWith('/language') || text.startsWith('/idioma')) {
    const user = await getOrCreateUser();
    const parts = text.split(/\s+/);
    const chosenLang = parts[1]?.toLowerCase();

    if (chosenLang === 'en' || chosenLang === 'pt') {
      user.lang = chosenLang;
      await c.env.PLIM_KV.put(`user:${chatId}`, JSON.stringify(user));
      const msg = chosenLang === 'en'
        ? '🌐 <b>Language updated to English!</b>'
        : '🌐 <b>Idioma alterado para Português!</b>';
      await sendTelegramMessage(botToken, chatId, msg);
      return c.json({ ok: true });
    }

    const currentLang = getLang(user, userLangCode);
    const promptMsg = currentLang === 'en'
      ? `🌐 <b>Current Language:</b> English\n\nTo switch language, send:\n• <code>/lang en</code> - English\n• <code>/lang pt</code> - Português`
      : `🌐 <b>Idioma Atual:</b> Português\n\nPara alterar o idioma, envie:\n• <code>/lang en</code> - English\n• <code>/lang pt</code> - Português`;
    await sendTelegramMessage(botToken, chatId, promptMsg);
    return c.json({ ok: true });
  }

  // Comando /start
  if (text.startsWith('/start')) {
    const user = await getOrCreateUser();
    const lang = getLang(user, userLangCode);
    await sendTelegramMessage(botToken, chatId, MESSAGES.welcome[lang](user.token));
    return c.json({ ok: true });
  }

  // Comando /install
  if (text.startsWith('/install') || text.startsWith('/instalar')) {
    const user = await getOrCreateUser();
    const lang = getLang(user, userLangCode);
    await sendTelegramMessage(botToken, chatId, MESSAGES.install[lang](user.token));
    return c.json({ ok: true });
  }

  // Comando /status
  if (text.startsWith('/status')) {
    const user = await getOrCreateUser();
    const lang = getLang(user, userLangCode);
    const today = getTodayKey();
    const usageStr = await c.env.PLIM_KV.get(`usage:${chatId}:${today}`);
    const usage = usageStr ? parseInt(usageStr, 10) : 0;
    const limit = user.plan === 'pro'
      ? parseInt(c.env.PRO_TIER_DAILY_LIMIT || '5000', 10)
      : parseInt(c.env.FREE_TIER_DAILY_LIMIT || '50', 10);

    await sendTelegramMessage(botToken, chatId, MESSAGES.status[lang](user.plan, usage, limit, user.token));
    return c.json({ ok: true });
  }

  // Comando /pro ou /upgrade (Fatura com Telegram Stars)
  if (text.startsWith('/pro') || text.startsWith('/upgrade') || text.startsWith('/comprar')) {
    const user = await getOrCreateUser();
    const lang = getLang(user, userLangCode);

    if (user.plan === 'pro') {
      await sendTelegramMessage(botToken, chatId, MESSAGES.proAlready[lang]);
      return c.json({ ok: true });
    }

    const starsAmount = parseInt(c.env.PRO_PRICE_STARS || '150', 10); // Padrão: 150 Telegram Stars (~$2.99)
    await sendTelegramMessage(botToken, chatId, MESSAGES.proBenefits[lang](starsAmount));

    // Envia a fatura nativa do Telegram Stars
    await sendTelegramInvoice(
      botToken,
      chatId,
      MESSAGES.proInvoiceTitle[lang],
      MESSAGES.proInvoiceDesc[lang],
      `upgrade_${chatId}_${Date.now()}`,
      starsAmount
    );

    return c.json({ ok: true });
  }

  // Comando /resettoken
  if (text.startsWith('/resettoken')) {
    const user = await getOrCreateUser();
    const lang = getLang(user, userLangCode);
    await c.env.PLIM_KV.delete(`token:${user.token}`);

    const newToken = `plim_live_${crypto.randomUUID().replace(/-/g, '')}`;
    user.token = newToken;
    await c.env.PLIM_KV.put(`user:${chatId}`, JSON.stringify(user));
    await c.env.PLIM_KV.put(`token:${newToken}`, chatId.toString());

    await sendTelegramMessage(botToken, chatId, MESSAGES.resetToken[lang](newToken));
    return c.json({ ok: true });
  }

  // Comando /help
  if (text.startsWith('/help') || text.startsWith('/ajuda')) {
    const user = await getOrCreateUser();
    const lang = getLang(user, userLangCode);
    await sendTelegramMessage(botToken, chatId, MESSAGES.help[lang]);
    return c.json({ ok: true });
  }

  // Comando /admin (Apenas para o criador do bot)
  if (text.startsWith('/admin')) {
    const adminId = c.env.ADMIN_CHAT_ID ? parseInt(c.env.ADMIN_CHAT_ID, 10) : 517936688;
    if (chatId !== adminId) {
      await sendTelegramMessage(botToken, chatId, '⛔ Acesso reservado ao administrador.');
      return c.json({ ok: true });
    }

    const userList = await c.env.PLIM_KV.list({ prefix: 'user:' });
    const totalUsers = userList.keys.length;

    let proUsers = 0;
    const userPreviews: string[] = [];

    for (const key of userList.keys.slice(0, 30)) {
      const uStr = await c.env.PLIM_KV.get(key.name);
      if (uStr) {
        const u: UserRecord = JSON.parse(uStr);
        if (u.plan === 'pro') proUsers++;
        const name = u.firstName || 'Anônimo';
        const handle = u.username ? `@${u.username}` : `ID ${u.chatId}`;
        const planBadge = u.plan === 'pro' ? '⭐' : '🆓';
        userPreviews.push(`${planBadge} ${name} (${handle})`);
      }
    }

    const today = getTodayKey();
    const usageList = await c.env.PLIM_KV.list({ prefix: 'usage:' });
    let todayTotalNotifs = 0;
    for (const key of usageList.keys) {
      if (key.name.includes(today)) {
        const countStr = await c.env.PLIM_KV.get(key.name);
        todayTotalNotifs += countStr ? parseInt(countStr, 10) : 0;
      }
    }

    const statsMsg = `👑 <b>Painel de Métricas do Plim</b>

👥 <b>Total de Usuários:</b> ${totalUsers}
⭐ <b>Usuários PRO:</b> ${proUsers}
🆓 <b>Usuários Free:</b> ${totalUsers - proUsers}
📬 <b>Notificações enviadas hoje:</b> ${todayTotalNotifs}

<b>Últimos usuários cadastrados:</b>
${userPreviews.slice(0, 8).join('\n') || 'Nenhum usuário cadastrado ainda.'}`;

    await sendTelegramMessage(botToken, chatId, statsMsg);
    return c.json({ ok: true });
  }

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// 3. API para o CLI (plim connect & plim notify)
// ---------------------------------------------------------------------------

// POST /api/notify - Chamado pelo plim run e plim -n
app.post('/api/notify', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Token ausente. Use Authorization: Bearer <plim_token>' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const chatIdStr = await c.env.PLIM_KV.get(`token:${token}`);
  if (!chatIdStr) {
    return c.json({ error: 'Token inválido ou não encontrado. Obtenha um novo em @plim_the_bot' }, 401);
  }

  const chatId = parseInt(chatIdStr, 10);
  const userStr = await c.env.PLIM_KV.get(`user:${chatId}`);
  const user: UserRecord = userStr ? JSON.parse(userStr) : { plan: 'free' } as any;

  // Verificação de cota diária
  const today = getTodayKey();
  const usageKey = `usage:${chatId}:${today}`;
  const currentUsageStr = await c.env.PLIM_KV.get(usageKey);
  const currentUsage = currentUsageStr ? parseInt(currentUsageStr, 10) : 0;

  const limit = user.plan === 'pro'
    ? parseInt(c.env.PRO_TIER_DAILY_LIMIT || '5000', 10)
    : parseInt(c.env.FREE_TIER_DAILY_LIMIT || '50', 10);

  const lang = getLang(user, null);

  if (currentUsage >= limit) {
    if (currentUsage === limit) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        chatId,
        MESSAGES.quotaLimit[lang](limit)
      );
    }
    return c.json({ error: 'Limite diário de notificações excedido.', usage: currentUsage, limit }, 429);
  }

  // Incrementa uso diário com TTL de 2 dias (172800s)
  await c.env.PLIM_KV.put(usageKey, (currentUsage + 1).toString(), { expirationTtl: 172800 });

  // Processa o corpo da mensagem
  const payload = await c.req.json<{
    title?: string;
    body?: string;
    log?: string;
    status?: 'success' | 'error' | 'info';
    duration?: string;
  }>();

  let formattedText = `<b>${payload.title || '🔔 Plim'}</b>`;
  if (payload.body) {
    formattedText += `\n${escapeHtml(payload.body)}`;
  }
  if (payload.duration) {
    const durLabel = lang === 'pt' ? 'Duração:' : 'Duration:';
    formattedText += `\n⏱ <b>${durLabel}</b> ${payload.duration}`;
  }
  if (payload.log) {
    let safeLog = escapeHtml(payload.log);
    if (safeLog.length > 3500) {
      safeLog = safeLog.slice(-3500);
    }
    formattedText += `\n\n<pre>${safeLog}</pre>`;
  }

  const tgRes = await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, formattedText);

  return c.json({
    ok: true,
    usage: currentUsage + 1,
    limit,
    telegramStatus: tgRes.ok,
  });
});

// POST /api/connect - Chamado por 'plim connect <token>'
app.post('/api/connect', async (c) => {
  const body = await c.req.json<{ token: string }>();
  if (!body.token) {
    return c.json({ error: 'Token obrigatório' }, 400);
  }

  const chatIdStr = await c.env.PLIM_KV.get(`token:${body.token}`);
  if (!chatIdStr) {
    return c.json({ error: 'Token não encontrado. Obtenha um novo em @plim_the_bot' }, 404);
  }

  const chatId = parseInt(chatIdStr, 10);
  let userStr = await c.env.PLIM_KV.get(`user:${chatId}`);
  let user: UserRecord | null = userStr ? JSON.parse(userStr) : null;
  const isFirstConnection = !user?.connectedAt;

  if (user) {
    user.connectedAt = Date.now();
    await c.env.PLIM_KV.put(`user:${chatId}`, JSON.stringify(user));
  }

  const lang = getLang(user, null);
  await sendTelegramMessage(
    c.env.TELEGRAM_BOT_TOKEN,
    chatId,
    MESSAGES.connected[lang]
  );

  // Notifica o administrador que o usuário configurou o terminal com sucesso
  const adminChatId = c.env.ADMIN_CHAT_ID ? parseInt(c.env.ADMIN_CHAT_ID, 10) : 517936688;
  if (adminChatId) {
    const name = user?.firstName || 'Anônimo';
    const handle = user?.username ? `@${user.username}` : `ID: ${chatId}`;
    const statusBadge = isFirstConnection ? '🟢 Primeira Configuração' : '🔄 Reconexão';
    const langBadge = lang === 'pt' ? '🇧🇷 PT' : '🌐 EN';
    const adminMsg = `💻 <b>Terminal Configurado com Sucesso!</b> [${langBadge}]\n\n${statusBadge}\n👤 <b>Usuário:</b> ${escapeHtml(name)} (${escapeHtml(handle)})\n🆔 <b>Chat ID:</b> <code>${chatId}</code>\n🔑 <b>Token:</b> <code>${body.token}</code>\n📅 <b>Data:</b> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

    await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, adminChatId, adminMsg);
  }

  return c.json({ ok: true, message: 'Terminal conectado com sucesso!' });
});

// ---------------------------------------------------------------------------
// 4. API de Perguntas Interativas e Retry (plim_ask / retry)
// ---------------------------------------------------------------------------

// POST /api/ask - Dispara pergunta interativa com botões inline no Telegram
app.post('/api/ask', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Token ausente. Use Authorization: Bearer <plim_token>' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const chatIdStr = await c.env.PLIM_KV.get(`token:${token}`);
  if (!chatIdStr) {
    return c.json({ error: 'Token inválido ou não encontrado.' }, 401);
  }

  const chatId = parseInt(chatIdStr, 10);
  const userStr = await c.env.PLIM_KV.get(`user:${chatId}`);
  const user: UserRecord | null = userStr ? JSON.parse(userStr) : null;
  const lang = getLang(user, null);

  const payload = await c.req.json<{
    question?: string;
    options?: string[];
    type?: 'question' | 'retry';
    command?: string;
  }>();

  if (!payload.question && !payload.command) {
    return c.json({ error: 'Parâmetro question ou command é obrigatório.' }, 400);
  }

  const askId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const isRetry = payload.type === 'retry';
  const defaultOpts = lang === 'pt' ? ['Sim', 'Não'] : ['Yes', 'No'];
  const options = payload.options && payload.options.length > 0 ? payload.options : defaultOpts;
  const retryOpts = [MESSAGES.retryButtons[lang].retry, MESSAGES.retryButtons[lang].cancel];

  const record: AskRecord = {
    id: askId,
    chatId,
    question: payload.question || (lang === 'pt' ? `O comando falhou: ${payload.command}` : `Command failed: ${payload.command}`),
    options: isRetry ? retryOpts : options,
    status: 'pending',
    createdAt: Date.now(),
    type: isRetry ? 'retry' : 'question',
    command: payload.command,
    lang,
  };

  // Monta teclado inline
  let inlineKeyboard: any[][] = [];
  if (isRetry) {
    inlineKeyboard = [
      [
        { text: MESSAGES.retryButtons[lang].retry, callback_data: `retry:${askId}:retry` },
        { text: MESSAGES.retryButtons[lang].cancel, callback_data: `retry:${askId}:cancel` },
      ],
    ];
  } else {
    // Organiza botões: se tiverem mais de 14 chars ou mais de 4 opções, 1 por linha; senão 2 por linha
    const rowLimit = options.some((opt) => opt.length > 14) || options.length > 4 ? 1 : 2;
    let currentRow: any[] = [];
    for (let i = 0; i < options.length; i++) {
      currentRow.push({
        text: options[i],
        callback_data: `ask:${askId}:${i}`,
      });
      if (currentRow.length >= rowLimit) {
        inlineKeyboard.push(currentRow);
        currentRow = [];
      }
    }
    if (currentRow.length > 0) {
      inlineKeyboard.push(currentRow);
    }
  }

  let messageText = '';
  if (isRetry) {
    messageText = lang === 'pt'
      ? `⚠️ <b>Comando com Falha no Terminal:</b>\n<code>${escapeHtml(payload.command || '')}</code>\n\n<i>Deseja tentar executar novamente agora?</i>`
      : `⚠️ <b>Command Failed in Terminal:</b>\n<code>${escapeHtml(payload.command || '')}</code>\n\n<i>Do you want to retry execution now?</i>`;
  } else {
    messageText = lang === 'pt'
      ? `❓ <b>Pergunta do Agente Plim:</b>\n\n${escapeHtml(payload.question || '')}\n\n<i>Selecione uma opção abaixo:</i>`
      : `❓ <b>Plim Agent Question:</b>\n\n${escapeHtml(payload.question || '')}\n\n<i>Select an option below:</i>`;
  }

  const tgRes = await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, messageText, {
    reply_markup: { inline_keyboard: inlineKeyboard },
  });

  if (tgRes?.result?.message_id) {
    record.messageId = tgRes.result.message_id;
  }

  // TTL de 15 minutos (900s)
  await c.env.PLIM_KV.put(`ask:${askId}`, JSON.stringify(record), { expirationTtl: 900 });

  return c.json({
    ok: true,
    id: askId,
    status: 'pending',
    messageId: record.messageId,
  });
});

// GET /api/ask/:id - Consulta o status de uma pergunta ou pedido de retry
app.get('/api/ask/:id', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Token ausente.' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const chatIdStr = await c.env.PLIM_KV.get(`token:${token}`);
  if (!chatIdStr) {
    return c.json({ error: 'Token inválido.' }, 401);
  }

  const id = c.req.param('id');
  const recordStr = await c.env.PLIM_KV.get(`ask:${id}`);
  if (!recordStr) {
    return c.json({ ok: false, error: 'Pergunta não encontrada ou expirada.' }, 404);
  }

  const record: AskRecord = JSON.parse(recordStr);
  return c.json({
    ok: true,
    id: record.id,
    status: record.status,
    answer: record.answer,
    answerIndex: record.answerIndex,
    createdAt: record.createdAt,
    type: record.type,
    command: record.command,
  });
});

function formatDurationSec(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
}

function renderProgressMessage(record: ProgressRecord): string {
  const lang = record.lang || 'pt';
  const icon = record.status === 'success' ? '✅' : record.status === 'error' ? '❌' : '🔄';

  const totalBlocks = 16;
  const pct = Math.min(Math.max(record.percent || 0, 0), 100);
  const filledBlocks = Math.round((pct / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  let header = '';
  if (record.status === 'success') {
    header = `<b>${icon} ${record.title} [${lang === 'pt' ? 'Concluído' : 'Completed'}]</b>`;
  } else if (record.status === 'error') {
    header = `<b>${icon} ${record.title} [${lang === 'pt' ? 'Falha' : 'Failed'}]</b>`;
  } else {
    header = `<b>${icon} ${record.title} [${pct}%]</b>`;
  }

  let text = `${header}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n<code>[${bar}] ${pct}%</code>\n`;

  if (record.steps && record.steps.length > 0) {
    text += '\n';
    for (const step of record.steps) {
      let stepIcon = '◻️';
      if (step.status === 'done') stepIcon = '✅';
      else if (step.status === 'active') stepIcon = '⏳';
      else if (step.status === 'failed') stepIcon = '❌';

      text += `${stepIcon} ${step.label}\n`;
    }
  }

  if (record.statusText) {
    text += `\n<i>${record.statusText}</i>\n`;
  }

  const elapsedSec = Math.round((Date.now() - record.startedAt) / 1000);
  const durStr = record.duration || formatDurationSec(elapsedSec);
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⏱️ ${lang === 'pt' ? 'Duração' : 'Duration'}: <b>${durStr}</b>`;

  return text;
}

// ---------------------------------------------------------------------------
// 5. API de Mensagens de Progresso Dinâmico (/api/progress/*)
// ---------------------------------------------------------------------------

// POST /api/progress/start - Inicia um painel de progresso com mensagem única editável
app.post('/api/progress/start', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Token ausente.' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const chatIdStr = await c.env.PLIM_KV.get(`token:${token}`);
  if (!chatIdStr) {
    return c.json({ error: 'Token inválido ou não encontrado.' }, 401);
  }

  const chatId = parseInt(chatIdStr, 10);
  const userStr = await c.env.PLIM_KV.get(`user:${chatId}`);
  const user: UserRecord | null = userStr ? JSON.parse(userStr) : null;
  const lang = getLang(user, null);

  const payload = await c.req.json<{
    title?: string;
    steps?: Array<string | ProgressStep>;
    totalSteps?: number;
    text?: string;
    percent?: number;
  }>();

  const progId = 'prog_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  const parsedSteps: ProgressStep[] = [];
  if (Array.isArray(payload.steps)) {
    payload.steps.forEach((s, idx) => {
      if (typeof s === 'string') {
        parsedSteps.push({
          label: s,
          status: idx === 0 ? 'active' : 'pending',
        });
      } else if (s && typeof s === 'object') {
        parsedSteps.push({
          label: s.label || `Passo ${idx + 1}`,
          status: s.status || (idx === 0 ? 'active' : 'pending'),
        });
      }
    });
  }

  const record: ProgressRecord = {
    id: progId,
    chatId,
    messageId: 0,
    title: payload.title || (lang === 'pt' ? 'Execução em Progresso' : 'Execution in Progress'),
    percent: payload.percent || 0,
    status: 'running',
    statusText: payload.text,
    steps: parsedSteps,
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    lang,
  };

  const initialMsg = renderProgressMessage(record);
  const tgRes = await sendTelegramMessage(c.env.TELEGRAM_BOT_TOKEN, chatId, initialMsg);

  if (!tgRes.ok || !tgRes.result?.message_id) {
    return c.json({ error: 'Falha ao despachar mensagem para o Telegram.', details: tgRes }, 502);
  }

  record.messageId = tgRes.result.message_id;
  await c.env.PLIM_KV.put(`progress:${progId}`, JSON.stringify(record), { expirationTtl: 7200 });

  return c.json({ ok: true, id: progId, messageId: record.messageId });
});

// POST /api/progress/update - Atualiza a mensagem existente sem poluir o chat
app.post('/api/progress/update', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Token ausente.' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const chatIdStr = await c.env.PLIM_KV.get(`token:${token}`);
  if (!chatIdStr) {
    return c.json({ error: 'Token inválido.' }, 401);
  }

  const payload = await c.req.json<{
    id: string;
    percent?: number;
    step?: number;
    totalSteps?: number;
    text?: string;
    steps?: ProgressStep[];
  }>();

  if (!payload.id) {
    return c.json({ error: 'Parâmetro id é obrigatório.' }, 400);
  }

  const recordStr = await c.env.PLIM_KV.get(`progress:${payload.id}`);
  if (!recordStr) {
    return c.json({ error: 'Sessão de progresso não encontrada ou expirada.' }, 404);
  }

  const record: ProgressRecord = JSON.parse(recordStr);

  if (payload.text !== undefined) record.statusText = payload.text;
  if (Array.isArray(payload.steps)) record.steps = payload.steps;

  if (payload.step && record.steps && record.steps.length > 0) {
    const activeIdx = payload.step - 1;
    record.steps = record.steps.map((st, idx) => {
      if (idx < activeIdx) return { ...st, status: 'done' as const };
      if (idx === activeIdx) return { ...st, status: 'active' as const };
      return { ...st, status: 'pending' as const };
    });
  }

  if (payload.percent !== undefined) {
    record.percent = Math.min(Math.max(payload.percent, 0), 100);
  } else if (payload.step && payload.totalSteps) {
    record.percent = Math.round(((payload.step - 1) / payload.totalSteps) * 100);
  } else if (payload.step && record.steps && record.steps.length > 0) {
    record.percent = Math.round(((payload.step - 1) / record.steps.length) * 100);
  }

  record.lastUpdatedAt = Date.now();
  const updatedMsg = renderProgressMessage(record);

  // Edita a mensagem no Telegram
  await editTelegramMessageText(c.env.TELEGRAM_BOT_TOKEN, record.chatId, record.messageId, updatedMsg);
  await c.env.PLIM_KV.put(`progress:${payload.id}`, JSON.stringify(record), { expirationTtl: 7200 });

  return c.json({ ok: true, id: record.id, percent: record.percent });
});

// POST /api/progress/finish - Finaliza a mensagem com status de sucesso ou erro
app.post('/api/progress/finish', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Token ausente.' }, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const chatIdStr = await c.env.PLIM_KV.get(`token:${token}`);
  if (!chatIdStr) {
    return c.json({ error: 'Token inválido.' }, 401);
  }

  const payload = await c.req.json<{
    id: string;
    status?: 'success' | 'error';
    text?: string;
    duration?: string;
    steps?: ProgressStep[];
  }>();

  if (!payload.id) {
    return c.json({ error: 'Parâmetro id é obrigatório.' }, 400);
  }

  const recordStr = await c.env.PLIM_KV.get(`progress:${payload.id}`);
  if (!recordStr) {
    return c.json({ error: 'Sessão de progresso não encontrada ou expirada.' }, 404);
  }

  const record: ProgressRecord = JSON.parse(recordStr);

  record.status = payload.status === 'error' ? 'error' : 'success';
  if (record.status === 'success') {
    record.percent = 100;
    if (record.steps) {
      record.steps = record.steps.map(st => ({ ...st, status: 'done' as const }));
    }
  } else {
    // Se falhou e tem passos, o último ativo vira failed e os restantes pending
    if (record.steps) {
      let foundActive = false;
      record.steps = record.steps.map(st => {
        if (!foundActive && (st.status === 'active' || st.status === 'failed')) {
          foundActive = true;
          return { ...st, status: 'failed' as const };
        }
        return st;
      });
    }
  }

  if (payload.text !== undefined) record.statusText = payload.text;
  if (payload.duration) record.duration = payload.duration;
  if (Array.isArray(payload.steps)) record.steps = payload.steps;

  record.lastUpdatedAt = Date.now();
  const finalMsg = renderProgressMessage(record);

  await editTelegramMessageText(c.env.TELEGRAM_BOT_TOKEN, record.chatId, record.messageId, finalMsg);
  await c.env.PLIM_KV.put(`progress:${payload.id}`, JSON.stringify(record), { expirationTtl: 3600 });

  return c.json({ ok: true, id: record.id, status: record.status });
});

export default app;
