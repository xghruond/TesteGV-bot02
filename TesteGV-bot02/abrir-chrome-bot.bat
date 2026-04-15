@echo off
REM ============================================================
REM  Abrir Chrome em modo CDP (Chrome DevTools Protocol)
REM  Uso: duplo clique neste arquivo antes de iniciar o bot.
REM  O bot vai se conectar a este Chrome para usar o sms24.me
REM  (evita o bloqueio Cloudflare que ocorre com Playwright).
REM ============================================================

echo.
echo ====================================================
echo   Green BOT - Chrome CDP Mode
echo ====================================================
echo.
echo  Abrindo Chrome com debug port 9222...
echo  Perfil isolado: C:\chrome-bot
echo.
echo  INSTRUCOES:
echo  1. Aguarde o Chrome abrir
echo  2. Navegue ate https://sms24.me/
echo  3. Se aparecer Cloudflare, resolva (clique "Verify")
echo  4. Deixe a aba do sms24.me aberta
echo  5. Va no painel Green BOT e inicie o onboarding
echo.
echo  NAO feche esta janela do Chrome enquanto o bot roda!
echo ====================================================
echo.

REM Criar pasta do perfil se nao existir
if not exist "C:\chrome-bot" mkdir "C:\chrome-bot"

REM Abrir Chrome com debug port e perfil isolado
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir=C:\chrome-bot ^
  --no-first-run ^
  --no-default-browser-check ^
  https://sms24.me/

echo.
echo Chrome aberto! Aguarde 3 segundos e feche esta janela.
ping 127.0.0.1 -n 4 >nul
exit
