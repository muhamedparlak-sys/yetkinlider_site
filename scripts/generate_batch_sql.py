"""
generate_batch_sql.py
──────────────────────
Mesele tipi ve glossary verilerini 4 batch SQL dosyasına böler.
Her batch ~170KB — Supabase SQL Editor'a rahatça inject edilir.
"""
import json, os, sys

WORKTREE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MESELE_DIR = os.path.join(WORKTREE, "data", "mesele-tipleri")
GLOSSARY_FILE = os.path.join(WORKTREE, "data", "glossary.json")
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

def esc(s):
    return s.replace("'", "''")

def to_jsonb(obj):
    return esc(json.dumps(obj, ensure_ascii=False))

# ── Mesele dosyalarını oku ─────────────────────────────────────────────────
files = sorted([f for f in os.listdir(MESELE_DIR)
                if f.endswith(".json") and not f.startswith("_")])

entries = []
for fname in files:
    mid = fname.replace(".json", "")
    with open(os.path.join(MESELE_DIR, fname), encoding="utf-8") as fh:
        data = json.load(fh)
    entries.append((mid, data))

# ── 4 batch'e böl ─────────────────────────────────────────────────────────
BATCH_SIZE = 9   # 36 / 4 = 9
batches = [entries[i:i+BATCH_SIZE] for i in range(0, len(entries), BATCH_SIZE)]

for bi, batch in enumerate(batches, 1):
    rows = ",\n".join(
        f"  ('{mid}', '{to_jsonb(data)}'::jsonb)"
        for mid, data in batch
    )
    sql = (
        f"-- Batch {bi}/{len(batches)}: "
        + ", ".join(mid for mid, _ in batch) + "\n"
        "INSERT INTO mesele_tipleri (id, data)\nVALUES\n"
        + rows + "\n"
        "ON CONFLICT (id) DO UPDATE SET\n"
        "  data = EXCLUDED.data,\n"
        "  updated_at = now();\n"
    )
    out = os.path.join(OUT_DIR, f"mesele_batch_{bi}.sql")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(sql)
    size_kb = round(os.path.getsize(out) / 1024)
    print(f"  Batch {bi}: {len(batch)} dosya → {out} ({size_kb} KB)")

# ── Glossary ──────────────────────────────────────────────────────────────
with open(GLOSSARY_FILE, encoding="utf-8") as fh:
    gdata = json.load(fh)

glossary_sql = (
    "INSERT INTO glossary_blob (id, data)\nVALUES\n"
    f"  ('main', '{to_jsonb(gdata)}'::jsonb)\n"
    "ON CONFLICT (id) DO UPDATE SET\n"
    "  data = EXCLUDED.data,\n"
    "  updated_at = now();\n"
)
out_g = os.path.join(OUT_DIR, "glossary_insert.sql")
with open(out_g, "w", encoding="utf-8") as fh:
    fh.write(glossary_sql)
print(f"  Glossary → {out_g} ({round(os.path.getsize(out_g)/1024)} KB)")
print("Tamamlandi.")
