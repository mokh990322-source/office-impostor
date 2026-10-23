/* ============================================================
   모몽어스 — 접속 주소

   기본은 Firebase (퇴근의 계단·모코파크와 같은 프로젝트, crew/ 아래만).
   scores/ (사내 랭킹), rooms/ (모코파크)는 절대 건드리지 않는다.

   사내망 모드: 방장 PC 의 lan_server.py 가 게임을 포트 8898 로 내준다.
   그 주소로 열렸으면 같은 서버의 /db 를 Firebase 대신 쓴다.
   (lan_server.py 는 Firebase 의 REST·스트리밍을 그대로 흉내 내서 net.js 는 그대로다.)
   ============================================================ */
(function (global) {
  'use strict';
  var loc = global.location || {};
  if (String(loc.port) === '8898' && loc.origin) {
    global.CLOUD_URL = loc.origin + '/db';
    global.LAN_MODE = true;
  } else {
    global.CLOUD_URL = 'https://mohag-8a5b8-default-rtdb.asia-southeast1.firebasedatabase.app';
    global.LAN_MODE = false;
  }
})(window);
