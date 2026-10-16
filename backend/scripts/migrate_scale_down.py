import sqlite3
import sys

db_path = sys.argv[1] if len(sys.argv) > 1 else "/data/media/config/media-optimizer/db/optimizer.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("PRAGMA table_info(encoding_profiles)")
cols = [r[1] for r in cur.fetchall()]
print(f"Existing columns in {db_path}: {cols}")

if "scale_down_percent" not in cols:
    cur.execute("ALTER TABLE encoding_profiles ADD COLUMN scale_down_percent INTEGER DEFAULT 0")
    conn.commit()
    print("Added scale_down_percent column successfully.")
else:
    print("scale_down_percent already exists.")

conn.close()
