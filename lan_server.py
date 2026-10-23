# -*- coding: utf-8 -*-
"""
모몽어스 — 사내망 서버

방장 PC 에서 켠다. 두 가지 일을 한다.
  1) 게임 파일(index.html, js, css, img)을 내준다.  http://<이 PC 주소>:8898/
  2) /db/ 아래에서 Firebase Realtime Database 의 REST + 스트리밍(SSE) 을 흉내 낸다.
     게임의 net.js 는 Firebase 에 붙을 때와 똑같이 GET/PUT/DELETE 와 EventSource 를 쓴다.
     그래서 게임 코드는 주소(cloud-config.js)만 바꾸면 된다.

Firebase 와 같게 맞춘 것
  - 빈 배열·빈 객체는 저장하지 않는다(사라진다). 게임은 이미 이걸 전제로 짜여 있다.
  - 스트림 첫 이벤트는 put "/" 로 현재 전체, 이후 쓰기는 지켜보는 경로 기준 상대 경로로.
다른 것
  - 규칙(validate) 검사는 없다. 사내망 안에서 crew/ 아래만 받는다.

외부 라이브러리 없이 파이썬 기본 모듈만 쓴다.
`--headless` 를 주면 창 없이 돈다(시험용).
"""
import json
import os
import queue
import socket
import sys
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, unquote

PORT = 8898
ROOT = os.path.dirname(os.path.abspath(__file__))
ALLOWED_TOP = ('crew',)

_lock = threading.Lock()
_db = None
_watchers = []          # [(parts, queue)]


def _segs(path):
    return [s for s in path.split('/') if s]


def _prune(v):
    """Firebase 처럼 빈 배열·빈 객체·None 을 지운다."""
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            c = _prune(x)
            if c is not None:
                out[k] = c
        return out or None
    if isinstance(v, list):
        if not v:
            return None
        return [_prune(x) for x in v]
    return v


def _get(parts):
    node = _db
    for p in parts:
        if not isinstance(node, dict) or p not in node:
            return None
        node = node[p]
    return node


def _set(parts, value):
    global _db
    if not parts:
        _db = _prune(value)
        return
    root = _db if isinstance(_db, dict) else {}
    node = root
    for p in parts[:-1]:
        nxt = node.get(p)
        if not isinstance(nxt, dict):
            nxt = {}
            node[p] = nxt
        node = nxt
    if value is None:
        node.pop(parts[-1], None)
    else:
        node[parts[-1]] = value
    _db = _prune(root)


def write(path, value):
    parts = _segs(path)
    with _lock:
        _set(parts, value)
        for wparts, q in list(_watchers):
            n = min(len(wparts), len(parts))
            if wparts[:n] != parts[:n]:
                continue                        # 서로 다른 가지
            if len(parts) >= len(wparts):       # 지켜보는 곳 아래가 바뀜
                rel = '/' + '/'.join(parts[len(wparts):])
                q.put(('put', {'path': rel, 'data': _get(parts)}))
            else:                               # 지켜보는 곳 위가 통째로 바뀜
                q.put(('put', {'path': '/', 'data': _get(wparts)}))


def clients():
    with _lock:
        return len(_watchers)


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        # 게임 파일이 바뀌면 바로 반영되게 캐시하지 않는다(사내망이라 부담 없다).
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _db_path(self):
        p = unquote(urlparse(self.path).path)
        if not p.startswith('/db/') and p != '/db':
            return None
        p = p[3:]
        if p.endswith('.json'):
            p = p[:-5]
        parts = _segs(p)
        if parts and parts[0] not in ALLOWED_TOP:
            return False
        return '/'.join(parts)

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = self._db_path()
        if p is None:
            return super().do_GET()
        if p is False:
            return self._json(403, {'error': 'Permission denied'})
        if 'text/event-stream' in (self.headers.get('Accept') or ''):
            return self._stream(p)
        with _lock:
            data = _get(_segs(p))
        self._json(200, data)

    def do_PUT(self):
        # 본문은 거절하더라도 먼저 다 읽는다. 안 읽고 응답하면 같은 연결의 다음 요청이
        # 남은 본문과 섞여 엉뚱하게 처리된다(연결 재사용).
        n = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(n) if n else b''
        p = self._db_path()
        if not p:
            return self._json(403, {'error': 'Permission denied'})
        try:
            value = json.loads(raw.decode('utf-8') or 'null')
        except ValueError:
            return self._json(400, {'error': 'bad json'})
        write(p, value)
        self._json(200, value)

    def do_DELETE(self):
        p = self._db_path()
        if not p:
            return self._json(403, {'error': 'Permission denied'})
        write(p, None)
        self._json(200, None)

    def _stream(self, p):
        q = queue.Queue()
        parts = _segs(p)
        with _lock:
            _watchers.append((parts, q))
            first = _get(parts)
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Transfer-Encoding', 'chunked')
        self.end_headers()
        self.close_connection = True

        def send(ev, data):
            # HTTP/1.1 chunked: 조각마다 길이를 알려 줘야 받는 쪽이 끝을 기다리지 않고 바로 읽는다.
            msg = ('event: %s\ndata: %s\n\n' % (ev, json.dumps(data, ensure_ascii=False, separators=(',', ':')))).encode('utf-8')
            self.wfile.write(('%x\r\n' % len(msg)).encode('ascii') + msg + b'\r\n')
            self.wfile.flush()

        try:
            send('put', {'path': '/', 'data': first})
            while True:
                try:
                    ev, data = q.get(timeout=20)
                    send(ev, data)
                except queue.Empty:
                    send('keep-alive', None)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            with _lock:
                if (parts, q) in _watchers:
                    _watchers.remove((parts, q))


