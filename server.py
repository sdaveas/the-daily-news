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

import urllib.request, re

COMMON_PATHS = ['/feed','/feed/','/rss','/rss.xml','/feed.xml','/atom.xml','/rss/']

def try_fetch(url, timeout=8):
    """Return (is_xml, items_count, error)"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'DailyNews/1.0 (+local)'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read(4096).decode('utf-8', errors='replace')
        is_rss = '<rss' in body or '<feed' in body or '<?xml' in body
        if is_rss:
            count = body.count('<item') + body.count('<entry')
            return True, count, None
        return False, 0, None
    except Exception as e:
        return False, 0, str(e)

def check_feed(url):
    """Check if URL is valid RSS. If not, try to discover the feed."""
    if not url:
        return {'ok':False,'error':'No URL provided'}

    # Try the URL directly
    is_xml, count, err = try_fetch(url)
    if is_xml:
        return {'ok':True,'url':url,'items':count,'msg':'Valid RSS feed, %d items found' % count}

    # If not XML, try to discover feed from common paths
    if not url.startswith('http'):
        url = 'https://' + url
    base = url.rstrip('/').split('?')[0]
    # strip known feed paths
    for p in COMMON_PATHS:
        if base.endswith(p):
            base = base[:-len(p)]
    base = base.rstrip('/')

    # Check HTML for <link rel="alternate"> tags
    try:
        req = urllib.request.Request(base, headers={'User-Agent':'DailyNews/1.0 (+local)'})
        with urllib.request.urlopen(req, timeout=8) as r:
            html = r.read(16384).decode('utf-8', errors='replace')
        links = re.findall(r'<link[^>]*rel=["\']alternate["\'][^>]*>', html, re.I)
        for link in links:
            href = re.search(r'href=["\']([^"\']+)["\']', link, re.I)
            type_attr = re.search(r'type=["\']([^"\']+)["\']', link, re.I)
            if href and type_attr and ('rss' in type_attr.group(1) or 'atom' in type_attr.group(1)):
                found_url = href.group(1)
                if found_url.startswith('/'):
                    found_url = base + found_url
                is_xml2, count2, _ = try_fetch(found_url)
                if is_xml2:
                    return {'ok':True,'url':found_url,'items':count2,'discovered':True,'msg':'Discovered feed: %s (%d items)' % (found_url, count2)}
    except Exception:
        pass

    # Try common paths
    for path in COMMON_PATHS:
        candidate = base + path
        is_xml3, count3, _ = try_fetch(candidate)
        if is_xml3:
            return {'ok':True,'url':candidate,'items':count3,'discovered':True,'msg':'Discovered feed: %s (%d items)' % (candidate, count3)}

    return {'ok':False,'error':err or 'No RSS feed found. The site may not support RSS or blocks automated access.'}

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
        if self.path == '/check':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length else b''
            try:
                data = json.loads(body)
                result = check_feed(data.get('url',''))
                self.send_response(200)
                self.send_header('Content-Type','application/json')
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type','application/json')
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({'ok':False,'error':str(e)}).encode())
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