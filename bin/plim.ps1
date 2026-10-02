<#
.SYNOPSIS
    Plim - CLI de produtividade para Windows PowerShell
.DESCRIPTION
    Monitora tarefas longas, emite sons nativos e envia alertas locais e via Telegram.
#>

param (
    [Parameter(Position=0)]
    [string]$Action = "help",

    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$Arguments
)

$ConfigDir = "$HOME\.config\plim"
$ConfigFile = "$ConfigDir\config.json"
$DefaultApiUrl = "https://plim-api.marcusedu.workers.dev"

function Load-Config {
    if (Test-Path $ConfigFile) {
        return Get-Content $ConfigFile | ConvertFrom-Json
    }
    return [PSCustomObject]@{
        PLIM_API_KEY = $null
        PLIM_API_URL = $DefaultApiUrl
        PLIM_LANG = $null
    }
}

function Get-PlimLang {
    $cfg = Load-Config
    if ($cfg.PLIM_LANG) { return $cfg.PLIM_LANG }
    if ($env:PLIM_LANG) { return $env:PLIM_LANG }
    try {
        $culture = [System.Globalization.CultureInfo]::CurrentCulture.TwoLetterISOLanguageName
        if ($culture -eq "pt") { return "pt" }
    } catch {}
    return "en"
}

function Save-Config ($config) {
    if (-not (Test-Path $ConfigDir)) {
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    }
    $config | ConvertTo-Json | Set-Content $ConfigFile
}

function Play-Sound ($type) {
    try {
        if ($type -eq "error") {
            [System.Media.SystemSounds]::Hand.Play()
        } else {
            [System.Media.SystemSounds]::Asterisk.Play()
        }
    } catch {
        [console]::beep()
    }
}

function Show-Toast ($title, $message) {
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName("text")
        $textNodes.Item(0).AppendChild($template.CreateTextNode($title)) | Out-Null
        $textNodes.Item(1).AppendChild($template.CreateTextNode($message)) | Out-Null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Plim").Show($toast)
    } catch {}
}

function Send-RemoteNotify ($title, $body, $log, $duration, $status) {
    $cfg = Load-Config
    if ($cfg.PLIM_API_KEY) {
        $apiUrl = if ($cfg.PLIM_API_URL) { $cfg.PLIM_API_URL } else { $DefaultApiUrl }
        $payload = @{
            title = $title
            body = $body
            log = $log
            duration = $duration
            status = $status
        } | ConvertTo-Json

        try {
            Invoke-RestMethod -Uri "$apiUrl/api/notify" -Method Post -Headers @{
                "Authorization" = "Bearer $($cfg.PLIM_API_KEY)"
                "Content-Type" = "application/json"
            } -Body $payload | Out-Null
        } catch {}
    }
}

