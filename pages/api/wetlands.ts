import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  // Placeholder: returns empty layer so UI compiles. We can wire USFWS NWI later.
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
  res.status(200).json({ type: 'FeatureCollection', features: [] });
}
