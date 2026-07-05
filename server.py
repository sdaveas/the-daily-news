#!/usr/bin/env python3
import http.server, os, subprocess, json, threading, time

WWW = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'www')
FETCH_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fetch-news.py')
FEEDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'feeds.json')
NEWS_PATH = os.path.join(WWW, 'data', 'news.json')
STALE_SECS = 4 * 3600

def is_stale():
    if not os.path.exists(NEWS_PATH):
        return True
    return (time.time() - os.path.getmtime(NEWS_PATH)) > STALE_SECS

def trigger_fetch():
    subprocess.run(['python3', FETCH_SCRIPT], capture_output=True, timeout=60)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WWW, **kw)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type')

    def do_GET(self):
        if self.path == '/config':
            self.send_response(200)
            self.send_header('Content-Type','application/json')
            self._cors()
            self.end_headers()
            with open(FEEDS_PATH) as f:
                self.wfile.write(f.read().encode())
            return
        if self.path == '/' or self.path == '/index.html':
            if is_stale():
                threading.Thread(target=trigger_fetch, daemon=True).start()
        super().do_GET()

    def do_POST(self):
        if self.path == '/refresh':
            threading.Thread(target=self._trigger, daemon=True).start()
            self.send_response(202)
            self.send_header('Content-Type','application/json')
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({'ok':True,'msg':'Refresh triggered. Reload in ~30s.'}).encode())
            return
        if self.path == '/config':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length else b''
            try:
                data = json.loads(body)
                with open(FEEDS_PATH, 'w') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                self.send_response(200)
                self.send_header('Content-Type','application/json')
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({'ok':True}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type','application/json')
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({'ok':False,'error':str(e)}).encode())
            return
        self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _trigger(self):
        subprocess.run(['python3', FETCH_SCRIPT], capture_output=True, timeout=60)

if __name__=='__main__':
    if is_stale():
        threading.Thread(target=trigger_fetch, daemon=True).start()
    http.server.HTTPServer(('0.0.0.0',8090), Handler).serve_forever()