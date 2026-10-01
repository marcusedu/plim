# Diretrizes para Agentes de IA (AGENTES.md)

Este documento define a arquitetura, filosofia e as **regras obrigatórias** que qualquer agente de Inteligência Artificial (Claude Code, Antigravity, Cursor Agent, Windsurf, Cline, Aider, etc.) ou desenvolvedor deve seguir ao modificar o repositório **Plim**.

---

## 🎯 1. Filosofia e Propósito do Plim

O **Plim** é uma ferramenta de produtividade minimalista e multiplataforma desenvolvida para desenvolvedores e agentes autônomos. Ele transforma tarefas longas do terminal em notificações auditivas locais e push instantâneos no Telegram, além de permitir interações bidirecionais (perguntas e confirmações) pelo celular.

### Componentes Principais:
1. **CLI Unix (`bin/plim`)**: Script shell executável compatível com Bash 3.2+ (macOS), Bash moderno (Linux) e Zsh.
2. **CLI Windows (`bin/plim.ps1`)**: Script nativo em PowerShell para suporte sem dependências no Windows.
3. **Servidor MCP (`bin/plim-mcp.js`)**: Servidor Model Context Protocol via stdio em Node.js puro (zero dependências npm externas), garantindo inicialização em milissegundos para agentes de IA.
4. **Backend Serverless (`worker/`)**: Cloudflare Worker em TypeScript e Hono, integrado ao bot oficial [@plim_the_bot](https://t.me/plim_the_bot) com persistência em Cloudflare KV.

---

## 🚨 2. Regra de Ouro: Versionamento Obrigatório (Version Bump & Changelog)

> [!IMPORTANT]
> **TODA E QUALQUER ALTERAÇÃO** (nova funcionalidade, correção de bug, ajuste de performance ou documentação relevante) **DEVE OBRIGATORIAMENTE REALIZAR O BUMP DE VERSÃO E ATUALIZAR O CHANGELOG**.

Nenhuma alteração de código deve ser finalizada sem sincronizar os **5 pontos de versão**:

1. **Arquivo raiz `VERSION`**:
   - Atualizar a string semântica (ex: `1.2.0`).
2. **Script CLI `bin/plim`**:
   - Atualizar a variável `PLIM_VERSION="X.Y.Z"`.
3. **Servidor MCP `bin/plim-mcp.js`**:
   - Atualizar o campo `version` retornado no método `initialize` (`serverInfo.version: "X.Y.Z"`).
4. **Backend Worker `worker/package.json`**:
   - Atualizar o campo `"version": "X.Y.Z"`.
5. **Documento `CHANGELOG.md`**:
   - Adicionar uma nova seção no topo seguindo o formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/):
     ```markdown
     ## [X.Y.Z] - YYYY-MM-DD
     ### ✨ Adicionado
     - Descrição da novidade...
     ### 🐛 Corrigido
     - Descrição da correção...
     ```

### Critério Semântico (SemVer):
- **PATCH (`1.2.X`)**: Correções de bugs, pequenas melhorias de compatibilidade ou ajustes internos sem novas flags/ferramentas.
- **MINOR (`1.X.0`)**: Novas ferramentas MCP, novos comandos na CLI, novos endpoints no Worker ou novas integrações.
- **MAJOR (`X.0.0`)**: Mudanças incompatíveis na API, remoção de comandos ou reformulação da arquitetura.

---

## 🛡️ 3. Regras Técnicas e de Compatibilidade

### 3.1. Shell Scripting (`bin/plim`)
- **Bash 3.2 do macOS**: O macOS ainda distribui GNU Bash 3.2. NUNCA utilize sintaxes que só existem no Zsh ou Bash 4+.
  - ❌ **Proibido**: `${var[-3500,-1]}` (explode com `bad array subscript` no Bash).
  - ✅ **Obrigatório**: `${var: -3500}` (funciona perfeitamente em Bash 3.2+ e Zsh).
- **Processos em Background (`&`)**:
  - SEMPRE desconecte os descritores de entrada e saída (`stdin`/`stdout`/`stderr`):
    ```bash
    afplay "$som" </dev/null >/dev/null 2>&1 &
    osascript -e "..." </dev/null >/dev/null 2>&1 &
    nohup curl ... </dev/null >/dev/null 2>&1 &
    ```
  - Se os descritores não forem fechados, pipelines Unix (`cmd | plim`) ficam bloqueadas até o subprocesso terminar.
- **Pipes Unix e Streaming**:
  - O Plim deve respeitar o fluxo padrão Unix. Ao ler de `stdin`, utilize `tee` para streaming em tempo real e capture apenas o resumo final (`tail -n 25`) para envio remoto, prevenindo overflow de payload.

### 3.2. Servidor MCP (`bin/plim-mcp.js`)
- Mantenha o arquivo em Node.js puro utilizando os módulos nativos (`child_process`, `readline`, `path`, `fs`, `os`, `fetch`).
- Não adicione bibliotecas pesadas via `package.json` na raiz; o MCP deve rodar instantaneamente via `npx` ou `node` sem etapas prévias de `npm install`.

### 3.3. Cloudflare Worker (`worker/src/index.ts`)
- TypeScript estrito. Sempre execute `npx tsc --noEmit` dentro da pasta `worker/` para validar a tipagem antes de commitar.
- Limite requisições e payloads para respeitar as cotas e limites do Cloudflare Worker e Telegram Bot API.

---

## 🧪 4. Testes Automatizados

Antes de criar commits ou abrir Pull Requests:
1. Execute a suíte de testes automatizados:
   ```bash
   make test
   ```
2. Valide se a sintaxe de todos os arquivos está correta:
   ```bash
   bash -n bin/plim
   node --check bin/plim-mcp.js
   cd worker && npx tsc --noEmit
   ```

---

## 📝 5. Padrão de Commits no Git (Conventional Commits)

Os commits devem ser atômicos e seguir a convenção:
```
<tipo>(<escopo>): <descrição no imperativo>
```

Exemplos:
- `feat(ask): adiciona comando plim ask e ferramenta mcp interativa`
- `fix(pipe): corrige streaming em tempo real e fecha descritores de background`
- `docs: atualiza changelog e documentação do mcp`
- `chore(release): bump version to 1.2.0`
