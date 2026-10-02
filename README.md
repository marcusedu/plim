<div align="center">
  <img src="assets/icon.jpg" width="128" height="128" alt="Plim Logo" style="border-radius: 28px;" />
  <h1>Plim</h1>
  <p><b>Productivity CLI for developers & MCP Server for AI coding agents</b></p>
  <p>Monitor long-running builds, tests, and deploys with native desktop audio alerts and instant push notifications on your phone via Telegram.</p>
  <p>
    🌐 <b>English</b> | <b><a href="README.pt-BR.md">Português</a></b>
  </p>
</div>

Includes an official **Model Context Protocol (MCP)** server for AI coding agents and a serverless backend on **Cloudflare Workers** integrated with **[@plim_the_bot](https://t.me/plim_the_bot)** featuring interactive Telegram questions, rate limits, and zero-setup onboarding.

---

## ✨ Features

- **Command Monitor (`plim run`)**: Executes any shell command or script, tracks duration, detects success or failure, plays distinctive system audio (`Ping` or `Basso`), triggers desktop notifications, and sends output logs to your phone via Telegram.
- **Dynamic Live Progress (`plim progress` & `plim run --progress`)**: Live in-place status on Telegram (`editMessageText`) with visual ASCII progress bars (`[████░░░░] 50%`) and step checklists (`⏳ -> ✅ -> ❌`) for multi-step pipelines and chained commands (`cmd1; cmd2; cmd3`), eliminating chat clutter.
- **Auto-Plim Mode (Transparent Shell Hook)**: Automatically monitors long-running commands (> 30s) and chained commands (`cmd1; cmd2; cmd3`) in Zsh, Bash, and Fish with sound and Telegram alerts, without having to type `plim run`.
- **Interactive Mobile Decisions (`plim ask`)**: Prompts you with interactive multiple-choice buttons on your phone via Telegram to approve migrations, deploys, or code changes while away from your desk.
- **MCP Server for AI Agents (`plim mcp` or `npx -y plim-mcp`)**: Native tools (`plim_notify`, `plim_ask`, `plim_run`, `plim_progress`) for Claude Desktop, Cursor, Windsurf, Cline, and Antigravity.
- **Internationalization (i18n)**: Full bilingual support for **English** and **Portuguese**, auto-detected from system locale or configurable via `plim lang [en|pt]`.
- **Instant Telegram Onboarding**: Open [@plim_the_bot](https://t.me/plim_the_bot), send `/start`, and link your terminal with `plim connect <token>`.
- **Unix Pipe Streaming (`| plim -n`)**: Pipe long outputs or confirmations directly into Plim.
- **Native Audio on macOS, Linux, and Windows**: Uses `/System/Library/Sounds` (`afplay`), Freedesktop sound themes, or Windows System Sounds.
- **Cloudflare Worker Backend**:
  - Official Telegram webhook with automatic token issuance.
  - State and quotas stored in Cloudflare KV (`token -> chat_id`, daily usage tracking).
  - Free tier (50 notifications/day) and Pro/Unlimited tier (Telegram Stars).
- **100% Multiplatform**:
  - 🍏 **macOS**: Native `afplay` and AppleScript notifications.
  - 🐧 **Linux**: `notify-send` and desktop audio (`paplay`/`aplay`/bell).
  - 🪟 **Windows**: WSL, Git Bash, and native PowerShell script (`plim.ps1`).
- **Self-Hosted Mode**: Use your own Telegram Bot token and chat ID directly via `plim config set`.

---

## 🚀 Quick Install

### macOS / Linux / Windows (WSL & Git Bash)
```bash
curl -fsSL https://raw.githubusercontent.com/marcusedu/plim/main/install.sh | bash
```

### Windows (Native PowerShell)
Clone the repository or add `bin` to your `$PATH`:
```powershell
.\bin\plim.ps1 connect <YOUR_TOKEN>
.\bin\plim.ps1 run npm run build
```

*(Or clone the repository and run `make link` for local development).*

### Connect with Telegram
1. Open the bot on Telegram: **[@plim_the_bot](https://t.me/plim_the_bot)** and tap `/start`.
2. The bot will send your personalized connection command:
   ```bash
   plim connect plim_live_...
   ```
3. Paste the command into your terminal. Done! A welcome confirmation will arrive on your phone.

---

## 📖 Usage Guide

### 1. Monitor long-running commands
Executes the command with real-time output, measures elapsed time, plays audio cues, and notifies both desktop and Telegram:

```bash
plim run npm run build
plim run docker compose up -d
plim run git push origin main
plim run cargo test
```

### 2. Interactive Questions with Telegram Buttons
Sends a question to your mobile phone with interactive buttons and blocks until you respond:

```bash
# Default options ("Yes" / "No")
plim ask "Deploy database migration to production?"

# Custom options
plim ask "Select deployment strategy:" "Canary" "Blue/Green" "Abort"
```

### 3. Dynamic Live Status & Chained Commands (`plim progress`)
Execute sequential chained commands with live in-place updates on Telegram without cluttering your chat:

```bash
# Execute chained commands with live visual progress on Telegram:
plim run --progress "flutter clean; npm run build:all; sleep 15; firebase deploy -P production"
# or
plim progress run "flutter clean; npm run build:all; sleep 15; firebase deploy -P production"

# Programmatic CLI usage for custom scripts:
ID=$(plim progress start "Release Pipeline" "Dependencies" "Build" "Tests" "Deploy")
plim progress update "$ID" --percent 25 --text "Compiling front-end assets..."
plim progress update "$ID" --percent 75 --text "Running automated test suites..."
plim progress finish "$ID" --status success --text "Deployed successfully to production! 🚀"
```

### 4. Auto-Plim Mode (Transparent Shell Hook)
Automatically monitor any long-running command or command chain that takes over 30 seconds, without needing to prefix with `plim run`:

```bash
# 1. 1-command install in your active shell (Zsh, Bash, or Fish):
plim hook install

# 2. Or manual activation in ~/.zshrc (or ~/.bashrc):
eval "$(plim hook zsh)"

# 3. Supports chained commands with ;, &&, or ||:
plim run flutter clean;npm run build:all;sleep 15;firebase deploy -P production
# ➔ When finished, you receive a phone alert:
# ⛓️ (4 commands) flutter clean ➔ npm run build:all ➔ sleep 15 ➔ firebase deploy -P production

# 4. Inspect status and active threshold:
plim hook status
```

### 5. One-off notifications or pipe streaming

```bash
# Standalone notification
plim -n "Staging deployment completed!"

# Via pipe (streams output and alerts on completion)
cat deploy.log | plim -n "Deploy finished"
```

### 6. Language Selection (i18n)
```bash
# View active language
plim lang

# Switch language to English or Portuguese
plim lang en
plim lang pt
```

### 7. Test your connection
```bash
plim test
```

### 8. Local audio effects

```bash
# Play random sound
plim

# Play specific sound
plim -p Ping
plim -p Hero
plim -p Glass

# List available sounds
plim -l
```

---

## 🤖 AI Agent & MCP Integration

Plim provides native **Model Context Protocol (MCP)** support and conforms to **`llms.txt`**. Autonomous AI agents (**Claude Code**, **Cursor**, **Windsurf**, **Cline**, **Antigravity**) can alert your phone when heavy workflows finish or ask for human review.

### 1. MCP Server Configuration (Claude Desktop, Cursor, Windsurf, Cline)
Add the configuration to your MCP config file (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "plim": {
      "command": "plim",
      "args": ["mcp"]
    }
  }
}
```

*Or run directly via `npx` (no prior CLI installation needed):*
```json
{
  "mcpServers": {
    "plim": {
      "command": "npx",
      "args": ["-y", "plim-mcp"]
    }
  }
}
```

The agent automatically receives three tools:
- **`plim_ask`**: Prompts the developer with interactive buttons on Telegram and waits for their choice.
- **`plim_run`**: Executes commands, monitors exit codes, sends duration and logs to Telegram, and provides an interactive [Retry] button if failed.
- **`plim_notify`**: Sends desktop alerts and instant Telegram push notifications with status levels.

### 2. Claude Code & Cursor Rules (via `CLAUDE.md`)
Add `CLAUDE.md` to your project root. The AI agent will automatically monitor commands, ask interactive questions, and notify your pocket when finished!

---

## ☁️ Project Structure

```text
plim/
├── bin/
│   ├── plim              # Executable CLI script (macOS, Linux, WSL)
│   ├── plim-mcp.js       # Stdio MCP Server for AI coding agents
│   └── plim.ps1          # Native PowerShell script for Windows
├── worker/               # Cloudflare Worker backend (TypeScript + Hono)
│   ├── src/
│   │   └── index.ts      # Telegram Webhook + Interactive Questions + i18n
│   ├── wrangler.toml     # KV bindings and environment variables
│   ├── package.json
│   └── README.md         # Worker deployment guide
├── install.sh            # One-line curl installer
├── Makefile              # make install / link / test commands
├── README.md             # English documentation
└── README.pt-BR.md       # Portuguese documentation
```

---

## 🛠️ CLI Commands Reference

| Command | Description |
| --- | --- |
| `plim ask <question> [options]` | Send interactive Telegram question with buttons and wait for answer |
| `plim run <command>` | Run command, track time, detect status, and send logs |
| `plim run --progress <cmds>` | Run chained commands with dynamic Live Status on Telegram |
| `plim progress run <cmds>` | Run chained commands with dynamic Live Status on Telegram |
| `plim progress start/update/...` | Programmatically manage live in-place progress on Telegram |
| `plim hook [zsh\|bash\|fish]` | Output Auto-Plim shell hook script for specified shell |
| `plim hook install` | Install Auto-Plim hook into current shell profile |
| `plim hook status` | Display active Auto-Plim status and configuration |
| `plim hook test` | Simulate an Auto-Plim notification for a long-running command |
| `plim connect <token>` | Link terminal to [@plim_the_bot](https://t.me/plim_the_bot) |
| `plim lang [en\|pt]` | Display or set CLI display language |
| `plim mcp` | Launch MCP server for AI coding agents |
| `plim [message]` | Quick notification (e.g. `plim 'Build complete'`) |
| `plim -n [message]` | Trigger desktop sound and Telegram push notification |
| `command \| plim` | Stream pipe output and alert upon completion |
| `command \| plim 'Deploy'` | Stream pipe output and notify with custom title |
| `plim update` | Upgrade Plim to the latest version from GitHub |
| `plim version` / `-v` | Display currently installed Plim version |
| `plim test` | Test audio cues, desktop banner, and Telegram delivery |
| `plim config` | Display active configuration |
| `plim config set-url <url>` | Override Worker API URL |
| `plim config set <token> <id>` | Configure direct custom Telegram bot (self-hosted) |
| `plim` / `plim -r` | Play random system sound |
| `plim -p <sound>` | Play specific system sound |
| `plim -l` | List available sounds |

---

## 📄 License

Distributed under the MIT License.
