#!/usr/bin/env node

/**
 * Plim MCP Server - Model Context Protocol over stdio
 * Allows AI agents (Claude Desktop, Cursor, Cline, Windsurf) to notify developers.
 */

const { exec, spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SERVER_VERSION = '1.6.0';

function resolvePlimBin() {
  const localBin = path.resolve(__dirname, 'plim');
  if (fs.existsSync(localBin)) return localBin;

  const home = os.homedir();
  const candidates = [
    path.join(home, '.local', 'bin', 'plim'),
    '/usr/local/bin/plim',
    '/opt/homebrew/bin/plim',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'plim';
}

const PLIM_BIN = resolvePlimBin();

function forwardToCli(args) {
  const plimBin = resolvePlimBin();
  let cmd = plimBin;
  let cmdArgs = args;

  if (process.platform === 'win32') {
    const psScript = path.resolve(__dirname, 'plim.ps1');
    if (fs.existsSync(psScript)) {
      cmd = 'powershell.exe';
      cmdArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript, ...args];
    } else {
      cmd = 'bash';
      cmdArgs = [plimBin, ...args];
    }
  } else {
    try {
      if (fs.existsSync(plimBin)) {
        fs.chmodSync(plimBin, 0o755);
      }
    } catch (e) {}
    cmd = 'bash';
    cmdArgs = [plimBin, ...args];
  }

  const child = spawn(cmd, cmdArgs, { stdio: 'inherit' });
  child.on('close', (code) => {
    process.exit(code || 0);
  });
  child.on('error', (err) => {
    process.stderr.write(`[plim-mcp] Failed to execute CLI: ${err.message}\n`);
    process.exit(1);
  });
}

function playDesktopSound(name = 'Glass') {
  if (process.platform === 'darwin') {
    const soundPath = `/System/Library/Sounds/${name}.aiff`;
    if (fs.existsSync(soundPath)) {
      exec(`afplay "${soundPath}" </dev/null >/dev/null 2>&1 &`);
    } else {
      exec(`afplay /System/Library/Sounds/Glass.aiff </dev/null >/dev/null 2>&1 &`);
    }
  } else if (process.platform === 'linux') {
    exec(`paplay /usr/share/sounds/freedesktop/stereo/complete.oga </dev/null >/dev/null 2>&1 || aplay /usr/share/sounds/alsa/Front_Center.wav </dev/null >/dev/null 2>&1 &`);
  } else if (process.platform === 'win32') {
    exec(`powershell -c "[console]::beep(800, 300)" </dev/null >/dev/null 2>&1 &`);
  }
}

function loadPlimConfig() {
  const home = os.homedir();
  const configPaths = [
    path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'plim', 'config'),
    path.join(home, '.plimrc'),
  ];

  let apiKey = process.env.PLIM_API_KEY || null;
  let apiUrl = process.env.PLIM_API_URL || 'https://plim-api.marcusedu.workers.dev';
  let lang = process.env.PLIM_LANG || null;

  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const keyMatch = content.match(/PLIM_API_KEY=["']?([^"'\r\n]+)["']?/);
        const urlMatch = content.match(/PLIM_API_URL=["']?([^"'\r\n]+)["']?/);
        const langMatch = content.match(/PLIM_LANG=["']?([^"'\r\n]+)["']?/);
        if (keyMatch) apiKey = keyMatch[1];
        if (urlMatch) apiUrl = urlMatch[1];
        if (langMatch) lang = langMatch[1];
      } catch (e) {}
    }
  }

  if (!lang) {
    const sysLocale = process.env.LANG || process.env.LC_ALL || '';
    lang = sysLocale.startsWith('pt') ? 'pt' : 'en';
  }

  return { apiKey, apiUrl, lang };
}

