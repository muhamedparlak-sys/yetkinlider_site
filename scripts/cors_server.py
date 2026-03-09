"""
cors_server.py — CORS başlıklı basit HTTP sunucu (port 8767)
SQL batch dosyalarını supabase.com JS'inden fetch edilebilir hale getirir.
"""
import http.server, socketserver, os

PORT = 8767
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class CORSHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # sessiz

with socketserver.TCPServer(("", PORT), CORSHandler) as httpd:
    print(f"CORS server: http://localhost:{PORT}")
    httpd.serve_forever()