switch ($Action.ToLower()) {
    "lang" {
        $newLang = $Arguments[0]
        $currentLang = Get-PlimLang
        if (-not $newLang) {
            if ($currentLang -eq "pt") {
                Write-Host "Idioma atual: Português (pt)" -ForegroundColor Cyan
                Write-Host "Para alterar: plim lang en"
            } else {
                Write-Host "Current language: English (en)" -ForegroundColor Cyan
                Write-Host "To change: plim lang pt"
            }
            return
        }

        if ($newLang -match "^(pt|pt-BR|pt_BR|portugues|portuguese)$") {
            $newLang = "pt"
        } elseif ($newLang -match "^(en|en-US|en_US|english|ingles)$") {
            $newLang = "en"
        } else {
            Write-Host "Invalid language: $newLang (supported: en, pt)" -ForegroundColor Red
            return
        }

        $cfg = Load-Config
        $cfg | Add-Member -NotePropertyName "PLIM_LANG" -NotePropertyValue $newLang -Force
        Save-Config $cfg

        if ($newLang -eq "pt") {
            Write-Host "✅ Idioma configurado para Português (pt)." -ForegroundColor Green
        } else {
            Write-Host "✅ Language configured to English (en)." -ForegroundColor Green
        }
    }

    "run" {
        $lang = Get-PlimLang
        if (-not $Arguments) {
            if ($lang -eq "pt") {
                Write-Host "Uso: plim run <comando e argumentos>" -ForegroundColor Yellow
            } else {
                Write-Host "Usage: plim run <command and arguments>" -ForegroundColor Yellow
            }
            return
        }

        $cmdStr = $Arguments -join " "
        if ($lang -eq "pt") {
            Write-Host "🚀 [plim] Executando: $cmdStr" -ForegroundColor Cyan
        } else {
            Write-Host "🚀 [plim] Running: $cmdStr" -ForegroundColor Cyan
        }

        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $tempFile = [System.IO.Path]::GetTempFileName()

        # Executa gravando saída
        $process = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-Command", "$cmdStr" -NoNewWindow -Wait -PassThru -RedirectStandardOutput $tempFile -RedirectStandardError "$tempFile.err"
        $sw.Stop()

        $elapsed = $sw.Elapsed
        $durStr = if ($elapsed.TotalHours -ge 1) { "{0:D1}h {1:D2}m {2:D2}s" -f $elapsed.Hours, $elapsed.Minutes, $elapsed.Seconds }
                  elseif ($elapsed.TotalMinutes -ge 1) { "{0:D1}m {1:D2}s" -f $elapsed.Minutes, $elapsed.Seconds }
                  else { "{0:D1}s" -f [int]$elapsed.TotalSeconds }

        $output = ""
        if (Test-Path $tempFile) {
            $output = (Get-Content $tempFile -Tail 15 -ErrorAction SilentlyContinue) -join "`n"
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path "$tempFile.err") {
            $errContent = (Get-Content "$tempFile.err" -Tail 15 -ErrorAction SilentlyContinue) -join "`n"
            if ($errContent) { $output += "`n$errContent" }
            Remove-Item "$tempFile.err" -Force -ErrorAction SilentlyContinue
        }

        $exitCode = $process.ExitCode
        if ($exitCode -eq 0) {
            $icon = "✅"
            $statusText = if ($lang -eq "pt") { "Sucesso" } else { "Success" }
            $soundType = "success"
        } else {
            $icon = "❌"
            $statusText = if ($lang -eq "pt") { "Falha (exit $exitCode)" } else { "Failed (exit $exitCode)" }
            $soundType = "error"
        }

        Play-Sound $soundType
        $durPrefix = if ($lang -eq "pt") { "Duração" } else { "Duration" }
        Show-Toast "$icon Plim: $statusText" "$cmdStr`n$durPrefix: $durStr"
        Send-RemoteNotify "$icon $statusText: $cmdStr" "" $output $durStr $soundType
    }

    "connect" {
        $lang = Get-PlimLang
        $token = $Arguments[0]
        if (-not $token) {
            if ($lang -eq "pt") {
                Write-Host "Uso: plim connect <SEU_TOKEN>" -ForegroundColor Yellow
            } else {
                Write-Host "Usage: plim connect <YOUR_TOKEN>" -ForegroundColor Yellow
            }
            return
        }

        $cfg = Load-Config
        $cfg.PLIM_API_KEY = $token
        Save-Config $cfg

        if ($lang -eq "pt") {
            Write-Host "✅ Token salvo com sucesso!" -ForegroundColor Green
            Write-Host "📡 Validando no Plim Cloud..." -ForegroundColor Cyan
        } else {
            Write-Host "✅ Token saved successfully!" -ForegroundColor Green
            Write-Host "📡 Validating with Plim Cloud..." -ForegroundColor Cyan
        }

        try {
            $apiUrl = if ($cfg.PLIM_API_URL) { $cfg.PLIM_API_URL } else { $DefaultApiUrl }
            $res = Invoke-RestMethod -Uri "$apiUrl/api/connect" -Method Post -Headers @{ "Content-Type" = "application/json" } -Body (@{ token = $token } | ConvertTo-Json)
            if ($res.ok) {
                if ($lang -eq "pt") {
                    Write-Host "🎉 Terminal conectado com sucesso! Verifique seu Telegram." -ForegroundColor Green
                } else {
                    Write-Host "🎉 Terminal connected successfully! Check your Telegram." -ForegroundColor Green
                }
            }
        } catch {
            if ($lang -eq "pt") {
                Write-Host "⚠️ Salvo localmente. Teste com: plim test" -ForegroundColor Yellow
            } else {
                Write-Host "⚠️ Saved locally. Test with: plim test" -ForegroundColor Yellow
            }
        }
    }

    "-n" {
        $lang = Get-PlimLang
        $msg = $Arguments -join " "
        $piped = if ($input) { ($input | Out-String).Trim() } else { "" }
        if ($piped) {
            Write-Output $piped
            $lines = $piped -split "`r?`n"
            $tail = ($lines | Select-Object -Last 15) -join "`n"
            Play-Sound "success"
            $defaultPipe = if ($lang -eq "pt") { "Pipe concluído" } else { "Pipe completed" }
            $toastMsg = if ($msg) { $msg } else { $defaultPipe }
            Show-Toast "Plim" $toastMsg
            Send-RemoteNotify "🔔 Plim: $toastMsg" "" $tail "" "info"
        } else {
            Play-Sound "success"
            Show-Toast "Plim" $msg
            Send-RemoteNotify "🔔 Plim: $msg" "" "" "" "info"
        }
    }

    "test" {
        $lang = Get-PlimLang
        if ($lang -eq "pt") {
            Write-Host "🔊 Testando som..." -ForegroundColor Cyan
            Play-Sound "success"
            Show-Toast "Plim" "Teste de notificação local!"
        } else {
            Write-Host "🔊 Testing sound..." -ForegroundColor Cyan
            Play-Sound "success"
            Show-Toast "Plim" "Local notification test!"
        }

        $cfg = Load-Config
        if ($cfg.PLIM_API_KEY) {
            if ($lang -eq "pt") {
                Write-Host "📱 Enviando notificação para o Telegram..." -ForegroundColor Cyan
                Send-RemoteNotify "🔔 Teste do Plim" "Notificação enviada do Windows via PowerShell! 🎉" "" "" "info"
                Write-Host "✅ Notificação enviada!" -ForegroundColor Green
            } else {
                Write-Host "📱 Sending notification to Telegram..." -ForegroundColor Cyan
                Send-RemoteNotify "🔔 Plim Test" "Notification sent from Windows via PowerShell! 🎉" "" "" "info"
                Write-Host "✅ Notification sent!" -ForegroundColor Green
            }
        } else {
            if ($lang -eq "pt") {
                Write-Host "⚠️ Conecte sua conta com: plim connect <token>" -ForegroundColor Yellow
            } else {
                Write-Host "⚠️ Connect your account with: plim connect <token>" -ForegroundColor Yellow
            }
        }
    }

    "config" {
        $cfg = Load-Config
        Write-Host "Plim Config:" -ForegroundColor Cyan
        Write-Host "File: $ConfigFile"
        Write-Host ($cfg | ConvertTo-Json)
    }

    Default {
        $lang = Get-PlimLang
        if ($lang -eq "pt") {
            Write-Host "Uso do Plim (PowerShell):" -ForegroundColor Cyan
            Write-Host "  plim run <comando>       # Roda o comando, mede tempo e avisa no Telegram"
            Write-Host "  plim connect <token>     # Conecta ao @plim_the_bot"
            Write-Host "  plim lang [en|pt]        # Exibe ou altera o idioma"
            Write-Host "  plim -n 'Mensagem'       # Notificação avulsa"
            Write-Host "  plim test                # Testa sons e Telegram"
            Write-Host "  plim config              # Mostra configurações"
        } else {
            Write-Host "Plim Usage (PowerShell):" -ForegroundColor Cyan
            Write-Host "  plim run <command>       # Run command, measure time and alert on Telegram"
            Write-Host "  plim connect <token>     # Connect to @plim_the_bot"
            Write-Host "  plim lang [en|pt]        # Display or change language"
            Write-Host "  plim -n 'Message'        # Send notification"
            Write-Host "  plim test                # Test sounds and Telegram"
            Write-Host "  plim config              # Show configuration"
        }
    }
}
