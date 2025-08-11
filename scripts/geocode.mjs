// node scripts/geocode.mjs
// Geocodes data/tle_centers_tx.json -> public/centers.geojson using Nominatim (no key).
// Respect ~1 req/sec. Verify a few results manually for accuracy.

import fs from "fs/promises";

const inFile = "data/tle_centers_tx.json";
const outFile = "public/centers.geojson";

async function main(){
  const raw = JSON.parse(await fs.readFile(inFile, "utf-8"));
  const feats = [];
  for (const [i, q] of raw.entries()){
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${q}, Texas, USA`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    const r = await fetch(url, { headers: { "User-Agent": "TLE-Screener/1.0 (contact: you@example.com)" }});
    if (!r.ok) { console.error("Geocode failed", q, r.status); await sleep(1100); continue; }
    const j = await r.json();
    if (j?.[0]) {
      const { lat, lon, display_name } = j[0];
      feats.push({
        type: "Feature",
        properties: { id: `TLE-${i+1}`, query: q, name: display_name },
        geometry: { type: "Point", coordinates: [Number(lon), Number(lat)] }
      });
      console.log(`${i+1}/${raw.length}  ✓  ${q} -> ${lat},${lon}`);
    } else {
      console.warn(`${i+1}/${raw.length}  ✗  ${q} (no match)`);
    }
    await sleep(1100); // be nice
  }
  const gj = { type: "FeatureCollection", features: feats };
  await fs.mkdir("public", { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(gj));
  console.log("Wrote", outFile);
}
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
main().catch(err=>{ console.error(err); process.exit(1); });
