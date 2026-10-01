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
    }
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
    "run" {
        if (-not $Arguments) {
            Write-Host "Uso: plim run <comando e argumentos>" -ForegroundColor Yellow
            return
        }

        $cmdStr = $Arguments -join " "
        Write-Host "🚀 [plim] Executando: $cmdStr" -ForegroundColor Cyan

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
            $statusText = "Sucesso"
            $soundType = "success"
        } else {
            $icon = "❌"
            $statusText = "Falha (exit $exitCode)"
            $soundType = "error"
        }

        Play-Sound $soundType
        Show-Toast "$icon Plim: $statusText" "$cmdStr`nDuração: $durStr"
        Send-RemoteNotify "$icon $statusText: $cmdStr" "" $output $durStr $soundType
    }

    "connect" {
        $token = $Arguments[0]
        if (-not $token) {
            Write-Host "Uso: plim connect <SEU_TOKEN>" -ForegroundColor Yellow
            return
        }

        $cfg = Load-Config
        $cfg.PLIM_API_KEY = $token
        Save-Config $cfg

        Write-Host "✅ Token salvo com sucesso!" -ForegroundColor Green
        Write-Host "📡 Validando no Plim Cloud..." -ForegroundColor Cyan

        try {
            $apiUrl = if ($cfg.PLIM_API_URL) { $cfg.PLIM_API_URL } else { $DefaultApiUrl }
            $res = Invoke-RestMethod -Uri "$apiUrl/api/connect" -Method Post -Headers @{ "Content-Type" = "application/json" } -Body (@{ token = $token } | ConvertTo-Json)
            if ($res.ok) {
                Write-Host "🎉 Terminal conectado com sucesso! Verifique seu Telegram." -ForegroundColor Green
            }
        } catch {
            Write-Host "⚠️ Salvo localmente. Teste com: plim test" -ForegroundColor Yellow
        }
    }

    "-n" {
        $msg = $Arguments -join " "
        $piped = if ($input) { ($input | Out-String).Trim() } else { "" }
        if ($piped) {
            Write-Output $piped
            $lines = $piped -split "`r?`n"
            $tail = ($lines | Select-Object -Last 15) -join "`n"
            Play-Sound "success"
            $toastMsg = if ($msg) { $msg } else { "Pipe concluído" }
            Show-Toast "Plim" $toastMsg
            Send-RemoteNotify "🔔 Plim: $toastMsg" "" $tail "" "info"
        } else {
            Play-Sound "success"
            Show-Toast "Plim" $msg
            Send-RemoteNotify "🔔 Plim: $msg" "" "" "" "info"
        }
    }

    "test" {
        Write-Host "🔊 Testando som..." -ForegroundColor Cyan
        Play-Sound "success"
        Show-Toast "Plim" "Teste de notificação local!"

        $cfg = Load-Config
        if ($cfg.PLIM_API_KEY) {
            Write-Host "📱 Enviando notificação para o Telegram..." -ForegroundColor Cyan
            Send-RemoteNotify "🔔 Teste do Plim" "Notificação enviada do Windows via PowerShell! 🎉" "" "" "info"
            Write-Host "✅ Notificação enviada!" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Conecte sua conta com: plim connect <token>" -ForegroundColor Yellow
        }
    }

    "config" {
        $cfg = Load-Config
        Write-Host "Configuração do Plim:" -ForegroundColor Cyan
        Write-Host "Arquivo: $ConfigFile"
        Write-Host ($cfg | ConvertTo-Json)
    }

    Default {
        Write-Host "Uso do Plim (PowerShell):" -ForegroundColor Cyan
        Write-Host "  plim run <comando>       # Roda o comando, mede tempo e avisa no Telegram"
        Write-Host "  plim connect <token>     # Conecta ao @plim_the_bot"
        Write-Host "  plim -n 'Mensagem'       # Notificação avulsa"
        Write-Host "  plim test                # Testa sons e Telegram"
        Write-Host "  plim config              # Mostra configurações"
    }
}
