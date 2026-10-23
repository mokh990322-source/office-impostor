@echo off
title 모몽어스 - 혼자 시험 (봇 5명)
cd /d "%~dp0"

echo.
echo   혼자 시험 모드입니다. 봇 5명과 함께 한 판을 돌려 볼 수 있어요.
echo   인터넷(Firebase)에는 연결하지 않습니다.
echo   이 창을 닫으면 꺼집니다.
echo.

start /b "" powershell -NoProfile -Command "Start-Sleep -Milliseconds 1200; Start-Process 'http://localhost:8897/?local&bots=5'"
python -m http.server 8897

echo.
echo   서버가 꺼졌습니다. 파이썬이 설치되어 있는지 확인하세요.
pause
