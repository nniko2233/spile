"""Impacchetta data/*.geojson + stats.json in data/bundle.js, cosi' la dashboard
si apre anche da file:// (fetch() su file locali e' bloccato dai browser)."""
import json
from config import DATA


def main():
    parts = {}
    for k, f in [("boundary", "boundary.geojson"), ("assets", "assets.geojson"),
                 ("zones", "zones.geojson"), ("stats", "stats.json")]:
        parts[k] = json.loads((DATA / f).read_text(encoding="utf-8"))
    js = "window.SPILE_DATA = " + json.dumps(parts, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (DATA / "bundle.js").write_text(js, encoding="utf-8")
    print(f"bundle.js: {len(js) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
