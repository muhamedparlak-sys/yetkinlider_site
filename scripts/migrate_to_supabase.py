"""
migrate_to_supabase.py
──────────────────────
Mesele tipi JSON'larını ve glossary'i Supabase'e yükler.
Supabase SQL Editor'da çalıştırılacak INSERT SQL'ini üretir.

Kullanım:
  python scripts/migrate_to_supabase.py

Çıktı:
  scripts/insert_mesele_tipleri.sql
  scripts/insert_glossary.sql
"""

import json
import os
import re

WORKTREE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MESELE_DIR = os.path.join(WORKTREE, "data", "mesele-tipleri")
GLOSSARY_FILE = os.path.join(WORKTREE, "data", "glossary.json")
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def escape_sql_string(s):
    """PostgreSQL string escape: tek tırnak → çift tek tırnak"""
    return s.replace("'", "''")


def json_to_sql_literal(obj):
    """Python dict/list → PostgreSQL JSONB literal"""
    raw = json.dumps(obj, ensure_ascii=False)
    return escape_sql_string(raw)


# ── 1. mesele_tipleri ─────────────────────────────────────────────────────────
print("mesele_tipleri yükleniyor...")
mesele_files = [
    f for f in os.listdir(MESELE_DIR)
    if f.endswith(".json") and not f.startswith("_")
]

mesele_sql_parts = []
for fname in sorted(mesele_files):
    mesele_id = fname.replace(".json", "")
    fpath = os.path.join(MESELE_DIR, fname)
    with open(fpath, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    json_lit = json_to_sql_literal(data)
    mesele_sql_parts.append(
        f"('{mesele_id}', '{json_lit}'::jsonb)"
    )
    print(f"  ✓ {mesele_id} ({len(data.get('reasons', []))} reason)")

mesele_sql = (
    "-- mesele_tipleri yüklemesi\n"
    "INSERT INTO mesele_tipleri (id, data)\nVALUES\n"
    + ",\n".join(mesele_sql_parts)
    + "\nON CONFLICT (id) DO UPDATE SET\n"
    "  data       = EXCLUDED.data,\n"
    "  updated_at = now();\n"
)

out_mesele = os.path.join(OUT_DIR, "insert_mesele_tipleri.sql")
with open(out_mesele, "w", encoding="utf-8") as fh:
    fh.write(mesele_sql)
print(f"\n✅ {out_mesele} oluşturuldu ({len(mesele_files)} mesele tipi)")


# ── 2. glossary ───────────────────────────────────────────────────────────────
if os.path.exists(GLOSSARY_FILE):
    print("\nglossary yükleniyor...")
    with open(GLOSSARY_FILE, "r", encoding="utf-8") as fh:
        glossary_data = json.load(fh)

    # Glossary yapısını anla
    if isinstance(glossary_data, list):
        # Liste formatı: [{term, definition, ...}, ...]
        entries = glossary_data
        glossary_sql_parts = []
        for entry in entries:
            term = escape_sql_string(str(entry.get("term", entry.get("id", ""))))
            json_lit = json_to_sql_literal(entry)
            glossary_sql_parts.append(f"('{term}', '{json_lit}'::jsonb)")

        glossary_sql = (
            "-- glossary yüklemesi\n"
            "INSERT INTO glossary (term, data)\nVALUES\n"
            + ",\n".join(glossary_sql_parts)
            + "\nON CONFLICT (term) DO UPDATE SET\n"
            "  data       = EXCLUDED.data,\n"
            "  updated_at = now();\n"
        )
    elif isinstance(glossary_data, dict):
        # Dict formatı: {"term": {...}, ...} veya tek obje
        json_lit = json_to_sql_literal(glossary_data)
        glossary_sql = (
            "-- glossary tek JSON olarak yükle\n"
            "INSERT INTO glossary_blob (id, data)\nVALUES\n"
            f"('main', '{json_lit}'::jsonb)\n"
            "ON CONFLICT (id) DO UPDATE SET\n"
            "  data       = EXCLUDED.data,\n"
            "  updated_at = now();\n"
        )

    out_glossary = os.path.join(OUT_DIR, "insert_glossary.sql")
    with open(out_glossary, "w", encoding="utf-8") as fh:
        fh.write(glossary_sql)
    print(f"✅ {out_glossary} oluşturuldu")
else:
    print("⚠ glossary.json bulunamadı")

print("\nTamamlandı. SQL dosyalarını Supabase SQL Editor'da çalıştırın.")