def lan_addresses():
    """이 PC 의 사내망 IPv4 주소들. 동료에게 알려 줄 주소다."""
    found = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))       # 실제로 보내지 않는다. 기본 경로의 내 주소만 얻는다.
        found.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in found and not ip.startswith('127.') and not ip.startswith('169.254.'):   # 169.254 = 연결 안 된 어댑터
                found.append(ip)
    except OSError:
        pass
    return found or ['127.0.0.1']


class Server(ThreadingHTTPServer):
    # 윈도우에서 주소 재사용을 켜 두면 같은 포트에 서버가 둘 붙고, 요청이 둘로 갈라져
    # 쓰기와 스트림이 서로 다른 서버로 간다. 두 번째 서버는 아예 못 뜨게 막는다.
    allow_reuse_address = False


def start_server(port=PORT):
    httpd = Server(('0.0.0.0', port), Handler)
    httpd.daemon_threads = True
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def run_gui(httpd, port, selftest=False):
    import tkinter as tk
    import webbrowser

    urls = ['http://%s:%d/' % (ip, port) for ip in lan_addresses()]
    root = tk.Tk()
    root.title('모몽어스 — 사내망 서버')
    root.configure(bg='#1d2230')
    root.geometry('520x360')
    font = ('Malgun Gothic', 11)
    big = ('Malgun Gothic', 16, 'bold')

    tk.Label(root, text='사내망 서버가 켜져 있어요', font=big, fg='#ffde3b', bg='#1d2230').pack(pady=(16, 4))
    tk.Label(root, text='동료에게 아래 주소를 보내 주세요. 이 창을 닫으면 서버가 꺼져요.',
             font=font, fg='#cfd6e6', bg='#1d2230').pack()

    box = tk.Frame(root, bg='#1d2230')
    box.pack(pady=10, fill='x', padx=20)
    for u in urls:
        row = tk.Frame(box, bg='#2b3245')
        row.pack(fill='x', pady=3)
        tk.Label(row, text=u, font=('Consolas', 13, 'bold'), fg='#ffffff', bg='#2b3245').pack(side='left', padx=10, pady=6)

        def copy(u=u):
            root.clipboard_clear()
            root.clipboard_append(u)
            status.set('복사했어요: ' + u)
        tk.Button(row, text='복사', font=font, command=copy).pack(side='right', padx=8)

    status = tk.StringVar(value='')
    count = tk.StringVar(value='')
    tk.Label(root, textvariable=count, font=font, fg='#5be07a', bg='#1d2230').pack()
    tk.Label(root, textvariable=status, font=font, fg='#cfd6e6', bg='#1d2230').pack()

    btns = tk.Frame(root, bg='#1d2230')
    btns.pack(side='bottom', pady=14)
    tk.Button(btns, text='게임 열기', font=big, width=10,
              command=lambda: webbrowser.open('http://localhost:%d/' % port)).pack(side='left', padx=6)

    def stop():
        status.set('끄는 중…')
        root.after(50, root.destroy)
    tk.Button(btns, text='서버 끄기', font=big, width=10, command=stop).pack(side='left', padx=6)

    def tick():
        n = clients()
        count.set('● 연결된 화면 %d개' % n if n else '○ 아직 아무도 연결하지 않았어요')
        root.after(1000, tick)
    tick()
    root.protocol('WM_DELETE_WINDOW', stop)
    if selftest:
        root.after(1500, root.destroy)          # 점검용: 창만 띄웠다 닫는다, 브라우저는 안 연다
    else:
        root.after(800, lambda: webbrowser.open('http://localhost:%d/' % port))
    root.mainloop()
    httpd.shutdown()


def main():
    headless = '--headless' in sys.argv
    selftest = '--selftest' in sys.argv
    port = PORT
    for a in sys.argv[1:]:
        if a.startswith('--port='):
            port = int(a.split('=', 1)[1])
    try:
        httpd = start_server(port)
    except OSError as e:
        msg = '포트 %d 를 열 수 없어요. 서버가 이미 켜져 있는지 확인하세요. (%s)' % (port, e)
        if headless:
            print(msg)
        else:
            import tkinter.messagebox as mb
            mb.showerror('모몽어스', msg)
        sys.exit(1)
    if headless:
        print('READY', port, flush=True)
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            httpd.shutdown()
    else:
        run_gui(httpd, port, selftest)
        if selftest:
            print('GUI OK', ', '.join(lan_addresses()))


if __name__ == '__main__':
    main()
