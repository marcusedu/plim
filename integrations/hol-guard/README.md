# HOL Guard Integration for Plim MCP

Este diretório contém os arquivos necessários para submeter o **Plim** ao catálogo oficial de servidores MCP do [HOL Guard](https://github.com/hashgraph-online/hol-guard).

## Arquivos
- `mcp.plim.json`: Manifesto declarativo do servidor MCP, validado contra o schema oficial `contracts/mcp-servers/contribution.v1.schema.json`.

## Passos para abrir o Pull Request no HOL Guard

1. Faça um fork de [hashgraph-online/hol-guard](https://github.com/hashgraph-online/hol-guard).
2. Crie uma branch:
   ```bash
   git checkout -b add-mcp-plim
   ```
3. Copie o arquivo `mcp.plim.json` para o repositório deles:
   ```bash
   cp integrations/hol-guard/mcp.plim.json contributions/mcp-servers/mcp.plim.json
   ```
4. Adicione `"command.mcp-plim"` na lista `"external"` em `contracts/extensions/trust-class-map.v1.json`.
5. Faça o commit e abra o Pull Request!