const TOOLS = [
  {
    name: 'plim_notify',
    description: "Send an instant push notification to the developer's mobile phone via Telegram and native desktop alert. Use this when you finish a long task, need human review, or encounter an error.",
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The notification message to send to the developer.',
        },
        title: {
          type: 'string',
          description: 'Optional title (defaults to Plim).',
        },
        status: {
          type: 'string',
          enum: ['success', 'error', 'info'],
          description: 'Status level (affects sounds and emojis).',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'plim_ask',
    description: "Ask the developer a question with interactive multiple-choice buttons on their mobile phone via Telegram and wait for their response. Use this whenever you need human confirmation, a decision between approaches, or authorization to proceed.",
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the developer.',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of selectable option labels (e.g. ["Yes", "No"] or ["Approach A", "Approach B", "Cancel"]). Defaults to ["Yes", "No"] (or ["Sim", "Não"] for Portuguese locale).',
        },
        timeout: {
          type: 'number',
          description: 'Maximum time to wait for developer response in seconds (default: 300, max: 900).',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'plim_run',
    description: "Execute a terminal command (e.g. 'npm test', 'docker build', 'cargo build', 'pytest'). Automatically monitors duration, exit code, and notifies the developer on Telegram upon completion. If retry_on_failure is enabled and the command fails, sends interactive [Repeat / Cancel] buttons to Telegram.",
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute.',
        },
        retry_on_failure: {
          type: 'boolean',
          description: 'If true and the command fails, prompts developer via Telegram buttons to optionally retry execution.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'plim_progress',
    description: "Create, update, or finish live dynamic progress messages on the developer's mobile phone via Telegram (in-place message editing). Ideal for multi-step tasks, pipelines, builds, or migrations without polluting the chat with multiple notifications.",
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'update', 'finish'],
          description: "Action to perform: 'start' to initialize progress, 'update' to update status/percent/step, 'finish' to conclude.",
        },
        progress_id: {
          type: 'string',
          description: "Progress session ID returned from 'start'. Required for 'update' and 'finish'.",
        },
        title: {
          type: 'string',
          description: "Title of the task or pipeline (required for 'start').",
        },
        percent: {
          type: 'number',
          description: "Progress percentage (0-100).",
        },
        status_text: {
          type: 'string',
          description: "Current step or status description.",
        },
        status: {
          type: 'string',
          enum: ['success', 'error'],
          description: "Final status for 'finish' action.",
        },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              status: { type: 'string', enum: ['done', 'active', 'pending', 'failed'] },
            },
            required: ['label', 'status'],
          },
          description: "List of steps and their respective statuses.",
        },
      },
      required: ['action'],
    },
  },
];

function sendResponse(id, result, error = null) {
  const response = {
    jsonrpc: '2.0',
    id,
  };
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  process.stdout.write(JSON.stringify(response) + '\n');
}

