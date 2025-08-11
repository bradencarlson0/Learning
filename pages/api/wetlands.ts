import type { NextApiRequest, NextApiResponse } from 'next';

const BASE_URL =
  'https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_Wetlands/FeatureServer/0/query';

// Temporary subjects with centroids (same as index page)
const SUBJECTS: Record<string, { centroid: [number, number] }> = {
  TEHAMA: { centroid: [-97.33, 32.897] },
  CAMPWISDOM: { centroid: [-96.994, 32.664] }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { subject = 'TEHAMA' } = req.query as any;
    const subj = SUBJECTS[String(subject).toUpperCase()] ?? SUBJECTS.TEHAMA;

    // Rough ~5km bounding box around centroid
    const d = 0.05; // degrees
    const bbox = `${subj.centroid[0] - d},${subj.centroid[1] - d},${subj.centroid[0] + d},${
      subj.centroid[1] + d
    }`;

    const params = new URLSearchParams({
      where: '1=1',
      geometry: bbox,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      outSR: '4326',
      outFields: '*',
      f: 'geojson',
      resultRecordCount: '2000',
      resultOffset: '0'
    });

    const features: any[] = [];
    let offset = 0;
    while (true) {
      params.set('resultOffset', String(offset));
      const r = await fetch(`${BASE_URL}?${params.toString()}`);
      if (!r.ok) throw new Error(`NWI ${r.status}`);
      const gj = await r.json();
      const batch = gj?.features ?? [];
      features.push(...batch);
      if (batch.length < 2000) break;
      offset += 2000;
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
    res.status(200).json({ type: 'FeatureCollection', features });
  } catch (e: any) {
    console.error('wetlands:', e?.message || e);
    res.status(502).json({ error: 'Failed to fetch wetlands' });
  }
}

