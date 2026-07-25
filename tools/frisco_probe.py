from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ORDINANCES = [
    "00-10-17", "18-11-65", "19-12-116", "14-10-62", "19-01-03",
    "09-07-37", "15-10-77", "15-11-82", "99-08-04", "16-11-90",
    "07-09-44", "15-06-26", "2023-10-50",
]
BASE = "https://agenda.friscotexas.gov"
OUT = Path("tmp/frisco-probe-output")
OUT.mkdir(parents=True, exist_ok=True)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", value)[:180] or "file"


def save_response(session: requests.Session, url: str, target: Path, *, params=None, timeout=90) -> dict:
    target.parent.mkdir(parents=True, exist_ok=True)
    meta = {"requested_url": url, "params": params}
    try:
        response = session.get(url, params=params, timeout=timeout, allow_redirects=True)
        data = response.content
        ctype = response.headers.get("content-type", "")
        ext = ".pdf" if data.startswith(b"%PDF") or "pdf" in ctype.lower() else ".json" if "json" in ctype.lower() else ".html" if "html" in ctype.lower() else ".bin"
        body_path = target.with_suffix(ext)
        body_path.write_bytes(data)
        meta.update({
            "status": response.status_code,
            "final_url": response.url,
            "content_type": ctype,
            "headers": dict(response.headers),
            "history": [{"status": r.status_code, "url": r.url, "headers": dict(r.headers)} for r in response.history],
            "body_path": str(body_path),
            "size": len(data),
            "sha256": sha256(data),
            "starts_pdf": data.startswith(b"%PDF"),
        })
        if ext == ".html":
            soup = BeautifulSoup(response.text, "html.parser")
            links = []
            for tag, attr in (("a", "href"), ("iframe", "src"), ("embed", "src"), ("object", "data"), ("script", "src"), ("link", "href"), ("form", "action")):
                for node in soup.find_all(tag):
                    raw = node.get(attr)
                    if raw:
                        links.append({"tag": tag, "attr": attr, "raw": raw, "url": urljoin(response.url, raw)})
            parsed = {
                "title": soup.title.get_text(" ", strip=True) if soup.title else None,
                "text": soup.get_text("\n", strip=True),
                "links": links,
                "raw_url_tokens": sorted(set(re.findall(r"(?:https?:)?//[^\s\"'<>]+|/[A-Za-z0-9_./?=&%:+-]{6,}", response.text)))[:3000],
                "script_blocks": [s.get_text("\n", strip=False) for s in soup.find_all("script")],
            }
            parsed_path = target.with_suffix(".parsed.json")
            parsed_path.write_text(json.dumps(parsed, indent=2), encoding="utf-8")
            meta["parsed_path"] = str(parsed_path)
    except Exception as exc:
        meta["error"] = repr(exc)
    meta_path = target.with_suffix(".meta.json")
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def main() -> None:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,application/json;q=0.7,*/*;q=0.6",
        "Accept-Language": "en-US,en;q=0.9",
    })
    manifest = {"generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "ordinances": {}, "gis": {}, "public_access": {}}

    for ordinance in ORDINANCES:
        url = f"{BASE}/AppNet/docpop/docpop.aspx?KT121_0_0_0={ordinance}&doctypeid=106"
        manifest["ordinances"][ordinance] = save_response(session, url, OUT / "onbase" / ordinance / "docpop")

    manifest["public_access"]["index"] = save_response(session, f"{BASE}/PublicAccess/Index.html", OUT / "public-access" / "index")
    manifest["public_access"]["nextgen"] = save_response(session, f"{BASE}/nextgen/index.html", OUT / "public-access" / "nextgen")

    gis_url = "https://maps.friscotexas.gov/gis/rest/services/Public/TRAKiT_Geotype_Layers/MapServer/4/query"
    params_no_geom = {
        "where": "1=1", "outFields": "*", "returnGeometry": "false", "f": "pjson",
        "resultRecordCount": "5000",
    }
    params_geom = {
        "where": "1=1", "outFields": "*", "returnGeometry": "true", "outSR": "4326", "f": "geojson",
        "resultRecordCount": "5000",
    }
    manifest["gis"]["all_attributes"] = save_response(session, gis_url, OUT / "gis" / "all_attributes", params=params_no_geom)
    manifest["gis"]["all_geojson"] = save_response(session, gis_url, OUT / "gis" / "all_geojson", params=params_geom)
    manifest["gis"]["layer_metadata"] = save_response(session, gis_url.rsplit("/query", 1)[0], OUT / "gis" / "layer_metadata", params={"f": "pjson"})

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
