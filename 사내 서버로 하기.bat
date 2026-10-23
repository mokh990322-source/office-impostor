@echo off
cd /d "%~dp0"
rem 사내망 서버: 창이 뜨고, 동료에게 알려 줄 주소가 보입니다. 창을 닫으면 서버가 꺼집니다.
where pythonw >nul 2>nul
if %errorlevel%==0 (
  start "" pythonw lan_server.py
) else (
  start "" python lan_server.py
)
