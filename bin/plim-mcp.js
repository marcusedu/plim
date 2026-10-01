#!/usr/bin/env node

/**
 * Plim MCP Server - Model Context Protocol over stdio
 * Allows AI agents (Claude Desktop, Cursor, Cline, Windsurf) to notify developers.
 */

const { exec } = require('child_process');
const readline = require('readline');
const path = require('path');

const PLIM_BIN = path.resolve(__dirname, 'plim');

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
    name: 'plim_run',
    description: "Execute a long-running terminal command (e.g. 'npm test', 'docker build', 'cargo build', 'pytest'). Automatically monitors duration, exit code, and notifies the developer on Telegram upon completion.",
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute.',
        },
      },
      required: ['command'],
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
        version: '1.0.0',
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

      exec(cmd, (err, stdout, stderr) => {
        if (err) {
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

    if (name === 'plim_run') {
      const targetCmd = args.command;
      if (!targetCmd) {
        return sendResponse(id, {
          content: [{ type: 'text', text: 'Error: missing command parameter.' }],
          isError: true,
        });
      }

      const escapedTarget = targetCmd.replace(/"/g, '\\"');
      const cmd = `"${PLIM_BIN}" run ${targetCmd}`;

      exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        const exitCode = err ? err.code || 1 : 0;
        const output = stdout || stderr || '';
        const tail = output.split('\n').slice(-15).join('\n');

        return sendResponse(id, {
          content: [
            {
              type: 'text',
              text: `Command finished with exit code ${exitCode}.\nDeveloper was notified via Telegram.\n\nOutput snippet:\n${tail}`,
            },
          ],
        });
      });
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

// Inicializa leitor de linhas sobre stdio
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