function handleRequest(req) {
  const { id, method, params } = req;

  if (method === 'initialize') {
    return sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: 'plim-mcp',
        version: SERVER_VERSION,
      },
    });
  }

  if (method === 'notifications/initialized') {
    // Apenas confirmação de conexão
    return;
  }

  if (method === 'tools/list') {
    return sendResponse(id, { tools: TOOLS });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};

    if (name === 'plim_notify') {
      const msg = args.title ? `[${args.title}] ${args.message}` : args.message;
      const escapedMsg = msg.replace(/"/g, '\\"');
      const cmd = `"${PLIM_BIN}" -n "${escapedMsg}"`;

      exec(cmd, async (err, stdout, stderr) => {
        if (err) {
          // Fallback gracioso: tenta enviar diretamente via API HTTP e som nativo se plim CLI não estiver presente
          const { apiKey, apiUrl } = loadPlimConfig();
          playDesktopSound(args.status === 'error' ? 'Sosumi' : 'Glass');

          if (apiKey) {
            try {
              const res = await fetch(`${apiUrl}/api/notify`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  title: args.title || '🔔 Plim',
                  body: args.message,
                  status: args.status || 'info',
                }),
              });
              const data = await res.json();
              if (data.ok) {
                return sendResponse(id, {
                  content: [{ type: 'text', text: `Notification successfully sent to developer's mobile phone: "${msg}"` }],
                });
              }
            } catch (netErr) {}
          }

          return sendResponse(id, {
            content: [{ type: 'text', text: `Failed to send notification: ${err.message}` }],
            isError: true,
          });
        }
        return sendResponse(id, {
          content: [{ type: 'text', text: `Notification successfully sent to developer's mobile phone: "${msg}"` }],
        });
      });
      return;
    }

    if (name === 'plim_ask') {
      const question = args.question;
      const { apiKey, apiUrl, lang } = loadPlimConfig();
      const defaultOptions = lang === 'pt' ? ['Sim', 'Não'] : ['Yes', 'No'];
      const options = Array.isArray(args.options) && args.options.length > 0 ? args.options : defaultOptions;
      const timeoutSec = Math.min(Math.max(args.timeout || 300, 10), 900);

      if (!apiKey) {
        return sendResponse(id, {
          content: [{ type: 'text', text: 'Error: Plim is not connected. Run `plim connect <token>` first.' }],
          isError: true,
        });
      }

      // Toca som de alerta no Mac avisando sobre pergunta pendente
      playDesktopSound('Ping');

      (async () => {
        try {
          const createRes = await fetch(`${apiUrl}/api/ask`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question, options, type: 'question' }),
          });

          const createData = await createRes.json();
          if (!createData.ok || !createData.id) {
            return sendResponse(id, {
              content: [{ type: 'text', text: `Failed to create Telegram question: ${createData.error || 'Unknown error'}` }],
              isError: true,
            });
          }

          const askId = createData.id;
          const startTime = Date.now();
          const pollIntervalMs = 2000;

          const pollTimer = setInterval(async () => {
            const elapsedSec = (Date.now() - startTime) / 1000;
            if (elapsedSec >= timeoutSec) {
              clearInterval(pollTimer);
              return sendResponse(id, {
                content: [{ type: 'text', text: `Timeout: Developer did not answer within ${timeoutSec} seconds.` }],
                isError: true,
              });
            }

            try {
              const statusRes = await fetch(`${apiUrl}/api/ask/${askId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
              });
              const statusData = await statusRes.json();

              if (statusData.ok && statusData.status === 'answered') {
                clearInterval(pollTimer);
                // Som de confirmação de resposta recebida
                playDesktopSound('Glass');
                return sendResponse(id, {
                  content: [
                    {
                      type: 'text',
                      text: `Developer responded via Telegram:\n• Selected Option: "${statusData.answer}" (index: ${statusData.answerIndex})\n• Question: "${question}"`,
                    },
                  ],
                });
              }
            } catch (err) {
              // Ignora erros transitórios no polling
            }
          }, pollIntervalMs);

        } catch (e) {
          return sendResponse(id, {
            content: [{ type: 'text', text: `Network error sending question to Plim Cloud: ${e.message}` }],
            isError: true,
          });
        }
      })();
      return;
    }

    if (name === 'plim_run') {
      const targetCmd = args.command;
      if (!targetCmd) {
        return sendResponse(id, {
          content: [{ type: 'text', text: 'Error: missing command parameter.' }],
          isError: true,
        });
      }

      const retryOnFailure = args.retry_on_failure === true;

      function executeAndHandle(attempt = 1) {
        const cmd = `"${PLIM_BIN}" run ${targetCmd}`;

        exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, async (err, stdout, stderr) => {
          const exitCode = err ? err.code || 1 : 0;
          const output = stdout || stderr || '';
          const tail = output.split('\n').slice(-15).join('\n');

          // Se falhou e retry_on_failure está ativado, pergunta no Telegram
          if (exitCode !== 0 && retryOnFailure && attempt === 1) {
            const { apiKey, apiUrl, lang } = loadPlimConfig();
            if (apiKey) {
              const retryQuestion = lang === 'pt'
                ? `O comando falhou com exit code ${exitCode}. Deseja repetir?`
                : `Command failed with exit code ${exitCode}. Do you want to retry?`;
              try {
                const askRes = await fetch(`${apiUrl}/api/ask`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    type: 'retry',
                    command: targetCmd,
                    question: retryQuestion,
                  }),
                });
                const askData = await askRes.json();
                if (askData.ok && askData.id) {
                  // Aguarda resposta do usuário por até 60 segundos
                  const startPoll = Date.now();
                  const pollInterval = setInterval(async () => {
                    if ((Date.now() - startPoll) > 60000) {
                      clearInterval(pollInterval);
                      return sendResponse(id, {
                        content: [
                          {
                            type: 'text',
                            text: `Command failed with exit code ${exitCode}. (Developer did not respond to retry prompt within 60s).\n\nOutput snippet:\n${tail}`,
                          },
                        ],
                      });
                    }

                    try {
                      const checkRes = await fetch(`${apiUrl}/api/ask/${askData.id}`, {
                        headers: { 'Authorization': `Bearer ${apiKey}` },
                      });
                      const checkData = await checkRes.json();
                      if (checkData.ok && checkData.status === 'answered') {
                        clearInterval(pollInterval);
                        if (checkData.answer === 'retry') {
                          // Usuário clicou em "Repetir" pelo Telegram!
                          executeAndHandle(attempt + 1);
                        } else {
                          return sendResponse(id, {
                            content: [
                              {
                                type: 'text',
                                text: `Command failed with exit code ${exitCode}. (Developer canceled retry via Telegram).\n\nOutput snippet:\n${tail}`,
                              },
                            ],
                          });
                        }
                      }
                    } catch (e) {}
                  }, 2000);
                  return;
                }
              } catch (e) {}
            }
          }

          return sendResponse(id, {
            content: [
              {
                type: 'text',
                text: `Command finished with exit code ${exitCode}.${attempt > 1 ? ` (Re-executed after Telegram retry approval)` : ''}\nDeveloper was notified via Telegram.\n\nOutput snippet:\n${tail}`,
              },
            ],
          });
        });
      }

      executeAndHandle(1);
      return;
    }

    if (name === 'plim_progress') {
      const { apiKey, apiUrl, lang } = loadPlimConfig();
      if (!apiKey) {
        return sendResponse(id, {
          content: [{ type: 'text', text: 'Error: Plim is not connected. Run `plim connect <token>` first.' }],
          isError: true,
        });
      }

      const action = args.action;
      if (!action || !['start', 'update', 'finish'].includes(action)) {
        return sendResponse(id, {
          content: [{ type: 'text', text: "Error: 'action' parameter must be 'start', 'update', or 'finish'." }],
          isError: true,
        });
      }

      (async () => {
        try {
          if (action === 'start') {
            const title = args.title || (lang === 'pt' ? 'Execução em Progresso' : 'Execution in Progress');
            const res = await fetch(`${apiUrl}/api/progress/start`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                title,
                steps: args.steps,
                percent: args.percent || 0,
                text: args.status_text,
              }),
            });
            const data = await res.json();
            if (data.ok && data.id) {
              return sendResponse(id, {
                content: [{ type: 'text', text: `Live progress message started on Telegram.\nProgress ID: ${data.id}` }],
              });
            }
            return sendResponse(id, {
              content: [{ type: 'text', text: `Failed to start progress: ${data.error || 'Unknown error'}` }],
              isError: true,
            });
          }

          if (action === 'update') {
            const progressId = args.progress_id;
            if (!progressId) {
              return sendResponse(id, {
                content: [{ type: 'text', text: "Error: 'progress_id' is required for 'update' action." }],
                isError: true,
              });
            }

            const res = await fetch(`${apiUrl}/api/progress/update`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: progressId,
                percent: args.percent,
                text: args.status_text,
                steps: args.steps,
              }),
            });
            const data = await res.json();
            if (data.ok) {
              return sendResponse(id, {
                content: [{ type: 'text', text: `Progress updated on Telegram (ID: ${progressId}, ${data.percent}%).` }],
              });
            }
            return sendResponse(id, {
              content: [{ type: 'text', text: `Failed to update progress: ${data.error || 'Unknown error'}` }],
              isError: true,
            });
          }

          if (action === 'finish') {
            const progressId = args.progress_id;
            if (!progressId) {
              return sendResponse(id, {
                content: [{ type: 'text', text: "Error: 'progress_id' is required for 'finish' action." }],
                isError: true,
              });
            }

            const status = args.status || 'success';
            playDesktopSound(status === 'error' ? 'Sosumi' : 'Glass');

            const res = await fetch(`${apiUrl}/api/progress/finish`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: progressId,
                status,
                text: args.status_text,
                steps: args.steps,
              }),
            });
            const data = await res.json();
            if (data.ok) {
              return sendResponse(id, {
                content: [{ type: 'text', text: `Progress concluded with status '${status}' on Telegram (ID: ${progressId}).` }],
              });
            }
            return sendResponse(id, {
              content: [{ type: 'text', text: `Failed to finish progress: ${data.error || 'Unknown error'}` }],
              isError: true,
            });
          }
        } catch (err) {
          return sendResponse(id, {
            content: [{ type: 'text', text: `Network error communicating with Plim Cloud: ${err.message}` }],
            isError: true,
          });
        }
      })();
      return;
    }

    return sendResponse(id, null, { code: -32601, message: `Tool '${name}' not found.` });
  }

  if (method === 'ping') {
    return sendResponse(id, {});
  }

  // Método desconhecido
  if (id !== undefined) {
    return sendResponse(id, null, { code: -32601, message: `Method '${method}' not found.` });
  }
}

// Processa argumentos de linha de comando se houver
const cliArgs = process.argv.slice(2);
if (cliArgs.length > 0 && cliArgs[0] !== 'mcp') {
  const firstArg = cliArgs[0];
  if (firstArg === '--help' || firstArg === '-h' || firstArg === 'help') {
    const { lang } = loadPlimConfig();
    if (lang === 'pt') {
      console.log(`
Plim MCP Server & CLI - v${SERVER_VERSION}

Modo Servidor MCP (no Claude Desktop / Cursor / Windsurf mcp.json):
  {
    "mcpServers": {
      "plim": {
        "command": "npx",
        "args": ["-y", "plim-mcp"]
      }
    }
  }

Comandos Rápidos via npx:
  npx plim-mcp test               # Testa som e notificação no Telegram
  npx plim-mcp run <comando>      # Monitora execução, tempo e status
  npx plim-mcp -n "Mensagem"      # Dispara notificação no desktop e Telegram
  npx plim-mcp connect <token>    # Conecta ao @plim_the_bot
  npx plim-mcp ask "Pergunta?"    # Pergunta com botões no Telegram
  npx plim-mcp lang [en|pt]       # Exibe ou altera idioma
  npx plim-mcp version            # Exibe a versão instalada
`);
    } else {
      console.log(`
Plim MCP Server & CLI - v${SERVER_VERSION}

Usage as MCP Server (in Claude Desktop / Cursor / Windsurf mcp.json):
  {
    "mcpServers": {
      "plim": {
        "command": "npx",
        "args": ["-y", "plim-mcp"]
      }
    }
  }

Quick Commands via npx:
  npx plim-mcp test               # Test audio cues and Telegram delivery
  npx plim-mcp run <command>      # Monitor execution duration and status
  npx plim-mcp -n "Message"       # Trigger desktop and Telegram notification
  npx plim-mcp connect <token>    # Link terminal to @plim_the_bot
  npx plim-mcp ask "Question?"    # Interactive Telegram buttons
  npx plim-mcp lang [en|pt]       # Display or switch language
  npx plim-mcp version            # Display current version
`);
    }
    process.exit(0);
  }

  // Encaminha comando para o binário da CLI
  forwardToCli(cliArgs);
  return;
}

// Inicia servidor MCP sobre stdio
if (process.stdin.isTTY) {
  const { lang } = loadPlimConfig();
  if (lang === 'pt') {
    process.stderr.write(
      `🚀 Servidor Plim MCP v${SERVER_VERSION} em execução no stdio.\n` +
      `Aguardando mensagens JSON-RPC de agentes de IA (Claude, Cursor, Windsurf, Antigravity)...\n\n` +
      `💡 Dica: Para rodar comandos no terminal via npx, use:\n` +
      `   npx plim-mcp test\n` +
      `   npx plim-mcp run <comando>\n` +
      `   npx plim-mcp connect <token>\n\n` +
      `Pressione Ctrl+C para encerrar.\n\n`
    );
  } else {
    process.stderr.write(
      `🚀 Plim MCP Server v${SERVER_VERSION} running on stdio.\n` +
      `Listening for JSON-RPC from AI agents (Claude, Cursor, Windsurf, Antigravity)...\n\n` +
      `💡 Tip: To run CLI commands in terminal via npx, use:\n` +
      `   npx plim-mcp test\n` +
      `   npx plim-mcp run <command>\n` +
      `   npx plim-mcp connect <token>\n\n` +
      `Press Ctrl+C to exit.\n\n`
    );
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const json = JSON.parse(trimmed);
    handleRequest(json);
  } catch (e) {
    process.stderr.write(`[plim-mcp] Invalid JSON: ${e.message}\n`);
  }
});
