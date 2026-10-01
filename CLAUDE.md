# Plim Instructions for AI Coding Assistants (Claude Code, Cursor, Aider, Cline)

This environment has **Plim** installed for terminal and mobile notifications.

## Guidelines for AI Agents:

1. **Slow/Heavy Commands (>10s)**:
   Always prefix long-running commands with `plim run`:
   - Test suites: `plim run npm test` / `plim run pytest`
   - Builds: `plim run npm run build` / `plim run cargo build --release`
   - Containers/Deploys: `plim run docker compose up -d` / `plim run ./deploy.sh`

2. **Task Completion**:
   When you finish your user-assigned objective, notify the developer:
   ```bash
   plim -n "🤖 Tarefa concluída: [resumo do que foi realizado]"
   ```

3. **Blockers & Human Review**:
   If an unexpected issue occurs or human intervention is required:
   ```bash
   plim -n "⚠️ Bloqueado: [descreva o que precisa de revisão]"
   ```
