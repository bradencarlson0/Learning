from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

ORDINANCES = [
    "00-10-17", "2024-11-52", "03-11-99",
    "18-11-65", "12-05-31",
    "19-12-116", "15-08-57",
    "14-10-62", "13-06-35", "19-01-03",
    "09-07-37", "05-06-48", "18-02-14",
    "15-10-77", "99-03-33",
    "15-11-82", "99-08-04", "02-07-78", "2020-05-31", "2021-03-20", "2021-03-21",
    "16-11-90", "89-11-02", "17-12-80",
    "07-09-44", "05-11-91",
    "15-06-26", "08-07-61", "2023-10-50",
]
BASE = "https://agenda.friscotexas.gov"
OUT = Path("tmp/frisco-onbase-browser-output")
OUT.mkdir(parents=True, exist_ok=True)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", text)[:160] or "resource"


def capture_response(response, target: Path, record: dict) -> None:
    try:
        headers = response.headers
        ctype = headers.get("content-type", "")
        disp = headers.get("content-disposition", "")
        url = response.url
        item = {
            "url": url,
            "status": response.status,
            "content_type": ctype,
            "content_disposition": disp,
        }
        low = url.lower()
        interesting = (
            "agenda.friscotexas.gov/appnet" in low
            and not any(x in low for x in [".css", ".ico", ".woff", ".ttf"])
        ) or any(x in ctype.lower() for x in ["pdf", "json", "octet-stream", "image/tiff"])
        if interesting:
            try:
                body = response.body()
                if body and len(body) <= 100_000_000:
                    if body.startswith(b"%PDF") or "pdf" in ctype.lower():
                        ext = ".pdf"
                    elif "json" in ctype.lower() or body[:1] in (b"{", b"["):
                        ext = ".json"
                    elif "javascript" in ctype.lower() or low.endswith(".js") or "webresource.axd" in low:
                        ext = ".js"
                    elif "html" in ctype.lower():
                        ext = ".html"
                    elif ctype.lower().startswith("image/"):
                        subtype = ctype.split("/", 1)[-1].split(";", 1)[0].replace("jpeg", "jpg")
                        ext = "." + safe(subtype)
                    else:
                        ext = ".bin"
                    name = safe(urlparse(url).path.rsplit("/", 1)[-1] or "response")
                    path = target / f"response_{len(record['responses']):04d}_{name}{ext}"
                    path.write_bytes(body)
                    item.update({"path": str(path), "size": len(body), "sha256": digest(body), "starts_pdf": body.startswith(b"%PDF")})
            except Exception as exc:
                item["body_error"] = repr(exc)
        record["responses"].append(item)
    except Exception as exc:
        record["responses"].append({"url": getattr(response, "url", None), "handler_error": repr(exc)})


def run_one(browser, ordinance: str) -> dict:
    url = f"{BASE}/AppNet/docpop/docpop.aspx?KT121_0_0_0={ordinance}&doctypeid=106"
    target = OUT / ordinance
    target.mkdir(parents=True, exist_ok=True)
    record = {
        "ordinance": ordinance,
        "requested_url": url,
        "responses": [],
        "requests": [],
        "downloads": [],
        "console": [],
        "page_errors": [],
        "popups": [],
    }
    context = browser.new_context(
        accept_downloads=True,
        viewport={"width": 1600, "height": 1200},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    )
    page = context.new_page()

    def on_download(download):
        try:
            path = target / f"download_{len(record['downloads']):03d}_{safe(download.suggested_filename)}"
            download.save_as(str(path))
            data = path.read_bytes()
            record["downloads"].append({"url": download.url, "suggested_filename": download.suggested_filename, "path": str(path), "size": len(data), "sha256": digest(data), "starts_pdf": data.startswith(b"%PDF")})
        except Exception as exc:
            record["downloads"].append({"error": repr(exc)})

    def on_popup(popup):
        record["popups"].append({"initial_url": popup.url})
        popup.on("response", lambda r: capture_response(r, target, record))

    page.on("response", lambda r: capture_response(r, target, record))
    page.on("request", lambda r: record["requests"].append({"url": r.url, "method": r.method, "resource_type": r.resource_type, "post_data": r.post_data}))
    page.on("download", on_download)
    page.on("popup", on_popup)
    page.on("console", lambda m: record["console"].append({"type": m.type, "text": m.text}))
    page.on("pageerror", lambda e: record["page_errors"].append(str(e)))

    try:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=90_000)
        except PlaywrightTimeoutError as exc:
            record["goto_timeout"] = str(exc)
        page.wait_for_timeout(20_000)
        try:
            page.wait_for_load_state("networkidle", timeout=30_000)
        except Exception:
            pass
        page.wait_for_timeout(10_000)
        record["final_url"] = page.url
        record["title"] = page.title()
        (target / "page.html").write_text(page.content(), encoding="utf-8")
        try:
            (target / "page.txt").write_text(page.locator("body").inner_text(timeout=10_000), encoding="utf-8")
        except Exception as exc:
            record["body_text_error"] = repr(exc)
        try:
            page.screenshot(path=str(target / "page.png"), full_page=True)
        except Exception as exc:
            record["screenshot_error"] = repr(exc)
        record["frames"] = [{"url": f.url, "name": f.name} for f in page.frames]
        record["anchors"] = page.locator("a").evaluate_all("els => els.map(e => ({text:(e.innerText||'').trim(), href:e.href, title:e.title})).filter(x => x.href)")
        record["iframes"] = page.locator("iframe").evaluate_all("els => els.map(e => ({src:e.src, id:e.id, name:e.name, title:e.title}))")
        record["objects"] = page.locator("embed,object").evaluate_all("els => els.map(e => ({tag:e.tagName, src:e.src||e.data, type:e.type, id:e.id}))")
        record["buttons"] = page.locator("button,input[type=button],input[type=submit]").evaluate_all("els => els.map(e => ({tag:e.tagName, text:(e.innerText||e.value||'').trim(), id:e.id, name:e.name, title:e.title, disabled:e.disabled}))")
        record["body_html_excerpt"] = page.locator("body").inner_html()[:100000]

        # Inspect global functions/variables relevant to document loading.
        try:
            record["globals"] = page.evaluate("""() => Object.keys(window).filter(k => /load|doc|pdf|page|print|download|init/i.test(k)).sort().slice(0,1000)""")
            record["load_init_type"] = page.evaluate("() => typeof window.LoadInitInfo")
            record["load_init_source"] = page.evaluate("() => typeof window.LoadInitInfo === 'function' ? String(window.LoadInitInfo) : null")
        except Exception as exc:
            record["globals_error"] = repr(exc)

        # Let any popup or delayed download finish.
        for p in context.pages:
            if p is not page:
                try:
                    p.wait_for_timeout(5_000)
                    record["popups"].append({"url": p.url, "title": p.title()})
                    p.screenshot(path=str(target / f"popup_{len(record['popups']):02d}.png"), full_page=True)
                except Exception:
                    pass
    except Exception as exc:
        record["error"] = repr(exc)
    finally:
        (target / "result.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
        context.close()
    return record


def main() -> None:
    manifest = {"generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "results": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-dev-shm-usage", "--no-sandbox"])
        try:
            for ordinance in ORDINANCES:
                manifest["results"].append(run_one(browser, ordinance))
        finally:
            browser.close()
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
