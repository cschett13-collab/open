@echo off
REM ============================================================
REM   Alpha Terminal - one-click start for Windows (your 5090 PC)
REM   Just double-click this file. Nothing gets installed.
REM ============================================================
setlocal
cd /d "%~dp0"

REM --- Check that Node.js is installed -------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed yet.
  echo.
  echo   1. Go to https://nodejs.org
  echo   2. Download the big green "LTS" button and install it
  echo      ^(keep clicking Next / Install^).
  echo   3. Then double-click this file again.
  echo.
  pause
  exit /b 1
)

REM --- OPTIONAL: turn on the RTX 5090 local AI briefing --------
REM If you have installed Ollama (https://ollama.com) and run:
REM     ollama pull llama3
REM then delete the word REM at the start of the next two lines:
REM set ALPHA_AI=ollama
REM set ALPHA_AI_MODEL=llama3

echo.
echo   Starting Alpha Terminal... a browser-ready dashboard will run here.
echo   Leave this window open. Close it (or press Ctrl+C) to stop.
echo.

node start.js

echo.
echo   Alpha Terminal stopped.
pause
