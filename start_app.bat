@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  py serve_app.py
) else (
  python serve_app.py
)
endlocal
