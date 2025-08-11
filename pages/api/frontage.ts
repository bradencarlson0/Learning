// pages/api/frontage.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as turf from '@turf/turf';

const FC_URL =
  'https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Functional_Classification/FeatureServer/0/query';

// Simple weights by functional system (tweak as you like)
function classWeight(props: any): number {
  const v =
    props?.FUNC_SYS ?? props?.F_SYSTEM ?? props?.FCLASS ?? props?.func_sys ?? null;
  const s = String(v ?? '');
  switch (s) {
    case '1': // Interstate
      return 5;
    case '2': // Principal Arterial
      return 4;
    case '3': // Minor Arterial
      return 3;
    case '4': // Major Collector
      return 2;
    default: // Local or unknown
      return 1;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const lat = parseFloat(String(req.query.lat ?? 'NaN'));
  const lon = parseFloat(String(req.query.lon ?? 'NaN'));
  const radius = Number(req.query.radius ?? 120); // meters

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    res.status(400).json({ error: 'lat and lon are required' });
    return;
  }

  // ~1km bbox around the point (in degrees)
  const d = 0.01;
  const geom = {
    xmin: lon - d,
    ymin: lat - d,
    xmax: lon + d,
    ymax: lat + d,
    spatialReference: { wkid: 4326 }
  };

  const url = new URL(FC_URL);
  url.searchParams.set('f', 'geojson');
  url.searchParams.set('where', '1=1');
  url.searchParams.set('outFields', '*');
  url.searchParams.set('geometry', JSON.stringify(geom));
  url.searchParams.set('geometryType', 'esriGeometryEnvelope');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('returnGeometry', 'true');

  let roads: any = { type: 'FeatureCollection', features: [] };
  try {
    const r = await fetch(url.toString());
    if (r.ok) roads = await r.json();
  } catch {
    // keep empty feature collection
  }

  const pt = turf.point([lon, lat]);

  let exposure = 0;
  let nearest = Number.POSITIVE_INFINITY;

  for (const f of roads.features ?? []) {
    if (!f?.geometry) continue;

    // Correct Turf call: distance FROM point TO line
    // (was the source of the “expected 2 args” error)
    const dist = turf.pointToLineDistance(pt, f as any, { units: 'meters' });

    if (dist <= radius) {
      nearest = Math.min(nearest, dist);
      exposure += classWeight(f.properties);
    } else {
      nearest = Math.min(nearest, dist);
    }
  }

  // Scale exposure into a pseudo "frontage meters" number
  // (tune factor as needed for your scoring)
  const frontage = Math.round(exposure * 30);

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
  res.status(200).json({
    frontage,
    nearest_m: Number.isFinite(nearest) ? Math.round(nearest) : null,
    count_within_radius: exposure // rough count weighted by class
  });
}
