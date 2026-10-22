@echo off
title 사무실 임포스터 - 이 창을 닫으면 게임이 꺼집니다
cd /d "%~dp0"

echo.
echo   ==========================================
echo      사무실 임포스터
echo   ==========================================
echo.
echo   서버를 켜는 중입니다. 브라우저가 곧 열립니다.
echo   안 열리면 주소창에 직접:  http://localhost:8897/
echo.
echo   * 동료와 하려면: 방 만들기 - 방 코드 4자리를 불러 주기
echo   * 게임을 끝내려면 이 창을 닫으세요.
echo.

start /b "" powershell -NoProfile -Command "Start-Sleep -Milliseconds 1200; Start-Process 'http://localhost:8897/'"
python -m http.server 8897

echo.
echo   서버가 꺼졌습니다. 파이썬이 설치되어 있는지 확인하세요.
pause
