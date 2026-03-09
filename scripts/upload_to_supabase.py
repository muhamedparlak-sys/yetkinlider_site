"""
upload_to_supabase.py
──────────────────────
1. Browser'dan token alacak bir CORS-enabled local endpoint başlatır
2. Token gelince tüm batch SQL'leri Supabase Management API'ye gönderir

Kullanım:
  python scripts/upload_to_supabase.py

Ayrı terminalde browser console'dan çalıştır:
  fetch('http://localhost:8769/?t=' + localStorage['supabase.dashboard.auth.token']
    .match(/\"access_token\":\"([^\"]+)\"/)[1])
"""

import http.server, threading, urllib.request, urllib.parse, json, os, sys

PROJECT_REF = "fmrevabjbqozmqejhfvd"
API_BASE    = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
PORT        = 8769
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))

SQL_FILES = [
    "mesele_batch_1.sql",
    "mesele_batch_2.sql",
    "mesele_batch_3.sql",
    "mesele_batch_4.sql",
    "glossary_insert.sql",
]

received_token = [None]

def run_sql(token, sql):
    payload = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(
        API_BASE,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))

def upload_all(token):
    print("\n--- UPLOAD BAŞLIYOR ---")
    for fname in SQL_FILES:
        path = os.path.join(SCRIPTS_DIR, fname)
        if not os.path.exists(path):
            print(f"  ⚠ {fname} bulunamadı, atlıyor")
            continue
        with open(path, encoding="utf-8") as f:
            sql = f.read()
        print(f"  Yükleniyor: {fname} ({round(len(sql)/1024)} KB) ...", end="", flush=True)
        try:
            result = run_sql(token, sql)
            print(f" ✓ ({result})")
        except Exception as e:
            print(f" ✗ HATA: {e}")
    print("--- TAMAMLANDI ---")
    os._exit(0)

class TokenReceiver(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        token = params.get("t", [None])[0]

        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()

        if token:
            self.wfile.write(b"OK - uploading...")
            received_token[0] = token
            threading.Thread(target=upload_all, args=(token,), daemon=True).start()
        else:
            self.wfile.write(b"Token eksik - ?t=TOKEN gerekli")

    def log_message(self, fmt, *args):
        pass

print(f"Token alıcı sunucu başlatılıyor: http://localhost:{PORT}")
print(f"Browser console'dan çalıştır:")
print(f"""  fetch('http://localhost:{PORT}/?t=' + JSON.parse(localStorage['supabase.dashboard.auth.token'])?.access_token)""")

with http.server.HTTPServer(("", PORT), TokenReceiver) as httpd:
    httpd.serve_forever()
