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

// ---------------------------------------------------------------------------
// 1. Healthcheck & Setup de Comandos
// ---------------------------------------------------------------------------
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Plim API & Telegram Worker',
    version: '1.0.0',
    docs: 'https://github.com/marcusedu/plim',
  });
});

// Endpoint para registrar os comandos no menu oficial do Telegram
app.get('/setup-commands', async (c) => {
  const botToken = c.env.TELEGRAM_BOT_TOKEN;
  const commands = [
    { command: 'start', description: 'Conectar seu terminal ao bot' },
    { command: 'install', description: 'Como instalar o Plim no terminal' },
    { command: 'status', description: 'Ver cota de hoje e token ativo' },
    { command: 'pro', description: 'Upgrade para Plim Pro ⭐ (Ilimitado)' },
    { command: 'help', description: 'Guia de comandos do terminal' },
    { command: 'resettoken', description: 'Gerar uma nova chave de API' },
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
            selectedText = choice === 'retry' ? '🔁 Repetir Execução' : '🛑 Cancelado';
          }

          // Salva no KV por 1 hora
          await c.env.PLIM_KV.put(`ask:${askId}`, JSON.stringify(record), { expirationTtl: 3600 });

          // Confirma o callback para remover o loading no Telegram
          await answerTelegramCallbackQuery(botToken, cb.id, `Opção selecionada: ${selectedText}`);

          // Edita a mensagem removendo os botões inline e exibindo o status final
          let updatedText = '';
          if (action === 'ask') {
            updatedText = `❓ <b>Pergunta do Agente Plim:</b>\n${escapeHtml(record.question)}\n\n✅ <b>Respondido:</b> <code>${escapeHtml(selectedText)}</code>`;
          } else {
            updatedText = `⚠️ <b>Comando com Falha:</b>\n<code>${escapeHtml(record.command || '')}</code>\n\n${choice === 'retry' ? '🔁 <b>Solicitada repetição da execução!</b>' : '🛑 <b>Execução cancelada/ignorada.</b>'}`;
          }

          if (fromId && msgId) {
            await editTelegramMessageText(botToken, fromId, msgId, updatedText);
          }
          return c.json({ ok: true });
        } else {
          await answerTelegramCallbackQuery(botToken, cb.id, 'Esta ação já foi respondida!');
          return c.json({ ok: true });
        }
      } else {
        await answerTelegramCallbackQuery(botToken, cb.id, 'Pergunta expirada ou inexistente.');
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

  // 2. Tratamento de Pagamento Concluído com Sucesso
  if (message.successful_payment) {
    let userStr = await c.env.PLIM_KV.get(`user:${chatId}`);
    if (userStr) {
      const user: UserRecord = JSON.parse(userStr);
      user.plan = 'pro';
      user.upgradedAt = Date.now();
      await c.env.PLIM_KV.put(`user:${chatId}`, JSON.stringify(user));
    }

    const successMsg = `🎉 <b>PARABÉNS! VOCÊ AGORA É PLIM PRO!</b> ⭐

O seu plano foi atualizado com sucesso:
• Notificações diárias <b>ilimitadas</b>
• Alertas prioritários para deploys e builds
• Acesso vitalício

Obrigado por apoiar o desenvolvimento do Plim! 🚀`;

    await sendTelegramMessage(botToken, chatId, successMsg);
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
    const newUser: UserRecord = {
      chatId,
      token,
      username: message.from?.username,
      firstName: message.from?.first_name,
      plan: 'free',
      createdAt: Date.now(),
    };
    await c.env.PLIM_KV.put(`user:${chatId}`, JSON.stringify(newUser));
    await c.env.PLIM_KV.put(`token:${token}`, chatId.toString());
    return newUser;
  }

  // Comando /start
  if (text.startsWith('/start')) {
    const user = await getOrCreateUser();

    const welcomeMsg = `🎉 <b>Bem-vindo ao Plim!</b>

O Plim monitora tarefas longas no seu Mac/Linux e te avisa no celular quando terminarem.

<b>1️⃣ Conecte seu terminal:</b>
Copie e cole o comando abaixo:
<code>plim connect ${user.token}</code>

<b>2️⃣ Como usar no dia a dia:</b>
• <code>plim run &lt;comando&gt;</code> para monitorar builds e deploys
• <code>plim -n "Mensagem"</code> para notificações rápidas
• <code>/install</code> para ver como instalar o Plim em outra máquina
• <code>/status</code> para ver sua cota diária
• <code>/pro</code> para ter notificações ilimitadas`;

    await sendTelegramMessage(botToken, chatId, welcomeMsg);
    return c.json({ ok: true });
  }

  // Comando /install
  if (text.startsWith('/install') || text.startsWith('/instalar')) {
    const user = await getOrCreateUser();
    const installMsg = `📦 <b>Como Instalar o Plim</b>

No seu terminal (macOS ou Linux), rode o instalador oficial:

<code>curl -fsSL https://raw.githubusercontent.com/marcusedu/plim/main/install.sh | bash</code>

Depois de instalado, ative a sua conta:
<code>plim connect ${user.token}</code>

Ou instale e conecte em 1 linha só:
<code>curl -fsSL https://raw.githubusercontent.com/marcusedu/plim/main/install.sh | bash -s -- ${user.token}</code>`;

    await sendTelegramMessage(botToken, chatId, installMsg);
    return c.json({ ok: true });
  }

  // Comando /status
  if (text.startsWith('/status')) {
    const user = await getOrCreateUser();
    const today = getTodayKey();
    const usageStr = await c.env.PLIM_KV.get(`usage:${chatId}:${today}`);
    const usage = usageStr ? parseInt(usageStr, 10) : 0;
    const limit = user.plan === 'pro'
      ? parseInt(c.env.PRO_TIER_DAILY_LIMIT || '5000', 10)
      : parseInt(c.env.FREE_TIER_DAILY_LIMIT || '50', 10);

    const statusMsg = `📊 <b>Status da sua conta Plim</b>

👤 <b>Plano:</b> ${user.plan === 'pro' ? '⭐ PRO (Ilimitado)' : '🆓 Gratuito (50/dia)'}
📬 <b>Uso hoje:</b> ${usage} de ${user.plan === 'pro' ? '∞' : limit} notificações
🔑 <b>Seu Token:</b> <code>${user.token}</code>

Para conectar em outro computador:
<code>plim connect ${user.token}</code>`;

    await sendTelegramMessage(botToken, chatId, statusMsg);
    return c.json({ ok: true });
  }

  // Comando /pro ou /upgrade (Fatura com Telegram Stars)
  if (text.startsWith('/pro') || text.startsWith('/upgrade') || text.startsWith('/comprar')) {
    const user = await getOrCreateUser();

    if (user.plan === 'pro') {
      await sendTelegramMessage(botToken, chatId, `⭐ <b>Você já é um usuário Plim PRO!</b>\n\nSeu acesso é vitalício e você tem notificações ilimitadas.`);
      return c.json({ ok: true });
    }

    const starsAmount = parseInt(c.env.PRO_PRICE_STARS || '150', 10); // Padrão: 150 Telegram Stars (~$2.99)

    // Envia primeiro a descrição dos benefícios
    const proBenefits = `⭐ <b>Plano Plim PRO (Acesso Vitalício)</b>

Elimine limites e turbine seu fluxo de desenvolvimento:
✅ <b>Notificações ilimitadas</b> (sem teto diário)
✅ Alertas prioritários na fila de mensagens
✅ Resumo de logs expandido no Telegram
✅ Apoie o projeto open-source

<b>Valor:</b> ${starsAmount} ⭐ Telegram Stars (pagamento único via Apple Pay, Google Pay ou Cartão direto no Telegram).`;

    await sendTelegramMessage(botToken, chatId, proBenefits);

    // Envia a fatura nativa do Telegram Stars
    await sendTelegramInvoice(
      botToken,
      chatId,
      'Plim PRO (Acesso Vitalício)',
      'Notificações diárias ilimitadas e alertas prioritários no seu terminal.',
      `upgrade_${chatId}_${Date.now()}`,
      starsAmount
    );

    return c.json({ ok: true });
  }

  // Comando /resettoken
  if (text.startsWith('/resettoken')) {
    const user = await getOrCreateUser();
    await c.env.PLIM_KV.delete(`token:${user.token}`);

    const newToken = `plim_live_${crypto.randomUUID().replace(/-/g, '')}`;
    user.token = newToken;
    await c.env.PLIM_KV.put(`user:${chatId}`, JSON.stringify(user));
    await c.env.PLIM_KV.put(`token:${newToken}`, chatId.toString());

    await sendTelegramMessage(
      botToken,
      chatId,
      `🔑 <b>Novo token gerado!</b>\n\nAtualize seu terminal com:\n<code>plim connect ${newToken}</code>`
    );
    return c.json({ ok: true });
  }

  // Comando /help
  if (text.startsWith('/help') || text.startsWith('/ajuda')) {
    const helpMsg = `📖 <b>Guia de Uso do Plim</b>

<b>No seu Terminal:</b>
• <code>plim run &lt;comando&gt;</code>
  Executa o comando, cronometra a duração, toca som no Mac e envia o resultado no Telegram.
  <i>Exemplo:</i> <code>plim run npm run build</code>

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
/resettoken - Gerar nova chave de API`;

    await sendTelegramMessage(botToken, chatId, helpMsg);
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

  if (currentUsage >= limit) {
    if (currentUsage === limit) {
      await sendTelegramMessage(
        c.env.TELEGRAM_BOT_TOKEN,
        chatId,
        `⚠️ <b>Limite diário atingido (${limit} notificações)</b>\n\nVocê atingiu sua cota gratuita por hoje. Envie /pro para fazer o upgrade para o plano Ilimitado!`
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
    formattedText += `\n⏱ <b>Duração:</b> ${payload.duration}`;
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
  await sendTelegramMessage(
    c.env.TELEGRAM_BOT_TOKEN,
    chatId,
    `🎉 <b>Terminal Conectado com Sucesso!</b>\n\nO seu Plim está configurado e pronto para uso!\nTente rodar:\n<code>plim run sleep 2 &amp;&amp; echo "Deploy finalizado!"</code>`
  );

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
  const options = payload.options && payload.options.length > 0 ? payload.options : ['Sim', 'Não'];

  const record: AskRecord = {
    id: askId,
    chatId,
    question: payload.question || `O comando falhou: ${payload.command}`,
    options: isRetry ? ['Repetir', 'Cancelar'] : options,
    status: 'pending',
    createdAt: Date.now(),
    type: isRetry ? 'retry' : 'question',
    command: payload.command,
  };

  // Monta teclado inline
  let inlineKeyboard: any[][] = [];
  if (isRetry) {
    inlineKeyboard = [
      [
        { text: '🔁 Repetir Execução', callback_data: `retry:${askId}:retry` },
        { text: '🛑 Cancelar', callback_data: `retry:${askId}:cancel` },
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
    messageText = `⚠️ <b>Comando com Falha no Terminal:</b>\n<code>${escapeHtml(payload.command || '')}</code>\n\n<i>Deseja tentar executar novamente agora?</i>`;
  } else {
    messageText = `❓ <b>Pergunta do Agente Plim:</b>\n\n${escapeHtml(payload.question || '')}\n\n<i>Selecione uma opção abaixo:</i>`;
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

export default app;
