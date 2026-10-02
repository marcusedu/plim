#!/usr/bin/env node

/**
 * Test Suite para o Servidor MCP do Plim (stdio JSON-RPC)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPT_DIR = path.resolve(__dirname, '..');
const MCP_PATH = path.join(SCRIPT_DIR, 'bin', 'plim-mcp.js');
const VERSION_PATH = path.join(SCRIPT_DIR, 'VERSION');
const EXPECTED_VERSION = fs.readFileSync(VERSION_PATH, 'utf8').trim();

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('🧪 Iniciando Testes do Servidor MCP (stdio)...');
console.log('----------------------------------------');

const mcpProcess = spawn('node', [MCP_PATH], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

const responses = [];
let buffer = '';

mcpProcess.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Mantém linha incompleta no buffer

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      try {
        responses.push(JSON.parse(trimmed));
      } catch (e) {
        console.error('Invalid JSON received:', trimmed);
      }
    }
  }
});

function sendRpc(msg) {
  mcpProcess.stdin.write(JSON.stringify(msg) + '\n');
}

async function runTests() {
  // Teste 1: Initialize
  sendRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    },
  });

  await new Promise((r) => setTimeout(r, 200));

  const initRes = responses.find((r) => r.id === 1);
  assert(initRes !== undefined, 'Servidor MCP respondeu à chamada initialize');
  assert(initRes?.result?.serverInfo?.name === 'plim-mcp', 'Nome do servidor é plim-mcp');
  assert(
    initRes?.result?.serverInfo?.version === EXPECTED_VERSION,
    `Versão do MCP (${initRes?.result?.serverInfo?.version}) confere com VERSION (${EXPECTED_VERSION})`
  );

  // Teste 2: Tools List
  sendRpc({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  });

  await new Promise((r) => setTimeout(r, 200));

  const toolsRes = responses.find((r) => r.id === 2);
  assert(toolsRes !== undefined, 'Servidor MCP respondeu à listagem de ferramentas');
  const tools = toolsRes?.result?.tools || [];
  const toolNames = tools.map((t) => t.name);

  assert(toolNames.includes('plim_notify'), 'Ferramenta plim_notify está registrada');
  assert(toolNames.includes('plim_run'), 'Ferramenta plim_run está registrada');
  assert(toolNames.includes('plim_ask'), 'Ferramenta plim_ask está registrada');

  // Teste 3: Tool inexistente
  sendRpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'ferramenta_inexistente',
      arguments: {},
    },
  });

  await new Promise((r) => setTimeout(r, 200));

  const notFoundRes = responses.find((r) => r.id === 3);
  assert(notFoundRes?.error?.code === -32601, 'Retorna erro -32601 para ferramenta inexistente');

  // Teste 4: plim_run sem parâmetros
  sendRpc({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'plim_run',
      arguments: {},
    },
  });

  await new Promise((r) => setTimeout(r, 200));

  const runErrRes = responses.find((r) => r.id === 4);
  assert(runErrRes?.result?.isError === true, 'plim_run sem comando retorna isError: true');

  mcpProcess.kill();

  // Teste 5: Execução via CLI (plim-mcp --help)
  const { execSync } = require('child_process');
  const helpOut = execSync(`node "${MCP_PATH}" --help`).toString();
  assert(helpOut.includes('Plim MCP Server & CLI'), 'plim-mcp --help exibe cabeçalho informativo');
  assert(helpOut.includes('npx plim-mcp test'), 'plim-mcp --help exibe comandos rápidos');

  // Teste 6: Encaminhamento de comando CLI (plim-mcp version)
  const verOut = execSync(`node "${MCP_PATH}" version`).toString();
  assert(verOut.includes('Plim v'), 'plim-mcp version encaminha e exibe versão');

  console.log('----------------------------------------');
  console.log(`📊 Resumo dos Testes MCP: ${passed}/${total} passaram (${failed} falhas)`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  mcpProcess.kill();
  process.exit(1);
});
