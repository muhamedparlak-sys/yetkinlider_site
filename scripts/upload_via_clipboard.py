"""
upload_via_clipboard.py
────────────────────────
Supabase service_role key'i Windows clipboard'dan okur,
mesele_tipleri + glossary_blob tablolarına veri yükler.

Kullanım:
  1. Supabase dashboard → Settings → API Keys → service_role → Kopyala
  2. python -X utf8 scripts/upload_via_clipboard.py
"""

import subprocess, urllib.request, json, os, sys

PROJECT_REF   = "fmrevabjbqozmqejhfvd"
SUPABASE_URL  = f"https://{PROJECT_REF}.supabase.co"
SCRIPTS_DIR   = os.path.dirname(os.path.abspath(__file__))

SQL_BATCHES = [
    "mesele_batch_1.sql",
    "mesele_batch_2.sql",
    "mesele_batch_3.sql",
    "mesele_batch_4.sql",
    "glossary_insert.sql",
]

def get_clipboard():
    result = subprocess.run(
        ["powershell", "-command", "Get-Clipboard"],
        capture_output=True, text=True
    )
    return result.stdout.strip()

def run_sql(service_key, sql):
    """Supabase REST API üzerinden SQL çalıştır (POST /rest/v1/rpc yok, doğrudan management API)"""
    # Management API (api.supabase.com) service_role ile çalışmaz.
    # PostgREST üzerinden tablo insert yaparız.
    # Ama büyük JSONB için Management API gerekiyor.
    # Alternatif: Supabase db/query endpoint'i service_role key ile değil,
    # postgres connection string ile çalışır.
    #
    # En temiz yol: PostgREST RPC ile custom function çağır.
    # Ya da: /rest/v1/mesele_tipleri endpoint'ine PUT/POST at.
    raise NotImplementedError("Bu fonksiyon yerine aşağıdaki insert_rows kullan")

def insert_rows(service_key, table, rows):
    """
    PostgREST üzerinden tablo satırı ekle.
    rows: list of dicts
    """
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    payload = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "apikey":        service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type":  "application/json",
            "Prefer":        "resolution=merge-duplicates",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, resp.read().decode("utf-8")

def load_mesele_tipleri(service_key):
    MESELE_DIR = os.path.join(os.path.dirname(SCRIPTS_DIR), "data", "mesele-tipleri")
    files = sorted([f for f in os.listdir(MESELE_DIR)
                    if f.endswith(".json") and not f.startswith("_")])
    rows = []
    for fname in files:
        mid = fname.replace(".json", "")
        with open(os.path.join(MESELE_DIR, fname), encoding="utf-8") as fh:
            data = json.load(fh)
        rows.append({"id": mid, "data": data})

    print(f"\n[mesele_tipleri] {len(rows)} satır yükleniyor...", flush=True)
    # Batch 9'lu gruplar halinde gönder
    BATCH = 9
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i+BATCH]
        ids = [r["id"] for r in batch]
        print(f"  Batch {i//BATCH+1}: {ids[0]} .. {ids[-1]} ...", end="", flush=True)
        status, body = insert_rows(service_key, "mesele_tipleri", batch)
        if status in (200, 201):
            print(f" ✓")
        else:
            print(f" ✗ ({status}): {body[:100]}")
    print("[mesele_tipleri] Tamamlandı.")

def load_glossary(service_key):
    GLOSSARY = os.path.join(os.path.dirname(SCRIPTS_DIR), "data", "glossary.json")
    with open(GLOSSARY, encoding="utf-8") as fh:
        data = json.load(fh)
    rows = [{"id": "main", "data": data}]
    print(f"\n[glossary_blob] Yükleniyor...", end="", flush=True)
    status, body = insert_rows(service_key, "glossary_blob", rows)
    if status in (200, 201):
        print(" ✓")
    else:
        print(f" ✗ ({status}): {body[:200]}")
    print("[glossary_blob] Tamamlandı.")

def main():
    print("service_role key clipboard'dan okunuyor...")
    key = get_clipboard()
    if not key or not key.startswith("eyJ"):
        print("HATA: Clipboard'da geçerli bir service_role key yok.")
        print("Supabase Settings → API Keys → service_role → Kopyala butonuna basin.")
        sys.exit(1)
    print(f"Key bulundu: {key[:20]}...{key[-10:]}")

    load_mesele_tipleri(key)
    load_glossary(key)
    print("\nTüm veriler Supabase'e yüklendi!")
    print("Artık data/mesele-tipleri/ ve data/glossary.json dosyalarını")
    print(".gitignore'a ekleyip git'ten kaldırabilirsiniz.")

if __name__ == "__main__":
    main()
